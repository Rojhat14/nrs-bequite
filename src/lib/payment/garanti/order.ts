import 'server-only'
import { paymentDatabase } from '@/lib/payment/repository'
import { UUID } from '@/lib/payment/request'
import { assertFinalLegalOrderSummary } from '@/lib/legal/order-summary'
import type { PaymentOrder } from '@/lib/payment/types'
import { garantiLiveSingleFinalizeArmed, garantiSingleFinalizeTest } from './config'

export interface StoredGarantiOrder extends PaymentOrder { userId: string; redirectUrl: string | null }
// Bank returns use server credentials and a verified bank signature, not cookies.
export async function loadGarantiOrder(reference: string): Promise<StoredGarantiOrder> {
  if (!UUID.test(reference)) throw new Error('Invalid payment reference.')
  const db = paymentDatabase()
  const { data: p, error } = await db.from('payment_orders')
    .select('order_id,user_id,merchant_reference,amount_minor,currency,state,provider,redirect_url')
    .eq('merchant_reference', reference).maybeSingle()
  if (error || !p || p.provider !== 'garanti-oos' || p.order_id !== reference || p.currency !== 'TRY') throw new Error('Payment order unavailable.')
  const { data: legal, error: legalError } = await db.from('order_legal_records').select('*').eq('order_id', p.order_id).single()
  if (legalError || !legal) throw new Error('Legal order record unavailable.')
  assertFinalLegalOrderSummary(legal.order_summary)
  const amountMinor = Number(p.amount_minor)
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || Math.round(legal.order_summary.total * 100) !== amountMinor) throw new Error('Payment amount mismatch.')
  return { id: p.order_id, userId: p.user_id, merchantReference: p.merchant_reference, amountMinor,
    currency: p.currency, state: p.state, legal, redirectUrl: p.redirect_url }
}
// Existing redirect column is a one-use handoff capability. Atomic compare-and-set
// across instances prevents two browsers/requests from submitting the bank form.
// A lost response remains pending and requires reconciliation, never recharging.
export async function claimGarantiHandoff(order: StoredGarantiOrder, redirect: string) {
  const { data, error } = await paymentDatabase().from('payment_orders').update({ redirect_url: redirect + '&used=1' })
    .eq('order_id', order.id).eq('provider', 'garanti-oos').eq('state', 'pending').eq('redirect_url', redirect)
    .select('order_id')
  if (error || data?.length !== 1) throw new Error('Payment handoff already used.')
}
export async function renewUnsubmittedGarantiHandoff(order: StoredGarantiOrder, next: string) {
  if (!order.redirectUrl || new URL(order.redirectUrl).searchParams.has('used')) throw new Error('Handoff already submitted.')
  const { data, error } = await paymentDatabase().from('payment_orders').update({ redirect_url: next })
    .eq('order_id', order.id).eq('provider', 'garanti-oos').eq('state', 'pending').eq('redirect_url', order.redirectUrl)
    .select('order_id')
  if (error || data?.length !== 1) throw new Error('Handoff changed or already submitted.')
}
export async function testHandoffUnsubmitted(authorizedOrderId: string) {
  try {
    const { data, error } = await paymentDatabase().from('payment_orders').select('state,provider,redirect_url').eq('order_id', authorizedOrderId).single()
    return !error && data?.provider === 'garanti-oos' && data.state === 'pending'
      && !!data.redirect_url && !new URL(data.redirect_url).searchParams.has('used')
  } catch { return false }
}

// The one-order TEST exception is bound to a row claimed atomically by the
// isolated order-creation RPC. No browser-supplied account or order ID grants it.
export async function isGarantiSingleFinalizeOrder(order: StoredGarantiOrder) {
  if (!garantiSingleFinalizeTest() || order.state !== 'pending' || order.currency !== 'TRY') return false
  try {
    const { data, error } = await paymentDatabase().from('garanti_test_single_finalize_allowances')
      .select('order_id').eq('project_ref', 'dzuxhwtbuojnhibzfxqy')
      .eq('site_origin', 'https://nrs-bequite-garanti-test.vercel.app')
      .eq('user_id', order.userId).eq('order_id', order.id).maybeSingle()
    return !error && data?.order_id === order.id
  } catch { return false }
}
export async function isGarantiLiveSingleFinalizeOrder(order: StoredGarantiOrder) {
  if (order.state !== 'pending' || order.currency !== 'TRY'
    || !garantiLiveSingleFinalizeArmed(order.userId, order.amountMinor)) return false
  try {
    const { data, error } = await paymentDatabase().from('garanti_live_single_finalize_allowances')
      .select('order_id').eq('user_id', order.userId).eq('order_id', order.id).maybeSingle()
    return !error && data?.order_id === order.id
  } catch { return false }
}
