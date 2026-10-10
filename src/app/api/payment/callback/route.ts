import { NextResponse } from 'next/server'
export async function POST(request: Request) {
  if (process.env.PAYMENT_ENABLED !== 'true') return NextResponse.json(
    { error: 'Online ödeme şu anda kullanılamıyor. Lütfen bizimle iletişime geçin.' }, { status: 503 })
  const { paymentAvailable, getPaymentProvider } = await import('@/lib/payment/provider')
  const { unavailable, boundedText } = await import('@/lib/payment/http')
  if (!paymentAvailable()) return unavailable()
  try {
    const { createPaymentRepository } = await import('@/lib/payment/repository')
    const { processPaymentCallback } = await import('@/lib/payment/service')
    const provider = getPaymentProvider()
    await processPaymentCallback(await boundedText(request), request.headers, createPaymentRepository(), provider)
    return provider.callbackResponse()
  } catch { return NextResponse.json({ error: 'Ödeme bildirimi doğrulanamadı.' }, { status: 400 }) }
}
