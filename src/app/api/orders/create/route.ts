import { NextResponse } from 'next/server'
import { createHash, randomUUID } from 'node:crypto'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { boundedJson, sameOrigin } from '@/lib/payment/http'
import { parsePaymentRequest } from '@/lib/payment/request'
import { createPaymentRepository, paymentDatabase } from '@/lib/payment/repository'
import { prepareOrderLegalRecord } from '@/lib/legal/payment-preflight'

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 403 })
  if (process.env.ORDER_DATABASE_VERIFIED !== 'true') return NextResponse.json({ error: 'Kayıtlı sipariş henüz kullanıma açılmadı. WhatsApp üzerinden iletişime geçebilirsiniz.' }, { status: 503 })
  try {
    const auth = await createSupabaseServerClient()
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Siparişi kaydetmek için hesabınıza giriş yapın.' }, { status: 401 })
    const input = parsePaymentRequest(await boundedJson(request))
    const id = randomUUID()
    const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    // Check retries before repricing: stock/price may change after a committed order.
    const db = paymentDatabase()
    const previous = await db.from('orders').select('id,user_id,manual_request_hash').eq('manual_request_key', input.idempotencyKey).maybeSingle()
    if (previous.error) throw new Error('Order unavailable')
    if (previous.data) {
      if (previous.data.user_id !== user.id || previous.data.manual_request_hash !== hash) throw new Error('Retry mismatch')
      return NextResponse.json({ orderId: previous.data.id, paid: false }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const quote = await createPaymentRepository(true).quote(input.items, input.customer)
    if (quote.hash !== input.quoteHash) throw new Error('Quote changed')
    const legal = prepareOrderLegalRecord(id, input, quote.summary)
    const { data, error } = await db.rpc('nrs_create_manual_order', { p_order_id: id, p_user_id: user.id,
      p_key: input.idempotencyKey, p_hash: hash, p_items: input.items, p_customer: input.customer, p_legal: legal })
    if (error || !data?.id) throw new Error('Order unavailable')
    return NextResponse.json({ orderId: data.id, paid: false }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: 'Sipariş kaydedilemedi. Özeti yeniden kontrol edin; ödeme yapılmadı.' }, { status: 409 }) }
}
