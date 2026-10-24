import { NextResponse } from 'next/server'
import { PaymentStartError } from '@/lib/payment/start-error'
import { UUID } from '@/lib/payment/request'
import { localeFromCookieHeader } from '@/lib/i18n/messages'
import { getCurrentUsdTryRate } from '@/lib/i18n/rates'
import { cookies } from 'next/headers'
import { GUEST_ACCESS_SECONDS, GUEST_COOKIE, hashGuestToken, newGuestToken } from '@/lib/payment/access'
import { randomBytes } from 'node:crypto'

type PublicPaymentErrorCode = 'NRS-PAY-SESSION' | 'NRS-PAY-CART' | 'NRS-PAY-PRICE' | 'NRS-PAY-STOCK' | 'NRS-PAY-RPC' | 'NRS-PAY-BANK' | 'NRS-PAY-UNKNOWN'

function categoryFor(stage: string, databaseCode?: string, rpcReason?: string): PublicPaymentErrorCode {
  // Only allowlisted RPC messages are classified (see rpcFailureReason); any
  // other P0001 stays the generic RPC category.
  if (rpcReason === 'price') return 'NRS-PAY-PRICE'
  if (rpcReason === 'stock') return 'NRS-PAY-STOCK'
  if (rpcReason === 'owner') return 'NRS-PAY-SESSION'
  if (rpcReason === 'cart') return 'NRS-PAY-CART'
  if (stage === 'create_rpc' || databaseCode === 'P0001') return 'NRS-PAY-RPC'
  if (stage === 'handoff' || stage === 'store_redirect') return 'NRS-PAY-BANK'
  if (stage === 'request' && databaseCode) return 'NRS-PAY-SESSION'
  return 'NRS-PAY-UNKNOWN'
}

function failedResponse(status: number, stage: string, options: {
  databaseCode?: string
  internalCode?: string
  resumeUrl?: string
  rpcReason?: string
} = {}) {
  const trackingNumber = randomBytes(8).toString('hex').toUpperCase()
  const errorCode = categoryFor(stage, options.databaseCode, options.rpcReason)
  console.warn(JSON.stringify({
    event: 'payment_start_failed', endpoint: '/api/payment/create', status,
    stage, sqlState: options.databaseCode, rpcReason: options.rpcReason, errorCode, trackingNumber,
  }))
  const error = options.internalCode === 'UNRESOLVED_PAYMENT'
    ? 'Ödeme başlatılamadı. Bekleyen bir siparişiniz olabilir; durum netleşene kadar yeniden ödeme başlatmayın.'
    : 'Ödeme başlatılamadı. Lütfen hata kodu ve takip numarasını destek ekibimizle paylaşın. Sonuç belirsizse yeniden ödeme başlatmayın.'
  return NextResponse.json({ error, errorCode, trackingNumber,
    ...(options.resumeUrl ? { resumeUrl: options.resumeUrl } : {}) },
  { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  if (process.env.PAYMENT_ENABLED !== 'true') return failedResponse(503, 'request')
  const { paymentAvailable, paymentAvailableForUser, getPaymentProvider } = await import('@/lib/payment/provider')
  const { boundedJson, sameOrigin } = await import('@/lib/payment/http')
  if (!paymentAvailable()) return failedResponse(503, 'request')
  if (!sameOrigin(request)) return failedResponse(403, 'request')
  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server')
    const { createPaymentRepository } = await import('@/lib/payment/repository')
    const { initiatePayment } = await import('@/lib/payment/service')
    const auth = await createSupabaseServerClient()
    const { data: { user } } = await auth.auth.getUser()
    const provider = getPaymentProvider()
    if (!paymentAvailableForUser(user?.id)) return failedResponse(403, 'request')
    let guestHash: string | null = null
    if (!user) {
      // Older checkout bundles can still carry an expired Supabase session:
      // the browser then skips /guest-access while this server correctly sees
      // no authenticated user. Mint the same scoped capability here so that
      // a stale client session cannot block a guest order.
      const cookieJar = await cookies()
      const existingToken = cookieJar.get(GUEST_COOKIE)?.value
      try {
        if (existingToken) guestHash = hashGuestToken(existingToken)
      } catch { /* replace an invalid or stale capability below */ }
      if (!guestHash) {
        const token = newGuestToken()
        cookieJar.set(GUEST_COOKIE, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: GUEST_ACCESS_SECONDS,
        })
        guestHash = hashGuestToken(token)
      }
    }
    const { GarantiProvider } = await import('@/lib/payment/garanti/adapter')
    const rawIp = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    const { isIP } = await import('node:net')
    // Only the published TEST simulator may use its sample IP fallback.
    // A live observation is still a real bank request and uses the real client IP.
    const customerIp = provider instanceof GarantiProvider && provider.config.observationOnly && isIP(rawIp) !== 4 ? '192.168.0.1' : rawIp
    const locale = localeFromCookieHeader(request.headers.get('cookie'))
    const rate = await getCurrentUsdTryRate()
    const result = await initiatePayment(await boundedJson(request), user?.id ?? null,
      guestHash, createPaymentRepository(), provider, { customerIp, locale, rate })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    // Never log raw errors, secrets, customer data, order IDs or capabilities.
    const diagnostic = error instanceof PaymentStartError ? error : null
    const stage = diagnostic?.stage ?? 'request'
    const resumeUrl = diagnostic?.resumeOrderId && UUID.test(diagnostic.resumeOrderId)
      ? `/checkout/verify?orderId=${diagnostic.resumeOrderId}` : undefined
    return failedResponse(409, stage, { databaseCode: diagnostic?.databaseCode,
      internalCode: diagnostic?.code, resumeUrl, rpcReason: diagnostic?.rpcReason })
  }
}
