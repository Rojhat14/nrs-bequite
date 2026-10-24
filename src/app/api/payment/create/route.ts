import { NextResponse } from 'next/server'
import { PaymentStartError } from '@/lib/payment/start-error'
import { UUID } from '@/lib/payment/request'
import { localeFromCookieHeader } from '@/lib/i18n/messages'
import { getCurrentUsdTryRate } from '@/lib/i18n/rates'
import { cookies } from 'next/headers'
import { GUEST_ACCESS_SECONDS, GUEST_COOKIE, hashGuestToken, newGuestToken } from '@/lib/payment/access'
export async function POST(request: Request) {
  if (process.env.PAYMENT_ENABLED !== 'true') return NextResponse.json(
    { error: 'Online ödeme şu anda kullanılamıyor. Lütfen bizimle iletişime geçin.' }, { status: 503 })
  const { paymentAvailable, paymentAvailableForUser, getPaymentProvider } = await import('@/lib/payment/provider')
  const { boundedJson, sameOrigin, unavailable } = await import('@/lib/payment/http')
  if (!paymentAvailable()) return unavailable()
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 403 })
  try {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server')
    const { createPaymentRepository } = await import('@/lib/payment/repository')
    const { initiatePayment } = await import('@/lib/payment/service')
    const auth = await createSupabaseServerClient()
    const { data: { user } } = await auth.auth.getUser()
    const provider = getPaymentProvider()
    if (!paymentAvailableForUser(user?.id)) return NextResponse.json({ error: 'Kartla ödeme şu anda kullanılamıyor.' }, { status: 403 })
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
    // No raw provider errors, secrets, customer data or tokens in logs/response.
    const diagnostic = error instanceof PaymentStartError ? error : null
    const code = diagnostic?.code ?? 'START_FAILED'
    const stage = diagnostic?.stage ?? 'request'
    console.warn(JSON.stringify({ event: 'payment_start_rejected', endpoint: '/api/payment/create', http: 409, code, stage, ...(diagnostic?.databaseCode ? { databaseCode: diagnostic.databaseCode } : {}) }))
    const resumeUrl = diagnostic?.resumeOrderId && UUID.test(diagnostic.resumeOrderId)
      ? `/checkout/verify?orderId=${diagnostic.resumeOrderId}` : undefined
    const message = code === 'UNRESOLVED_PAYMENT' ? 'Bekleyen bir siparişiniz var. Yeni sipariş oluşturulmadı; önce mevcut siparişinize devam edin.'
      : code === 'TEST_HANDOFF_SUBMITTED' ? 'Bu test siparişi bankaya gönderilmiş. Sonuç doğrulanmadan tekrar ödeme başlatılmadı.'
      : code === 'CONTROLLED_ITEM_REQUIRED' ? 'Bu ürün, tek kullanımlık canlı ödeme izni kapsamında değil. Ödeme başlatılmadı.'
      : 'Ödeme başlatılamadı. Özeti kontrol edin; işleminiz bankaya iletildiyse yeniden ödeme yapmadan bizimle iletişime geçin.'
    return NextResponse.json({ error: message, code, stage, ...(diagnostic?.databaseCode ? { databaseCode: diagnostic.databaseCode } : {}), ...(resumeUrl ? { resumeUrl } : {}) }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
  }
}
