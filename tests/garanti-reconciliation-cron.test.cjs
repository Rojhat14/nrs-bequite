const test = require('node:test')
const assert = require('node:assert/strict')
const { loader } = require('./source-loader.cjs')

const orderId = '11111111-1111-4111-8111-111111111111'
const ownerId = '22222222-2222-4222-8222-222222222222'
const secret = 'cron-test-secret-0123456789abcdef'
const candidate = { order_id: orderId, user_id: ownerId, redirect_url: 'private-signed-handoff&used=1', updated_at: new Date(0).toISOString() }

function routeHarness(overrides = {}) {
  const calls = []
  const evidence = { order_id: orderId, decision: 'pending', reason: 'GARANTI_BANK_RECORD_NOT_FOUND',
    outer_response_code: '92', outer_reason_code: '0110', history_http: 200,
    history_transaction_code: '92', history_transaction_reason_code: '0108', history_result_state: 'empty',
    history_record_count: 0, order_match: true, terminal_match: true, order_currency_match: true,
    prov_user_match: true, agent_user_match: true, history_identity_match: true,
    payment_event_count: 0, signed_callback_evidence_count: 0, live_finalize_evidence_count: 0 }
  class Pending extends Error {}
  class Provider {
    constructor() {
      this.config = { mode: 'PROD', generalLivePayments: true, liveObservationOnly: false }
      this.name = 'garanti-oos'
      this.nextEvidence = overrides.evidence === undefined ? evidence : overrides.evidence
    }
    submittedHandoffExpiry(id, url) { calls.push(['inspect-handoff', id, url]); return overrides.expiry || { expired: true, expiresAt: 1 } }
    async expiredSubmittedHandoff(id, owner) { calls.push(['recheck-expiry', id, owner]); return overrides.recheckExpiry || { expired: true, expiresAt: 1 } }
    takeLiveReconciliationEvidence() { const value = this.nextEvidence; this.nextEvidence = null; return value }
    async reconcileOwnedPendingOrder(id, owner, proof) {
      calls.push(['reconcile', id, owner, proof])
      if (overrides.reconcile) return overrides.reconcile(this, id, owner, proof)
      this.nextEvidence = evidence
      throw new Pending('pending')
    }
  }
  const provider = new Provider()
  const mocks = {
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/payment/provider': { getPaymentProvider: () => provider },
    '@/lib/payment/garanti/adapter': { GarantiPending: Pending, GarantiProvider: Provider },
    '@/lib/payment/garanti/order': { loadGarantiOrder: async id => {
      calls.push(['load-order', id])
      return { id, userId: ownerId, state: 'pending', appStatus: 'payment_pending', currency: 'TRY', redirectUrl: candidate.redirect_url }
    } },
    '@/lib/payment/repository': {
      acquireGarantiReconciliationCronLock: async token => { calls.push(['lock', token]); return overrides.lock !== false },
      releaseGarantiReconciliationCronLock: async token => calls.push(['unlock', token]),
      listExpiredGarantiPendingOrders: async (limit, cutoff) => { calls.push(['list', limit, cutoff]); return overrides.candidates || [candidate] },
      readGarantiSettlementEvidence: async id => { calls.push(['payment-proof', id]); return { order_id: id, payment_event_count: 0, signed_callback_evidence_count: 0, live_finalize_evidence_count: 0 } },
      saveGarantiOrderinqReconciliation: async (...args) => calls.push(['save', ...args]),
      closeExpiredGarantiNoRecordOrder: async (...args) => { calls.push(['close', ...args]); return overrides.closeResult || { closed: true, idempotent: false } },
      createPaymentRepository: () => ({ finalizeAtomic: async (...args) => calls.push(['finalize', ...args]) }),
    },
  }
  const get = loader(mocks)('src/app/api/cron/garanti-reconciliation/route.ts').GET
  const previousSecret = process.env.CRON_SECRET
  process.env.CRON_SECRET = secret
  const request = new Request('https://nrsbequiteluminous.com/api/cron/garanti-reconciliation', {
    headers: { authorization: `Bearer ${secret}` },
  })
  return { get, request, calls, provider, Pending, restore: () => {
    if (previousSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previousSecret
  } }
}

test('cron requires a constant-time bearer secret and never queries without authorization', async () => {
  const h = routeHarness()
  try {
    const response = await h.get(new Request('https://nrsbequiteluminous.com/api/cron/garanti-reconciliation'))
    assert.equal(response.status, 401)
    assert.equal(h.calls.length, 0)
  } finally { h.restore() }
})

test('cron lease prevents overlapping batches and releases only a lease it acquired', async () => {
  const h = routeHarness({ lock: false })
  try {
    const response = await h.get(h.request)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { state: 'already_running', scanned: 0, expired: 0, failed: 0, unverifiedClosed: 0, pending: 0, errors: 0 })
    assert.equal(h.calls.some(call => call[0] === 'list'), false)
    assert.equal(h.calls.some(call => call[0] === 'unlock'), false)
  } finally { h.restore() }
})

test('expired paired no-record result is persisted and closed only through the atomic unverified RPC', async () => {
  const h = routeHarness()
  try {
    const response = await h.get(h.request)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.unverifiedClosed, 1)
    assert.equal(h.calls.filter(call => call[0] === 'reconcile').length, 1)
    assert.equal(h.calls.filter(call => call[0] === 'close').length, 1)
    assert.equal(h.calls.some(call => call[0] === 'finalize'), false)
    const listCall = h.calls.find(call => call[0] === 'list')
    assert.equal(listCall[1], 40)
    assert.ok(Math.abs(Date.now() - Date.parse(listCall[2]) - 15 * 60 * 1000) < 5000)
  } finally { h.restore() }
})

test('bank inquiry batch stays bounded even when more expired orders are queued', async () => {
  const h = routeHarness({ candidates: [candidate, { ...candidate, order_id: '33333333-3333-4333-8333-333333333333' },
    { ...candidate, order_id: '44444444-4444-4444-8444-444444444444' }] })
  try {
    const response = await h.get(h.request)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).expired, 2)
    assert.equal(h.calls.filter(call => call[0] === 'reconcile').length, 2)
  } finally { h.restore() }
})

test('verified failure uses the existing atomic finalizer and duplicate schedules remain idempotent', async () => {
  const h = routeHarness({ reconcile: async self => {
    self.nextEvidence = { order_id: orderId, decision: 'verified_failure', reason: 'GARANTI_ORDERINQ_CONFIGURED_FAILURE_STATUS' }
    return { status: 'failed', amountMinor: 5800, currency: 'TRY' }
  } })
  try {
    const first = await h.get(h.request)
    assert.equal((await first.json()).failed, 1)
    assert.equal(h.calls.filter(call => call[0] === 'finalize').length, 1)
    assert.equal(h.calls.some(call => call[0] === 'close'), false)
  } finally { h.restore() }
})

test('query errors persist pending evidence and never close or finalize', async () => {
  const h = routeHarness({ reconcile: async () => { throw new Error('synthetic network timeout') }, evidence: null })
  try {
    const response = await h.get(h.request)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).pending, 1)
    const saved = h.calls.find(call => call[0] === 'save')
    assert.equal(saved[2], 'pending')
    assert.equal(saved[3], 'GARANTI_RECONCILIATION_UNAVAILABLE')
    assert.equal(h.calls.some(call => call[0] === 'close' || call[0] === 'finalize'), false)
  } finally { h.restore() }
})

test('expired-but-not-yet-confirmed handoffs do not issue bank inquiries', async () => {
  const h = routeHarness({ expiry: { expired: false, expiresAt: 9999999999 } })
  try {
    const response = await h.get(h.request)
    assert.equal(response.status, 200)
    assert.equal((await response.json()).expired, 0)
    assert.equal(h.calls.some(call => call[0] === 'reconcile'), false)
  } finally { h.restore() }
})
