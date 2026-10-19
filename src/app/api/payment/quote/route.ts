import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { paymentAvailable, paymentAvailableForUser, getPaymentProvider } from '@/lib/payment/provider'
import { createPaymentRepository } from '@/lib/payment/repository'
import { parseCheckoutInput } from '@/lib/payment/request'
import { boundedJson, sameOrigin, unavailable } from '@/lib/payment/http'
import { localeFromCookieHeader } from '@/lib/i18n/messages'
import { getCurrentUsdTryRate } from '@/lib/i18n/rates'
import { CheckoutVariantUnavailableError } from '@/lib/payment/variant-unavailable'
export async function POST(request: Request) {
  if (!paymentAvailable()) return unavailable()
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 403 })
  try {
    const auth = await createSupabaseServerClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Kartla ödeme için hesabınıza giriş yapın.' }, { status: 401 })
    if (!paymentAvailableForUser(user.id)) return NextResponse.json({ error: 'Kartla ödeme bu hesap için açık değil.' }, { status: 403 })
    const input = parseCheckoutInput(await boundedJson(request))
    const display = { locale: localeFromCookieHeader(request.headers.get('cookie')), rate: await getCurrentUsdTryRate() }
    const quote = await createPaymentRepository().quote(input.items, input.customer, user.id, display)
    const cap = getPaymentProvider().initiationMaxAmountMinor
    if (cap != null && Math.round(quote.summary.total * 100) > cap) return NextResponse.json({ error: 'Sipariş tutarı kontrollü canlı deneme üst sınırını aşıyor.' }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.json(quote, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof CheckoutVariantUnavailableError) return NextResponse.json({ code: error.code, productId: error.productId, error: 'Sepetinizdeki beden artık kullanılamıyor. Bu ürünü kaldırıp güncel bedenlerden yeniden seçin.' }, { status: 409 })
    return NextResponse.json({ error: 'Ürün, stok veya teslimat bilgileri doğrulanamadı.' }, { status: 409 })
  }
}
