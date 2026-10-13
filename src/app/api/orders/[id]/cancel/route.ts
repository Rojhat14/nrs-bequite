import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { paymentDatabase, createPaymentRepository } from '@/lib/payment/repository'
import { sameOrigin } from '@/lib/payment/http'
import { UUID } from '@/lib/payment/request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (status: number, message: string, orderStatus?: string) => NextResponse.json(
  { message, ...(orderStatus ? { orderStatus } : {}) },
  { status, headers: { 'Cache-Control': 'no-store' } },
)

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return json(403, 'Geçersiz istek.')
  const { id } = await context.params
  if (!UUID.test(id)) return json(404, 'Sipariş bulunamadı.')

  const auth = await createSupabaseServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return json(401, 'İptal için hesabınıza giriş yapın.')

  const db = paymentDatabase()
  const { data: outcome, error } = await db.rpc('nrs_customer_cancel_order', {
    p_order_id: id,
    p_user_id: user.id,
  })
  if (error) {
    console.warn(JSON.stringify({ event: 'customer_order_cancel_failed', code: error.code || 'RPC_ERROR' }))
    return json(503, 'İptal durumu doğrulanamadı. Lütfen sipariş durumunuzu yeniden kontrol edin.')
  }

  if (outcome === 'cancelled') return json(200, 'Siparişiniz iptal edildi.', 'cancelled')
  if (outcome === 'paid') return json(409, 'Bu sipariş tahsil edilmiş. İptal yerine iade süreci için müşteri hizmetleriyle iletişime geçin.', 'paid')
  if (outcome === 'not_found') return json(404, 'Sipariş bulunamadı.')
  if (outcome === 'not_cancellable') return json(409, 'Bu sipariş bu ekrandan iptal edilemiyor. Sipariş durumunuzu kontrol edin.')
  if (outcome !== 'needs_reconcile') return json(503, 'İptal durumu doğrulanamadı. Lütfen daha sonra yeniden kontrol edin.')

  // A used handoff or an unresolved state may already have reached the bank.
  // Query only; never create or resend a sale from the cancellation endpoint.
  try {
    const [{ getPaymentProvider }, { GarantiProvider }, { loadGarantiOrder }, service] = await Promise.all([
      import('@/lib/payment/provider'),
      import('@/lib/payment/garanti/adapter'),
      import('@/lib/payment/garanti/order'),
      import('@/lib/payment/service'),
    ])
    const provider = getPaymentProvider()
    if (!(provider instanceof GarantiProvider)) throw new Error('provider unavailable')
    const order = await loadGarantiOrder(id)
    if (order.userId !== user.id) return json(404, 'Sipariş bulunamadı.')
    const verified = await provider.reconcile(order.merchantReference)
    if (verified.merchantReference !== order.merchantReference) throw new Error('reference mismatch')

    // Production observation mode intentionally cannot settle an order. In a
    // settlement-enabled mode, a verified definitive bank failure can safely
    // release the reservation through the existing idempotent finalize RPC.
    if (verified.status === 'failed' && !provider.settlementDisabled) {
      service.validateVerifiedPayment(verified, provider)
      await createPaymentRepository().finalizeAtomic(verified, provider.name)
      return json(200, 'Banka işlemi reddedildi; sipariş iptal edildi.', 'cancelled')
    }
    if (verified.status === 'paid') throw new Error('settlement requires signed return')
  } catch {
    // Callback may have won the race while orderinq was in flight. Read only
    // this owner's public order status before choosing the customer message.
  }

  const { data: current, error: readError } = await db.from('orders').select('status')
    .eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!readError && current?.status === 'paid') {
    return json(409, 'Bu sipariş tahsil edilmiş. İptal yerine iade süreci için müşteri hizmetleriyle iletişime geçin.', 'paid')
  }
  if (!readError && current?.status === 'cancelled') return json(200, 'Siparişiniz iptal edildi.', 'cancelled')
  return json(202, 'Ödeme sonucu kontrol ediliyor. Siparişiniz iptal edilmedi.', 'checking')
}
