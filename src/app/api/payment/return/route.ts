import { NextResponse } from 'next/server'
import { paymentAvailable, getPaymentProvider } from '@/lib/payment/provider'
import { boundedText, unavailable } from '@/lib/payment/http'
import { validateVerifiedPayment } from '@/lib/payment/service'
import { createPaymentRepository } from '@/lib/payment/repository'
import { UUID } from '@/lib/payment/request'
export async function POST(request: Request) {
  if (!paymentAvailable()) return unavailable()
  try {
    const provider = getPaymentProvider()
    const payment = await provider.verifyReturn(await boundedText(request), request.headers)
    validateVerifiedPayment(payment, provider)
    if (!UUID.test(payment.merchantReference)) throw new Error('Invalid order reference.')
    await createPaymentRepository().finalizeAtomic(payment, provider.name)
    return NextResponse.redirect(new URL(`/checkout/verify?orderId=${encodeURIComponent(payment.merchantReference)}`, request.url), 303)
  } catch { return NextResponse.redirect(new URL('/checkout/failure', request.url), 303) }
}
// A browser GET return is not evidence of payment. Display only DB state under
// authenticated ownership; ignore all claimed status/amount/transaction fields.
export async function GET(request: Request) {
  if (!paymentAvailable()) return unavailable()
  const id = new URL(request.url).searchParams.get('orderId')
  return NextResponse.redirect(new URL(id && UUID.test(id) ? `/checkout/verify?orderId=${id}` : '/checkout/failure', request.url), 303)
}
