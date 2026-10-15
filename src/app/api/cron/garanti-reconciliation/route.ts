import { randomUUID, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getPaymentProvider } from '@/lib/payment/provider'
import { GarantiPending, GarantiProvider } from '@/lib/payment/garanti/adapter'
import { loadGarantiOrder } from '@/lib/payment/garanti/order'
import {
  acquireGarantiReconciliationCronLock,
  closeExpiredGarantiNoRecordOrder,
  createPaymentRepository,
  listExpiredGarantiPendingOrders,
  readGarantiSettlementEvidence,
  releaseGarantiReconciliationCronLock,
  saveGarantiOrderinqReconciliation,
} from '@/lib/payment/repository'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CANDIDATE_SCAN_LIMIT = 40
const BANK_RECONCILIATION_LIMIT = 2
const HANDOFF_TTL_SECONDS = 15 * 60
const json = (status: number, body: Record<string, unknown>) => NextResponse.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
})

function authorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET
  const authorization = request.headers.get('authorization') || ''
  if (!secret || secret.length < 16) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(authorization)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// Vercel invokes this route on a schedule. It performs only read-only bank
// inquiries, then delegates all state changes to the existing atomic RPCs.
export async function GET(request: Request) {
  if (!authorizedCronRequest(request)) return json(401, { state: 'unavailable' })

  let provider: GarantiProvider
  try {
    const selected = getPaymentProvider()
    if (!(selected instanceof GarantiProvider) || selected.config.mode !== 'PROD'
      || selected.config.generalLivePayments !== true || selected.config.liveObservationOnly) {
      return json(503, { state: 'unavailable' })
    }
    provider = selected
  } catch { return json(503, { state: 'unavailable' }) }

  const leaseToken = randomUUID()
  let lockAcquired = false
  const counts = { scanned: 0, expired: 0, failed: 0, unverifiedClosed: 0, pending: 0, errors: 0 }
  const startedAt = Date.now()
  try {
    lockAcquired = await acquireGarantiReconciliationCronLock(leaseToken)
    if (!lockAcquired) return json(200, { state: 'already_running', ...counts })

    // The timestamp only narrows candidates based on the app's 15-minute
    // signed handoff TTL. The signed token expiry is verified again below.
    const cutoff = new Date(Date.now() - HANDOFF_TTL_SECONDS * 1000).toISOString()
    const candidates = await listExpiredGarantiPendingOrders(CANDIDATE_SCAN_LIMIT, cutoff)
    counts.scanned = candidates.length
    let attempted = 0
    for (const candidate of candidates) {
      if (attempted >= BANK_RECONCILIATION_LIMIT || Date.now() - startedAt > 30_000) break
      const handoff = provider.submittedHandoffExpiry(candidate.order_id, candidate.redirect_url)
      if (!handoff?.expired) continue
      attempted++
      counts.expired++
      let evidence: ReturnType<GarantiProvider['takeLiveReconciliationEvidence']> = null
      let verifiedFailureStored = false
      try {
        const order = await loadGarantiOrder(candidate.order_id)
        if (order.userId !== candidate.user_id || order.state !== 'pending' || order.appStatus !== 'payment_pending'
          || order.currency !== 'TRY' || !order.redirectUrl
          || provider.submittedHandoffExpiry(order.id, order.redirectUrl)?.expiresAt !== handoff.expiresAt) {
          counts.pending++
          continue
        }
        const paymentProof = await readGarantiSettlementEvidence(order.id)
        const payment = await provider.reconcileOwnedPendingOrder(order.id, order.userId, paymentProof)
        evidence = provider.takeLiveReconciliationEvidence()
        if (payment.status === 'failed' && evidence?.decision === 'verified_failure') {
          await saveGarantiOrderinqReconciliation(order.id, 'verified_failure', evidence.reason, evidence)
          verifiedFailureStored = true
          await createPaymentRepository().finalizeAtomic(payment, provider.name)
          counts.failed++
          continue
        }
        const reason = evidence?.reason || 'GARANTI_RECONCILIATION_UNCLASSIFIED'
        await saveGarantiOrderinqReconciliation(order.id, 'pending', reason,
          { ...(evidence || {}), order_id: order.id, decision: 'pending', reason })
        counts.pending++
      } catch (error) {
        if (verifiedFailureStored) { counts.errors++; continue }
        evidence ||= provider.takeLiveReconciliationEvidence()
        const reason = error instanceof GarantiPending && evidence?.reason
          ? evidence.reason : 'GARANTI_RECONCILIATION_UNAVAILABLE'
        try {
          await saveGarantiOrderinqReconciliation(candidate.order_id, 'pending', reason,
            { ...(evidence || {}), order_id: candidate.order_id, decision: 'pending', reason })
          if (reason === 'GARANTI_BANK_RECORD_NOT_FOUND') {
            const current = await loadGarantiOrder(candidate.order_id)
            const currentHandoff = await provider.expiredSubmittedHandoff(candidate.order_id, candidate.user_id)
            if (current.userId === candidate.user_id && current.state === 'pending'
              && current.appStatus === 'payment_pending' && current.currency === 'TRY'
              && currentHandoff?.expired && currentHandoff.expiresAt === handoff.expiresAt) {
              const closed = await closeExpiredGarantiNoRecordOrder(candidate.order_id, handoff.expiresAt)
              if (closed.closed || closed.idempotent) counts.unverifiedClosed++
              else counts.pending++
              continue
            }
          }
          counts.pending++
        } catch { counts.errors++ }
      }
    }
    return json(200, { state: 'completed', ...counts })
  } catch {
    return json(503, { state: 'unavailable', ...counts })
  } finally {
    if (lockAcquired) {
      try { await releaseGarantiReconciliationCronLock(leaseToken) }
      catch { console.warn(JSON.stringify({ event: 'garanti_cron_lock_release_failed' })) }
    }
  }
}
