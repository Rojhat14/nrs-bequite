import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { boundedJson, sameOrigin } from '@/lib/payment/http'
import { CheckoutCustomerFieldError, parseCheckoutInput } from '@/lib/payment/request'
import { createPaymentRepository } from '@/lib/payment/repository'
import { localeFromCookieHeader } from '@/lib/i18n/messages'
import { getCurrentUsdTryRate } from '@/lib/i18n/rates'
import { CheckoutVariantUnavailableError } from '@/lib/payment/variant-unavailable'

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 403 })
  if (process.env.ORDER_DATABASE_VERIFIED !== 'true') return NextResponse.json({ error: 'Kayıtlı sipariş henüz kullanıma açılmadı. WhatsApp üzerinden iletişime geçebilirsiniz.' }, { status: 503 })
  try {
    const auth = await createSupabaseServerClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Siparişi kaydetmek için hesabınıza giriş yapın.' }, { status: 401 })
    const input = parseCheckoutInput(await boundedJson(request))
    const display = { locale: localeFromCookieHeader(request.headers.get('cookie')), rate: await getCurrentUsdTryRate() }
    return NextResponse.json(await createPaymentRepository(true).quote(input.items, input.customer, user.id, display), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof CheckoutVariantUnavailableError) return NextResponse.json({ code: error.code, productId: error.productId, error: 'Sepetinizdeki beden artık kullanılamıyor. Bu ürünü kaldırıp güncel bedenlerden yeniden seçin.' }, { status: 409 })
    if (error instanceof CheckoutCustomerFieldError) return NextResponse.json({ code: error.code, field: error.field, reason: error.reason }, { status: 422 })
    return NextResponse.json({ error: 'Ürün, stok veya kesin teslimat koşulları doğrulanamadı.' }, { status: 409 })
  }
}
