import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { boundedJson, sameOrigin } from '@/lib/payment/http'
import { parseCheckoutInput } from '@/lib/payment/request'
import { createPaymentRepository } from '@/lib/payment/repository'

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 403 })
  if (process.env.ORDER_DATABASE_VERIFIED !== 'true') return NextResponse.json({ error: 'Kayıtlı sipariş henüz kullanıma açılmadı. WhatsApp üzerinden iletişime geçebilirsiniz.' }, { status: 503 })
  try {
    const auth = await createSupabaseServerClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Siparişi kaydetmek için hesabınıza giriş yapın.' }, { status: 401 })
    const input = parseCheckoutInput(await boundedJson(request))
    return NextResponse.json(await createPaymentRepository(true).quote(input.items, input.customer), { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: 'Ürün, stok veya kesin teslimat koşulları doğrulanamadı.' }, { status: 409 }) }
}
