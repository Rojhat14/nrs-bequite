const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs')
const { loader } = require('./source-loader.cjs')
const load = loader()
const { garantiConfig, garantiLiveGeneralPaymentsEnabled } = load('src/lib/payment/garanti/config.ts')
const { PGlite } = require('@electric-sql/pglite')
const fixture = require('./payment-security-fixture.cjs')

const allowed = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const prodEnv = {
  GARANTI_MODE: 'PROD', VERCEL_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://moiynemxthkmgpgnfajd.supabase.co',
  GARANTI_SITE_ORIGIN: 'https://nrsbequiteluminous.com',
  GARANTI_SUCCESS_URL: 'https://nrsbequiteluminous.com/api/payment/garanti/success',
  GARANTI_ERROR_URL: 'https://nrsbequiteluminous.com/api/payment/garanti/failure',
  GARANTI_HANDOFF_SECRET: 'a'.repeat(64), GARANTI_LIVE_GENERAL_PAYMENTS_ENABLED: 'true',
  GARANTI_LIVE_CONTROLLED_ONLY: 'false', GARANTI_LIVE_OBSERVATION_ONLY: 'false',
  GARANTI_LIVE_QUERY_FIELDS_CONFIRMED: 'true', GARANTI_OOS_VERIFIED: 'true', GARANTI_LIVE_APPROVED: 'true',
  GARANTI_LIVE_MERCHANT_ID: '1000001', GARANTI_LIVE_TERMINAL_ID: '12345678', GARANTI_LIVE_USER_ID: 'GARANTI',
  GARANTI_LIVE_PROVISION_USER: 'PROVAUT', GARANTI_LIVE_PROVISION_PASSWORD: 'synthetic-provision',
  GARANTI_LIVE_QUERY_USER: 'PROVAUT', GARANTI_LIVE_QUERY_AGENT_USER_ID: 'PROVAUT',
  GARANTI_LIVE_QUERY_PASSWORD: 'synthetic-query', GARANTI_LIVE_STORE_KEY: 'synthetic-store',
  GARANTI_LIVE_FORM_URL: 'https://sanalposprov.garanti.com.tr/servlet/gt3dengine',
  GARANTI_LIVE_QUERY_URL: 'https://sanalposprov.garanti.com.tr/VPServlet',
  GARANTI_CAPTURED_STATUS: 'APPROVED', GARANTI_CAPTURED_RESULT_CODE: '00', GARANTI_SALE_CHARGE_TYPE: 'S',
  GARANTI_FINAL_FAILED_STATUSES: '', GARANTI_LIVE_MAX_AMOUNT_MINOR: '',
}

test('general Production payment mode is opt-in, requires verified gates, and has no test amount cap', () => {
  assert.equal(garantiLiveGeneralPaymentsEnabled({ ...prodEnv, GARANTI_LIVE_GENERAL_PAYMENTS_ENABLED: 'false' }), false)
  const config = garantiConfig(prodEnv)
  assert.equal(config.generalLivePayments, true)
  assert.equal(config.liveObservationOnly, false)
  assert.equal(config.initiationMaxAmountMinor, null)
  for (const changes of [
    { GARANTI_LIVE_QUERY_FIELDS_CONFIRMED: 'false' },
    { GARANTI_OOS_VERIFIED: 'false' },
    { GARANTI_LIVE_APPROVED: 'false' },
    { GARANTI_LIVE_CONTROLLED_ONLY: 'true' },
    { GARANTI_LIVE_OBSERVATION_ONLY: 'true' },
    { VERCEL_ENV: 'preview' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://dzuxhwtbuojnemhibzfxqy.supabase.co' },
  ]) assert.throws(() => garantiConfig({ ...prodEnv, ...changes }))
  assert.throws(() => garantiConfig({ ...prodEnv, GARANTI_LIVE_GENERAL_PAYMENTS_ENABLED: 'false', GARANTI_LIVE_CONTROLLED_ONLY: 'false' }))
})

test('general access permits distinct authenticated users only when its explicit config mode is active', () => {
  const makeProviderModule = config => {
    class Provider { constructor() { this.name = 'garanti-oos'; this.config = config } }
    return loader({
      './config': { readPaymentConfig: () => ({ enabled: true, provider: 'garanti-oos' }), requirePaymentDeployment: () => {} },
      './garanti/adapter': { GarantiProvider: Provider },
      './garanti/config': { controlledLiveAccountAllowed: id => id === allowed },
    })('src/lib/payment/provider.ts')
  }
  const general = makeProviderModule({ mode: 'PROD', generalLivePayments: true, liveObservationOnly: false })
  assert.equal(general.paymentAvailableForUser(allowed), true)
  assert.equal(general.paymentAvailableForUser('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), true)
  assert.equal(general.paymentAvailableForUser(null), false)
  const closed = makeProviderModule({ mode: 'PROD', generalLivePayments: false, liveObservationOnly: true })
  assert.equal(closed.paymentAvailableForUser(allowed), true)
  assert.equal(closed.paymentAvailableForUser('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), false)
})

test('Production Garanti finalize requires durable order-bound success evidence before paid', async () => {
  const db = new PGlite()
  try {
    await fixture.setup(db)
    await db.exec(`CREATE TABLE public.garanti_live_single_finalize_evidence(order_id uuid,signature_verified boolean,order_match boolean,
        amount_match boolean,currency_match boolean,terminal_match boolean,request_match boolean,callback_mdstatus text,
        callback_response text,callback_procreturncode text,query_order_match boolean,query_identity_match boolean,
        query_amount_match boolean,query_result_codes_match boolean,query_status text,query_charge_type text,
        auth_date_format text,auth_code_match boolean,bank_reference_present boolean);
      CREATE TABLE public.garanti_live_single_finalize_allowances(order_id uuid);
      CREATE FUNCTION public.nrs_garanti_service_role_request() RETURNS boolean LANGUAGE sql STABLE AS $$
        SELECT coalesce(current_setting('request.jwt.claim.role',true),'')='service_role' $$;`)
    await db.exec(fs.readFileSync('supabase/migrations/20261015100000_garanti_general_payment_evidence.sql', 'utf8'))
    await fixture.create(db)
    await db.query("UPDATE public.payment_orders SET state='pending',provider='garanti-oos' WHERE order_id=$1::uuid", [fixture.orderId])
    await db.query("UPDATE public.orders SET status='payment_pending' WHERE id=$1::uuid", [fixture.orderId])
    await db.query("SELECT set_config('request.jwt.claim.role','service_role',false)")
    const payment = { ...fixture.callback(), verificationMode: 'PROD' }
    const finalize = () => db.query('SELECT public.nrs_finalize_payment($1::jsonb,$2)', [JSON.stringify(payment), 'garanti-oos'])
    await assert.rejects(finalize(), /general Garanti proof required/)
    const proof = {
      order_id: fixture.orderId, event_id: payment.eventId, transaction_id: payment.transactionId,
      merchant_id: payment.merchantId, amount_minor: payment.amountMinor, currency: 'TRY', verification_mode: 'PROD',
      signature_verified: true, signature_algorithm: 'sha1', signature_encoding: 'iso-8859-9',
      order_match: true, amount_match: true, currency_match: true, terminal_match: true, request_match: true,
      callback_mdstatus: '1', callback_response: 'approved', callback_procreturncode: '00', query_http: 200,
      query_order_match: true, query_identity_match: true, query_amount_match: true, query_result_codes_match: true,
      query_status: 'APPROVED', query_charge_type: 'S', auth_date_format: 'timestamp',
      auth_code_match: true, bank_reference_present: true,
    }
    const store = evidence => db.query('SELECT public.nrs_store_garanti_verified_payment_evidence($1::uuid,$2::jsonb)',
      [fixture.orderId, JSON.stringify(evidence)])
    await assert.rejects(store({ ...proof, amount_match: false }), /incomplete verified Garanti evidence/)
    await assert.rejects(db.query("SELECT public.nrs_store_garanti_verified_payment_evidence($1::uuid,$2::jsonb)",
      [fixture.orderId, JSON.stringify({ ...proof, raw: 'must-be-rejected' })]), /invalid Garanti verification evidence/)
    await store(proof)
    await store(proof)
    await finalize()
    await finalize()
    const state = (await db.query(`SELECT o.status,p.state,v.stock_quantity,
      (SELECT count(*)::int FROM public.payment_events WHERE order_id=$1::uuid) events,
      (SELECT count(*)::int FROM public.payment_stock_reservations WHERE order_id=$1::uuid AND NOT released) active_reservations
      FROM public.orders o JOIN public.payment_orders p ON p.order_id=o.id
      CROSS JOIN public.product_variants v WHERE o.id=$1::uuid AND v.id=$2::uuid`, [fixture.orderId, fixture.variantId])).rows[0]
    assert.deepEqual(state, { status: 'paid', state: 'paid', stock_quantity: 0, events: 1, active_reservations: 1 })
    assert.equal((await db.query("SELECT has_function_privilege('anon','public.nrs_store_garanti_verified_payment_evidence(uuid,jsonb)','EXECUTE') allowed")).rows[0].allowed, false)
    assert.equal((await db.query("SELECT has_function_privilege('authenticated','public.nrs_store_garanti_verified_payment_evidence(uuid,jsonb)','EXECUTE') allowed")).rows[0].allowed, false)
  } finally { await db.close() }
})

test('general verified callback path stores order-bound proof before calling the existing idempotent finalizer', async () => {
  const orderId = fixture.orderId, sequence = []
  class Provider {
    constructor() { this.name = 'garanti-oos'; this.merchantId = 'merchant'; this.config = { mode: 'PROD', generalLivePayments: true, siteOrigin: 'https://nrsbequiteluminous.com' } }
    async verifyReturn() { sequence.push('verified'); return { eventId: 'e', merchantId: 'merchant', merchantReference: orderId,
      transactionId: 't', amountMinor: 12000, currency: 'TRY', status: 'paid', threeDS: 'authenticated', verificationMode: 'PROD' } }
    takeSuccessfulLiveReturnEvidence() { return { order_id: orderId, signature_verified: true, order_match: true, amount_match: true,
      currency_match: true, terminal_match: true, request_match: true, callback_mdstatus: '1', callback_response: 'approved',
      callback_procreturncode: '00', query_http: 200, query_order_match: true, query_identity_match: true, query_amount_match: true,
      query_result_codes_match: true, query_status: 'APPROVED', query_charge_type: 'S', auth_date_format: 'timestamp',
      auth_code_match: true, bank_reference_present: true } }
  }
  const handler = loader({
    'next/server': { NextResponse: { redirect: url => new Response(null, { status: 303, headers: { location: String(url) } }) } },
    '@/lib/payment/provider': { paymentAvailable: () => true, getPaymentProvider: () => new Provider() },
    '@/lib/payment/http': { boundedText: async () => 'signed-synthetic-input', unavailable: () => new Response(null, { status: 503 }) },
    '@/lib/payment/repository': {
      createPaymentRepository: () => ({ finalizeAtomic: async () => sequence.push('finalized') }),
      saveGarantiVerifiedPaymentEvidence: async (payment, evidence) => {
        assert.equal(payment.merchantReference, evidence.order_id); sequence.push('evidence-stored')
      },
    },
    '@/lib/payment/service': { validateVerifiedPayment: () => {} },
    './adapter': { GarantiProvider: Provider, GarantiPending: class extends Error {} },
    './diagnostics': { diagnoseLiveReturn: () => ({}), diagnoseTestReturn: () => ({}), saveTestDiagnostic: async () => {} },
    './protocol': { GarantiReturnParseError: class extends Error {}, parseReturn: () => ({}), ReturnSignatureError: class extends Error {} },
    '@/lib/payment/request': { UUID: /^[0-9a-f-]{36}$/ },
    './order': { loadGarantiOrder: async () => ({}), isGarantiLiveSingleFinalizeOrder: async () => false, isGarantiSingleFinalizeOrder: async () => false },
    './config': { controlledLiveAccountAllowed: () => false },
  })('src/lib/payment/garanti/return-handler.ts').garantiReturn
  const request = new Request('https://nrsbequiteluminous.com/api/payment/garanti/success', { method: 'POST', body: 'synthetic' })
  const response = await handler(request)
  assert.equal(response.status, 303)
  assert.deepEqual(sequence, ['verified', 'evidence-stored', 'finalized'])
})

test('expired no-record reconciliation is reusable for any owner-verified order ID', async () => {
  const requestedOrder = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', owner = allowed
  let closed = 0, inquiries = 0, saved = 0
  class Pending extends Error { constructor(reference) { super('pending'); this.reference = reference } }
  class Provider {
    constructor() { this.config = { liveObservationOnly: false, generalLivePayments: true } }
    async reconcileOwnedPendingOrder(id, userId) {
      inquiries++; assert.equal(id, requestedOrder); assert.equal(userId, owner); throw new Pending(id)
    }
    takeLiveReconciliationEvidence() { return { order_id: requestedOrder, reason: 'GARANTI_BANK_RECORD_NOT_FOUND', decision: 'pending' } }
    async expiredSubmittedHandoff(id, userId) { assert.equal(id, requestedOrder); assert.equal(userId, owner); return { expired: true, expiresAt: 1 } }
  }
  const route = loader({
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: owner } } }) } }) },
    '@/lib/payment/provider': { getPaymentProvider: () => new Provider() },
    '@/lib/payment/garanti/adapter': { GarantiProvider: Provider, GarantiPending: Pending },
    '@/lib/payment/garanti/config': { controlledLiveAccountAllowed: () => false },
    '@/lib/payment/garanti/order': { loadGarantiOrder: async id => ({ id, userId: owner, state: 'pending', amountMinor: 5800, currency: 'TRY' }) },
    '@/lib/payment/repository': {
      readGarantiSettlementEvidence: async id => ({ order_id: id, payment_event_count: 0, signed_callback_evidence_count: 0, live_finalize_evidence_count: 0 }),
      saveGarantiOrderinqReconciliation: async id => { assert.equal(id, requestedOrder); saved++ },
      closeExpiredGarantiNoRecordOrder: async id => { assert.equal(id, requestedOrder); closed++; return { closed: true, idempotent: false } },
      createPaymentRepository: () => ({ finalizeAtomic: async () => assert.fail('no-record must not finalize') }),
    },
    '@/lib/payment/http': { sameOrigin: () => true, boundedJson: async () => ({ orderId: requestedOrder }) },
    '@/lib/payment/request': { UUID: /^[0-9a-f-]{36}$/ },
  })('src/app/api/account/payments/garanti/reconcile/route.ts').POST
  const response = await route(new Request('https://nrsbequiteluminous.com/api/account/payments/garanti/reconcile', { method: 'POST' }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { state: 'unverified_closed' })
  assert.deepEqual({ inquiries, saved, closed }, { inquiries: 1, saved: 1, closed: 1 })
})
