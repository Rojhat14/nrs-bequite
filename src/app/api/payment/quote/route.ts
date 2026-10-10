import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { paymentAvailable } from '@/lib/payment/provider'
import { createPaymentRepository } from '@/lib/payment/repository'
import { parseCheckoutInput } from '@/lib/payment/request'
import { boundedJson, sameOrigin, unavailable } from '@/lib/payment/http'
export async function POST(request: Request) {
  if (!paymentAvailable()) return unavailable()
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 403 })
  try {
    const auth = await createSupabaseServerClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Kartla ödeme için hesabınıza giriş yapın.' }, { status: 401 })
    const input = parseCheckoutInput(await boundedJson(request))
    return NextResponse.json(await createPaymentRepository().quote(input.items, input.customer), { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: 'Ürün, stok veya teslimat bilgileri doğrulanamadı.' }, { status: 409 }) }
}
