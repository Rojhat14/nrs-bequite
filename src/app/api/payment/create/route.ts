import { NextResponse } from 'next/server'
import { PaymentStartError } from '@/lib/payment/start-error'
import { UUID } from '@/lib/payment/request'
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
    if (!user) return NextResponse.json({ error: 'Kartla ödeme için hesabınıza giriş yapın.' }, { status: 401 })
    const provider = getPaymentProvider()
    if (!paymentAvailableForUser(user.id)) return NextResponse.json({ error: 'Kartla ödeme bu hesap için açık değil.' }, { status: 403 })
    const rawIp = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    const { isIP } = await import('node:net')
    // The bank's published TEST example IP lets IPv6 users exercise this
    // observation-only simulator. Actual/live payments never use this fallback.
    const customerIp = provider.settlementDisabled && isIP(rawIp) !== 4 ? '192.168.0.1' : rawIp
    const result = await initiatePayment(await boundedJson(request), user.id,
      null, createPaymentRepository(), provider, { customerIp })
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
      : 'Ödeme başlatılamadı. Özeti kontrol edin; işleminiz bankaya iletildiyse yeniden ödeme yapmadan bizimle iletişime geçin.'
    return NextResponse.json({ error: message, code, stage, ...(diagnostic?.databaseCode ? { databaseCode: diagnostic.databaseCode } : {}), ...(resumeUrl ? { resumeUrl } : {}) }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
  }
}
