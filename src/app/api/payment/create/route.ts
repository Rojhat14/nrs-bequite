import { NextResponse } from 'next/server'
export async function POST(request: Request) {
  if (process.env.PAYMENT_ENABLED !== 'true') return NextResponse.json(
    { error: 'Online ödeme şu anda kullanılamıyor. Lütfen bizimle iletişime geçin.' }, { status: 503 })
  const { paymentAvailable, getPaymentProvider } = await import('@/lib/payment/provider')
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
    const result = await initiatePayment(await boundedJson(request), user.id,
      null, createPaymentRepository(), getPaymentProvider())
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    // No raw provider errors, secrets, customer data or tokens in logs/response.
    return NextResponse.json({ error: 'Ödeme başlatılamadı. Özeti kontrol edin; işleminiz bankaya iletildiyse yeniden ödeme yapmadan bizimle iletişime geçin.' }, { status: 409 })
  }
}
