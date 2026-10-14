import 'server-only'
import { isoBytes } from './protocol'

export interface GarantiConfig {
  observationOnly?: boolean; liveObservationOnly?: boolean; liveDiagnostics?: boolean; singleFinalizeTest?: boolean
  mode: 'TEST' | 'PROD'; merchantId: string; terminalId: string; userId: string; queryAgentUserId: string
  provisionUser: string; provisionPassword: string; queryUser: string; queryPassword: string
  storeKey: string; handoffSecret: string; siteOrigin: string; formUrl: string; queryUrl: string
  successUrl: string; errorUrl: string; installment: '' | '0'
  capturedStatus: string; capturedResultCode: string; saleChargeType: string; failedStatuses: readonly string[]
  failedResultMappings: readonly { status: string; code: string; reasonCode: string }[]
  initiationMaxAmountMinor: number | null
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export function controlledLiveAccountAllowed(userId: string | null | undefined, env: NodeJS.ProcessEnv = process.env) {
  const allowedUserId = env.GARANTI_LIVE_ALLOWED_USER_ID || ''
  return env.GARANTI_MODE === 'PROD' && env.VERCEL_ENV === 'production'
    && env.GARANTI_LIVE_CONTROLLED_ONLY === 'true'
    && !!userId && UUID.test(allowedUserId)
    && userId.toLowerCase() === allowedUserId.toLowerCase()
}
export function controlledLiveAmountAllowed(amountMinor: number, env: NodeJS.ProcessEnv = process.env) {
  const rawCap = env.GARANTI_LIVE_MAX_AMOUNT_MINOR || ''
  const cap = /^\d{1,5}$/.test(rawCap) ? Number(rawCap) : Number.NaN
  return env.GARANTI_MODE === 'PROD' && Number.isSafeInteger(amountMinor) && amountMinor > 0
    && Number.isSafeInteger(cap) && cap > 0 && cap <= 50000 && amountMinor <= cap
}
export function garantiObservationOnly(env: NodeJS.ProcessEnv = process.env) {
  return env.GARANTI_TEST_OBSERVATION_ONLY === 'true' && env.GARANTI_MODE === 'TEST'
    && env.VERCEL_ENV === 'preview'
    && env.GARANTI_SITE_ORIGIN === 'https://nrs-bequite-garanti-test.vercel.app'
    && env.NEXT_PUBLIC_SUPABASE_URL === 'https://dzuxhwtbuojnhibzfxqy.supabase.co'
    && env.GARANTI_TEST_SUPABASE_URL === env.NEXT_PUBLIC_SUPABASE_URL
    && env.GARANTI_TEST_DATABASE_ISOLATED === 'true'
    && env.GARANTI_TEST_MERCHANT_ID === '7000679' && env.GARANTI_TEST_TERMINAL_ID === '30691297'
}
export function garantiSingleFinalizeTest(env: NodeJS.ProcessEnv = process.env) {
  return env.GARANTI_TEST_SINGLE_FINALIZE_ONLY === 'true' && garantiObservationOnly(env)
}
export function garantiLiveObservationOnly(env: NodeJS.ProcessEnv = process.env) {
  return env.GARANTI_LIVE_OBSERVATION_ONLY === 'true' && env.GARANTI_MODE === 'PROD'
    && env.VERCEL_ENV === 'production' && env.GARANTI_LIVE_CONTROLLED_ONLY === 'true'
    && UUID.test(env.GARANTI_LIVE_ALLOWED_USER_ID || '')
    && env.NEXT_PUBLIC_SUPABASE_URL === 'https://moiynemxthkmgpgnfajd.supabase.co'
}
export function garantiLiveSingleFinalizeArmed(userId: string | null | undefined, amountMinor: number,
  env: NodeJS.ProcessEnv = process.env) {
  return env.GARANTI_LIVE_SINGLE_FINALIZE_ARMED === 'true'
    && garantiLiveObservationOnly(env) && controlledLiveAccountAllowed(userId, env)
    && amountMinor === 300 && controlledLiveAmountAllowed(amountMinor, env)
}
export function garantiConfig(env: NodeJS.ProcessEnv = process.env): GarantiConfig {
  const test = env.GARANTI_MODE === 'TEST'
  const observationOnly = garantiObservationOnly(env)
  const liveObservationOnly = garantiLiveObservationOnly(env)
  const singleFinalizeTest = garantiSingleFinalizeTest(env)
  if (env.GARANTI_TEST_SINGLE_FINALIZE_ONLY === 'true' && !singleFinalizeTest) throw new Error('Single-order finalization is restricted to the isolated TEST Preview.')
  if (env.GARANTI_TEST_OBSERVATION_ONLY === 'true' && !observationOnly) throw new Error('Observation is restricted to the isolated TEST Preview.')
  if (env.GARANTI_LIVE_OBSERVATION_ONLY === 'true' && !liveObservationOnly) throw new Error('Live observation is restricted to the one-account Production environment.')
  if (!test && env.GARANTI_MODE !== 'PROD') throw new Error('Garanti mode missing.')
  if (test && env.VERCEL_ENV === 'production') throw new Error('Sandbox forbidden in Production.')
  if (!test && (env.VERCEL_ENV !== 'production' || env.GARANTI_LIVE_CONTROLLED_ONLY !== 'true'
    || !UUID.test(env.GARANTI_LIVE_ALLOWED_USER_ID || '')
    || env.NEXT_PUBLIC_SUPABASE_URL !== 'https://moiynemxthkmgpgnfajd.supabase.co')) {
    throw new Error('Live payments require the controlled Production account and Production database.')
  }
  if (test && (env.GARANTI_TEST_DATABASE_ISOLATED !== 'true' || !env.GARANTI_TEST_SUPABASE_URL
    || env.GARANTI_TEST_SUPABASE_URL !== env.NEXT_PUBLIC_SUPABASE_URL)) throw new Error('Separate sandbox database required.')
  if (!test && !liveObservationOnly && env.GARANTI_LIVE_QUERY_FIELDS_CONFIRMED !== 'true') throw new Error('Confirm successful Production orderinq response fields with Garanti.')
  // The explicit, one-account live observation mode does not claim these bank
  // confirmations. It can submit a user-approved low-value live attempt, but
  // every signed return remains pending and is never finalized automatically.
  if ((!observationOnly && !liveObservationOnly && env.GARANTI_OOS_VERIFIED !== 'true')
    || (!test && !liveObservationOnly && env.GARANTI_LIVE_APPROVED !== 'true')) throw new Error('Garanti terminal not verified.')
  const prefix = test ? 'GARANTI_TEST_' : 'GARANTI_LIVE_'
  const field = (name: string) => {
    const value = env[prefix + name]
    if (!value || value.length > 256 || /[\x00-\x1f]/.test(value)) throw new Error('Garanti configuration missing.')
    isoBytes(value)
    return value
  }
  const merchantId = field('MERCHANT_ID'), terminalId = field('TERMINAL_ID')
  // Restrict to eight digits: the official C#/Java zero-prefix and PHP nine-digit
  // padding examples then agree. Other terminal formats need bank confirmation.
  if (!/^\d{1,9}$/.test(merchantId) || !/^[1-9]\d{7}$/.test(terminalId)) throw new Error('Garanti identity invalid.')
  const provisionUser = field('PROVISION_USER'), queryUser = field('QUERY_USER')
  if (!['PROVAUT', 'PROVOOS'].includes(provisionUser) || !['PROVAUT', 'PROVOOS', 'PROVRFN'].includes(queryUser)) throw new Error('Garanti user invalid.')
  const userId = field('USER_ID')
  if (!/^[A-Za-z0-9_]{1,32}$/.test(userId)) throw new Error('Garanti user invalid.')
  // Common-payment terminaluserid and orderinq Terminal/UserID are separate
  // bank fields. Preserve TEST's previous value by default; require explicit
  // Production configuration so the two official examples cannot be conflated.
  const queryAgentUserId = test
    ? (env[prefix + 'QUERY_AGENT_USER_ID'] || userId)
    : field('QUERY_AGENT_USER_ID')
  if (!/^[A-Za-z0-9_]{1,32}$/.test(queryAgentUserId)) throw new Error('Garanti user invalid.')
  const site = new URL(env.GARANTI_SITE_ORIGIN || '')
  if (site.protocol !== 'https:' || site.username || site.password || site.pathname !== '/' || site.search || site.hash) throw new Error('Garanti site URL invalid.')
  const url = (name: string, path: string) => {
    const value = new URL(env[name] || '')
    if (value.origin !== site.origin || value.pathname !== path || value.search || value.hash || value.username || value.password) throw new Error('Garanti return URL invalid.')
    return value.href
  }
  const host = test ? 'sanalposprovtest.garantibbva.com.tr' : 'sanalposprov.garanti.com.tr'
  // Require explicit endpoints; never infer a live form URL from the XML URL.
  const endpoint = (name: string, path: string) => {
    const value = new URL(env[prefix + name] || '')
    if (value.protocol !== 'https:' || value.hostname !== host || value.port || value.pathname !== path || value.search || value.hash || value.username || value.password) throw new Error('Garanti endpoint invalid.')
    return value.href
  }
  // Garanti's no-installment form value and initiation hash component are the
  // same empty string. Vercel cannot store an empty env var, so treat undefined
  // as the documented no-installment value while rejecting explicit variants.
  const installment = env.GARANTI_SINGLE_INSTALLMENT ?? ''
  if (installment !== '' && installment !== '0') throw new Error('Confirm bank single installment convention.')
  const capturedStatus = env.GARANTI_CAPTURED_STATUS || '', saleChargeType = env.GARANTI_SALE_CHARGE_TYPE || ''
  const capturedResultCode = env.GARANTI_CAPTURED_RESULT_CODE || ''
  const configuredFailedStatuses = (env.GARANTI_FINAL_FAILED_STATUSES || '').split(',').filter(Boolean)
  const rawFailedMappings = env.GARANTI_LIVE_FAILED_RESULT_MAPPINGS || ''
  const failedResultMappings = rawFailedMappings ? rawFailedMappings.split(',').map(entry => {
    const [status, code, reasonCode, ...extra] = entry.split('|')
    if (extra.length || !status || !code || !reasonCode
      || ![status, code, reasonCode].every(value => /^[A-Za-z0-9_-]{1,32}$/.test(value))
      || (code === '00' && reasonCode === '00')) throw new Error('Confirm bank query failure mappings.')
    return { status, code, reasonCode }
  }) : []
  if (!test && rawFailedMappings && env.GARANTI_LIVE_FAILED_RESULTS_CONFIRMED !== 'true') {
    throw new Error('Confirm bank query failure mappings.')
  }
  const failedStatuses = test ? configuredFailedStatuses : failedResultMappings.map(mapping => mapping.status)
  if (configuredFailedStatuses.some(v => !/^[A-Za-z0-9_-]{1,32}$/.test(v))
    || new Set(failedResultMappings.map(mapping => `${mapping.status}|${mapping.code}|${mapping.reasonCode}`)).size !== failedResultMappings.length) {
    throw new Error('Confirm bank query status meanings.')
  }
  if (!observationOnly && !liveObservationOnly && (!capturedStatus || !capturedResultCode || !saleChargeType
    || configuredFailedStatuses.includes(capturedStatus) || failedStatuses.includes(capturedStatus)
    || ![capturedStatus, capturedResultCode, saleChargeType, ...failedStatuses].every(v => /^[A-Za-z0-9_-]{1,32}$/.test(v)))) throw new Error('Confirm bank query status meanings.')
  const handoffSecret = env.GARANTI_HANDOFF_SECRET || ''
  if (!/^[0-9a-f]{64}$/.test(handoffSecret)) throw new Error('Garanti handoff secret missing.')
  const initiationMaxAmountMinor = test ? null : Number(env.GARANTI_LIVE_MAX_AMOUNT_MINOR)
  if (!test && !controlledLiveAmountAllowed(Number(initiationMaxAmountMinor), env)) {
    throw new Error('A small controlled live amount ceiling is required.')
  }
  return { observationOnly, liveObservationOnly, singleFinalizeTest, mode: test ? 'TEST' : 'PROD', merchantId, terminalId, userId, queryAgentUserId, provisionUser,
    provisionPassword: field('PROVISION_PASSWORD'), queryUser, queryPassword: field('QUERY_PASSWORD'),
    storeKey: field('STORE_KEY'), handoffSecret, siteOrigin: site.origin,
    formUrl: endpoint('FORM_URL', '/servlet/gt3dengine'), queryUrl: endpoint('QUERY_URL', '/VPServlet'),
    successUrl: url('GARANTI_SUCCESS_URL', '/api/payment/garanti/success'),
    errorUrl: url('GARANTI_ERROR_URL', '/api/payment/garanti/failure'), installment,
    capturedStatus, capturedResultCode, saleChargeType, failedStatuses, failedResultMappings, initiationMaxAmountMinor }
}
