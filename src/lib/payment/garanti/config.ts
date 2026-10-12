import 'server-only'
import { isoBytes } from './protocol'

export interface GarantiConfig {
  observationOnly?: boolean; singleFinalizeTest?: boolean
  mode: 'TEST' | 'PROD'; merchantId: string; terminalId: string; userId: string
  provisionUser: string; provisionPassword: string; queryUser: string; queryPassword: string
  storeKey: string; handoffSecret: string; siteOrigin: string; formUrl: string; queryUrl: string
  successUrl: string; errorUrl: string; installment: '' | '0'
  capturedStatus: string; capturedResultCode: string; saleChargeType: string; failedStatuses: readonly string[]
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
export function garantiConfig(env: NodeJS.ProcessEnv = process.env): GarantiConfig {
  const test = env.GARANTI_MODE === 'TEST'
  const observationOnly = garantiObservationOnly(env)
  const singleFinalizeTest = garantiSingleFinalizeTest(env)
  if (env.GARANTI_TEST_SINGLE_FINALIZE_ONLY === 'true' && !singleFinalizeTest) throw new Error('Single-order finalization is restricted to the isolated TEST Preview.')
  if (env.GARANTI_TEST_OBSERVATION_ONLY === 'true' && !observationOnly) throw new Error('Observation is restricted to the isolated TEST Preview.')
  if (!test && env.GARANTI_MODE !== 'PROD') throw new Error('Garanti mode missing.')
  if (test && env.VERCEL_ENV === 'production') throw new Error('Sandbox forbidden in Production.')
  if (test && (env.GARANTI_TEST_DATABASE_ISOLATED !== 'true' || !env.GARANTI_TEST_SUPABASE_URL
    || env.GARANTI_TEST_SUPABASE_URL !== env.NEXT_PUBLIC_SUPABASE_URL)) throw new Error('Separate sandbox database required.')
  if (!test && env.GARANTI_SANDBOX_PASSED !== 'true') throw new Error('Bank sandbox acceptance required.')
  if ((!observationOnly && env.GARANTI_OOS_VERIFIED !== 'true') || (!test && env.GARANTI_LIVE_APPROVED !== 'true')) throw new Error('Garanti terminal not verified.')
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
  const installment = env.GARANTI_SINGLE_INSTALLMENT
  if (installment !== '' && installment !== '0') throw new Error('Confirm bank single installment convention.')
  const capturedStatus = env.GARANTI_CAPTURED_STATUS || '', saleChargeType = env.GARANTI_SALE_CHARGE_TYPE || ''
  const capturedResultCode = env.GARANTI_CAPTURED_RESULT_CODE || ''
  const failedStatuses = (env.GARANTI_FINAL_FAILED_STATUSES || '').split(',').filter(Boolean)
  if (!observationOnly && (!capturedStatus || !capturedResultCode || !saleChargeType || failedStatuses.includes(capturedStatus)
    || ![capturedStatus, capturedResultCode, saleChargeType, ...failedStatuses].every(v => /^[A-Za-z0-9_-]{1,32}$/.test(v)))) throw new Error('Confirm bank query status meanings.')
  const handoffSecret = env.GARANTI_HANDOFF_SECRET || ''
  if (!/^[0-9a-f]{64}$/.test(handoffSecret)) throw new Error('Garanti handoff secret missing.')
  return { observationOnly, singleFinalizeTest, mode: test ? 'TEST' : 'PROD', merchantId, terminalId, userId, provisionUser,
    provisionPassword: field('PROVISION_PASSWORD'), queryUser, queryPassword: field('QUERY_PASSWORD'),
    storeKey: field('STORE_KEY'), handoffSecret, siteOrigin: site.origin,
    formUrl: endpoint('FORM_URL', '/servlet/gt3dengine'), queryUrl: endpoint('QUERY_URL', '/VPServlet'),
    successUrl: url('GARANTI_SUCCESS_URL', '/api/payment/garanti/success'),
    errorUrl: url('GARANTI_ERROR_URL', '/api/payment/garanti/failure'), installment,
    capturedStatus, capturedResultCode, saleChargeType, failedStatuses }
}
