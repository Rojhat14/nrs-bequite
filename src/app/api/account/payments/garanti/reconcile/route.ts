import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getPaymentProvider } from '@/lib/payment/provider'
import { controlledLiveAccountAllowed } from '@/lib/payment/garanti/config'
import { GarantiPending, GarantiProvider } from '@/lib/payment/garanti/adapter'
import { loadGarantiOrder } from '@/lib/payment/garanti/order'
import { createPaymentRepository, saveGarantiOrderinqReconciliation } from '@/lib/payment/repository'
import { sameOrigin, boundedJson } from '@/lib/payment/http'
import { UUID } from '@/lib/payment/request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const targetOrderId = '32ec756b-8fe2-4c9b-aae2-e34a49248ba9'
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
})

// One-account, exact-order reconciliation. This endpoint can only issue read-only
// orderinq/orderhistoryinq queries; it never creates a sale, cancellation or refund.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json(403, { state: 'unavailable' })
  const auth = await createSupabaseServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user || !controlledLiveAccountAllowed(user.id)) return json(404, { state: 'unavailable' })
  let body: unknown
  try { body = await boundedJson(request) } catch { return json(400, { state: 'unavailable' }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== 1 || typeof (body as { orderId?: unknown }).orderId !== 'string'
    || !UUID.test((body as { orderId: string }).orderId)
    || (body as { orderId: string }).orderId !== targetOrderId) return json(404, { state: 'unavailable' })

  let provider: GarantiProvider | null = null
  try {
    const selected = getPaymentProvider()
    if (!(selected instanceof GarantiProvider) || !selected.config.liveObservationOnly) return json(503, { state: 'pending' })
    provider = selected
    const order = await loadGarantiOrder(targetOrderId)
    if (order.userId !== user.id || order.state !== 'pending' || order.amountMinor !== 300 || order.currency !== 'TRY') {
      return json(404, { state: 'unavailable' })
    }
    const payment = await provider.reconcileOwnedPendingOrder(order.id, user.id)
    const evidence = provider.takeLiveReconciliationEvidence()
    if (payment.status === 'failed' && evidence?.decision === 'verified_failure') {
      await saveGarantiOrderinqReconciliation(order.id, 'verified_failure', evidence.reason, evidence)
      await createPaymentRepository().finalizeAtomic(payment, provider.name)
      return json(200, { state: 'failed' })
    }
    const reason = 'GARANTI_SIGNED_SUCCESS_RETURN_REQUIRED'
    await saveGarantiOrderinqReconciliation(order.id, 'pending', reason, { ...(evidence || {}), decision: 'pending', reason })
    return json(202, { state: 'pending' })
  } catch (error) {
    if (provider) {
      const evidence = provider.takeLiveReconciliationEvidence()
      if (evidence && evidence.order_id === targetOrderId) {
        const reason = error instanceof GarantiPending ? evidence.reason : 'GARANTI_RECONCILIATION_UNAVAILABLE'
        try { await saveGarantiOrderinqReconciliation(targetOrderId, 'pending', reason, { ...evidence, decision: 'pending', reason }) }
        catch { console.warn(JSON.stringify({ event: 'garanti_reconciliation_evidence_store_failed', order_id: targetOrderId })) }
      }
    }
    return json(202, { state: 'pending' })
  }
}
