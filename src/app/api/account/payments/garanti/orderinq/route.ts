import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getPaymentProvider } from '@/lib/payment/provider'
import { controlledLiveAccountAllowed } from '@/lib/payment/garanti/config'
import { GarantiProvider } from '@/lib/payment/garanti/adapter'
import { loadGarantiOrder } from '@/lib/payment/garanti/order'
import { sameOrigin, boundedJson } from '@/lib/payment/http'
import { UUID } from '@/lib/payment/request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const allowedOrders = new Set([
  'fcccca17-ae6b-4940-9586-8679db7ee303',
  '90dc5d66-397f-4b91-8f70-fb4634cfdc94',
])
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
})

// Private one-account read-only query. It accepts only the two existing order
// references; it has no cancellation, sale, or payment-finalization operation.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json(403, { error: 'INVALID_ORIGIN' })
  const auth = await createSupabaseServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user || !controlledLiveAccountAllowed(user.id)) return json(404, { error: 'NOT_FOUND' })

  let body: unknown
  try { body = await boundedJson(request) } catch { return json(400, { error: 'INVALID_REQUEST' }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== 1 || typeof (body as { orderId?: unknown }).orderId !== 'string') {
    return json(400, { error: 'INVALID_REQUEST' })
  }
  const orderId = (body as { orderId: string }).orderId
  if (!UUID.test(orderId) || !allowedOrders.has(orderId)) return json(404, { error: 'NOT_FOUND' })

  try {
    const provider = getPaymentProvider()
    if (!(provider instanceof GarantiProvider) || !provider.config.liveObservationOnly) return json(503, { error: 'LIVE_OBSERVATION_UNAVAILABLE' })
    const order = await loadGarantiOrder(orderId)
    if (order.userId !== user.id) return json(404, { error: 'NOT_FOUND' })
    const evidence = await provider.readOnlyOrderInquiry(order, user.id)
    return json(200, evidence)
  } catch {
    // Never return XML, passwords, hashes, cards, buyer data or exception text.
    console.warn(JSON.stringify({ event: 'garanti_live_read_only_orderinq_failed', order_id: orderId, code: 'QUERY_UNAVAILABLE' }))
    return json(502, { error: 'QUERY_UNAVAILABLE', orderId })
  }
}
