const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto')
const { PGlite } = require('@electric-sql/pglite')
const fixture = require('./payment-security-fixture.cjs')
const { loader } = require('./source-loader.cjs')
const load = loader()
const migration = fs.readFileSync('supabase/migrations/20261013140000_garanti_live_single_finalize.sql', 'utf8')
const failureMigration = fs.readFileSync('supabase/migrations/20261013150000_garanti_live_single_finalize_failures.sql', 'utf8')
const slotMigration = fs.readFileSync('supabase/migrations/20261013160000_garanti_live_single_finalize_slots.sql', 'utf8')
const roleClaimMigration = fs.readFileSync('supabase/migrations/20261013170000_garanti_live_rpc_role_claim_compat.sql', 'utf8')
const additionalSlotMigration = fs.readFileSync('supabase/migrations/20261013180000_garanti_live_additional_controlled_slot.sql', 'utf8')
const selfTestMigration = fs.readFileSync('supabase/migrations/20261013190000_garanti_live_rpc_rollback_selftest.sql', 'utf8')
const liveFailureDiagnosticsMigration = fs.readFileSync('supabase/migrations/20261013200000_garanti_live_failure_diagnostics.sql', 'utf8')
const catalogItemMigration = fs.readFileSync('supabase/migrations/20261014100000_garanti_controlled_catalog_item.sql', 'utf8')
const target = '88888888-8888-4888-8888-888888888888'
const id = '77777777-7777-4777-8777-777777777777'
const variantId = '44444444-4444-4444-8444-444444444444'

test('Production one-order claim, evidence gate and finalize are atomic and idempotent in PostgreSQL', async () => {
  const db = new PGlite()
  try {
    await fixture.setup(db)
    await db.exec('ALTER TABLE public.products ADD COLUMN payment_test_only boolean NOT NULL DEFAULT false')
    await db.exec(migration)
    await db.exec(failureMigration)
    await db.exec(slotMigration)
    await db.exec(roleClaimMigration)
    await db.exec(additionalSlotMigration)
    await db.exec(selfTestMigration)
    await db.exec(liveFailureDiagnosticsMigration)
    await db.exec(catalogItemMigration)
    await db.exec("UPDATE public.products SET price_amount=2.80,compare_at_price=2.80; UPDATE public.product_variants SET stock_quantity=4")
    await db.query("INSERT INTO public.products(id,name,description,price_amount,currency,status,in_stock,payment_test_only) VALUES('nrs-garanti-live-3try','Controlled 3 TRY','Private',3,'TRY','active',true,true)")
    await db.query("INSERT INTO public.product_variants(id,product_id,size,stock_quantity,is_active) VALUES('55555555-5555-4555-8555-555555555555','nrs-garanti-live-3try',NULL,2,true)")
    const summary = { items: [{ productId: 'product', name: 'Test Ürün', description: 'Pamuk', size: 'M', quantity: 1, unitPrice: 2.8 }],
      buyer: { name: 'Test Alıcı', email: 'test@example.com', phone: '905551234567', address: 'Beytepe, Çankaya, Ankara' },
      subtotal: 2.8, discount: 0, shipping: 0.2, total: 3, currency: 'TRY', paymentMethod: 'Online kartla ödeme',
      deliveryTerms: 'Teyit edilmiş süre', orderedAt: new Date().toISOString() }
    const args = [id, fixture.userId, null, target, 'c'.repeat(64), JSON.stringify([{ productId: 'product', variantId, quantity: 1 }]),
      JSON.stringify({ firstName: 'Test', lastName: 'Alıcı', email: 'test@example.com', phone: '905551234567', address: 'Beytepe', city: 'Ankara', district: 'Çankaya', postalCode: '' }),
      JSON.stringify(fixture.historicalRecord(id, summary)), 'garanti-oos', fixture.userId]
    const oldId = '66666666-6666-4666-8666-666666666666'
    const oldSummary = { ...summary, orderedAt: new Date().toISOString() }
    const oldArgs = [...args]; oldArgs[0] = oldId; oldArgs[3] = '55555555-5555-4555-8555-555555555555'
    oldArgs[7] = JSON.stringify(fixture.historicalRecord(oldId, oldSummary))
    await db.query('SELECT public.nrs_create_payment_order($1::uuid,$2::uuid,$3,$4::uuid,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)', oldArgs.slice(0, 9))
    await db.query('UPDATE public.payment_orders SET state=\'pending\' WHERE order_id=$1::uuid', [oldId])
    await db.query('INSERT INTO public.garanti_live_single_finalize_allowances(user_id,order_id) VALUES($1::uuid,$2::uuid)', [fixture.userId, oldId])
    await db.query('INSERT INTO public.garanti_live_single_finalize_slots(user_id) VALUES($1::uuid)', [fixture.userId])
    await db.query("SELECT set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)")
    assert.deepEqual((await db.query('SELECT public.nrs_test_garanti_live_single_finalize_rpcs($1::uuid) proof', [fixture.userId])).rows[0].proof,
      { create: true, failureWriteReadback: true, evidenceWriteReadback: true, finalize: true,
        repeatFinalizeIdempotent: true, syntheticOnly: true, bankRequestSent: false, rollback: true, anonAuthenticatedDenied: true })
    const trialSummary = { ...summary, items: [{ productId: 'nrs-garanti-live-3try', name: 'Controlled 3 TRY', description: 'Private', quantity: 1, unitPrice: 3 }],
      subtotal: 3, discount: 0, shipping: 0, total: 3 }
    args[5] = JSON.stringify([{ productId: 'nrs-garanti-live-3try', variantId: '55555555-5555-4555-8555-555555555555', quantity: 1 }])
    args[7] = JSON.stringify(fixture.historicalRecord(id, trialSummary))
    const create = () => db.query('SELECT public.nrs_create_garanti_live_single_finalize_order($1::uuid,$2::uuid,$3,$4::uuid,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10::uuid) result', args)
    const first = (await create()).rows[0].result
    assert.equal(first.created, true)
    assert.equal(first.order.amountMinor, 300)
    const retry = (await create()).rows[0].result
    assert.equal(retry.created, false)
    assert.equal(retry.order.id, id)
    assert.equal((await db.query('SELECT count(*)::int n FROM public.garanti_live_single_finalize_allowances')).rows[0].n, 2)
    assert.equal((await db.query('SELECT claimed_order_id=$1::uuid claimed FROM public.garanti_live_single_finalize_slots WHERE user_id=$2::uuid AND claimed_order_id IS NOT NULL', [id, fixture.userId])).rows[0].claimed, true)
    assert.equal((await db.query("SELECT stock_quantity FROM public.product_variants WHERE id='55555555-5555-4555-8555-555555555555'")).rows[0].stock_quantity, 1)

    const evidence = { order_id: id, signature_verified: true, signature_algorithm: 'sha1', signature_encoding: 'iso-8859-9',
      order_match: true, amount_match: true, currency_match: true, terminal_match: true, request_match: true,
      callback_mdstatus: '1', callback_response: 'approved', callback_procreturncode: '00', query_http: 200,
      query_order_match: true, query_identity_match: true, query_amount_match: true, query_result_codes_match: true,
      query_status: 'APPROVED', query_charge_type: 'S', auth_date_format: 'timestamp', auth_code_match: true, bank_reference_present: true }
    // The RPC must keep rejecting other JWT roles and accept service_role from
    // the newer PostgREST JSON claim representation.
    await db.query("SELECT set_config('request.jwt.claim.role','',false)")
    await db.query("SELECT set_config('request.jwt.claims','{\"role\":\"anon\"}',false)")
    await assert.rejects(db.query('SELECT public.nrs_store_garanti_live_single_finalize_evidence($1::uuid,$2::jsonb)', [id, JSON.stringify(evidence)]), /incomplete verified Garanti evidence/)
    await db.query("SELECT set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)")
    await db.query('SELECT public.nrs_store_payment_redirect($1::uuid,$2)', [id, 'https://example.invalid/one-use-handoff'])
    const failureDiagnostic = { signature_verified: true, signature_result: 'verified', order_match: true, amount_match: true,
      currency_match: true, terminal_match: true, request_match: true, mdstatus: '1', response: 'approved',
      procreturncode: '00', error_category: 'not_recorded', verification_basis: 'callback_runtime' }
    await db.query('SELECT public.nrs_record_garanti_live_single_finalize_failure_v2($1::uuid,$2,$3,$4,$5::jsonb)',
      [id, 'success', 'orderinq_auth_code', 'GARANTI_SUCCESS_RETURN_ORDERINQ_AUTHORIZATION_MISMATCH', JSON.stringify(failureDiagnostic)])
    await db.query('SELECT public.nrs_record_garanti_live_single_finalize_failure($1::uuid,$2,$3,$4)',
      [id, 'success', 'finalize_rpc', 'GARANTI_SUCCESS_RETURN_FINALIZE_RPC_FAILED'])
    assert.deepEqual((await db.query('SELECT source,failure_stage,safe_code,callback_signature_verified,order_match,amount_match,callback_mdstatus,callback_response,callback_procreturncode FROM public.garanti_live_single_finalize_failures WHERE order_id=$1::uuid', [id])).rows[0],
      { source: 'success', failure_stage: 'orderinq_auth_code', safe_code: 'GARANTI_SUCCESS_RETURN_ORDERINQ_AUTHORIZATION_MISMATCH',
        callback_signature_verified: true, order_match: true, amount_match: true, callback_mdstatus: '1', callback_response: 'approved', callback_procreturncode: '00' })
    await assert.rejects(db.query('SELECT public.nrs_record_garanti_live_single_finalize_failure_v2($1::uuid,$2,$3,$4,$5::jsonb)',
      [id, 'success', 'orderinq_auth_code', 'GARANTI_FAILURE_RETURN', JSON.stringify({ raw: 'callback-or-secret' })]))
    const payment = { eventId: 'garanti-live-event', merchantId: 'synthetic-merchant', merchantReference: id,
      transactionId: 'synthetic-terminal:order', amountMinor: 300, currency: 'TRY', status: 'paid', threeDS: 'authenticated' }
    await assert.rejects(db.query('SELECT public.nrs_finalize_garanti_live_single_finalize_payment($1::jsonb,$2)', [JSON.stringify(payment), 'garanti-oos']), /verified single-order evidence unavailable/)
    assert.equal((await db.query('SELECT state FROM public.payment_orders WHERE order_id=$1::uuid', [id])).rows[0].state, 'pending')
    await db.query('SELECT public.nrs_store_garanti_live_single_finalize_evidence($1::uuid,$2::jsonb)', [id, JSON.stringify(evidence)])
    await db.query('SELECT public.nrs_store_garanti_live_single_finalize_evidence($1::uuid,$2::jsonb)', [id, JSON.stringify(evidence)])
    await db.query('SELECT public.nrs_finalize_garanti_live_single_finalize_payment($1::jsonb,$2)', [JSON.stringify(payment), 'garanti-oos'])
    await db.query('SELECT public.nrs_finalize_garanti_live_single_finalize_payment($1::jsonb,$2)', [JSON.stringify(payment), 'garanti-oos'])
    assert.deepEqual((await db.query(`SELECT p.state,o.status,v.stock_quantity,
      (SELECT count(*)::int FROM public.payment_events WHERE order_id=$1::uuid) events,
      (SELECT count(*)::int FROM public.payment_stock_reservations WHERE order_id=$1::uuid AND NOT released) reservations,
      (SELECT consumed_at IS NOT NULL FROM public.garanti_live_single_finalize_allowances WHERE order_id=$1::uuid) consumed
      FROM public.payment_orders p JOIN public.orders o ON o.id=p.order_id JOIN public.product_variants v ON v.id='55555555-5555-4555-8555-555555555555' WHERE p.order_id=$1::uuid`, [id])).rows[0],
      { state: 'paid', status: 'paid', stock_quantity: 1, events: 1, reservations: 1, consumed: true })
    assert.deepEqual((await db.query(`SELECT p.state,a.order_id=a.order_id still_bound,a.consumed_at IS NULL unused,
      (SELECT count(*)::int FROM public.payment_events WHERE order_id=p.order_id) events
      FROM public.payment_orders p JOIN public.garanti_live_single_finalize_allowances a ON a.order_id=p.order_id WHERE p.order_id=$1::uuid`, [oldId])).rows[0],
      { state: 'pending', still_bound: true, unused: true, events: 0 })

    // A later different idempotency key cannot claim this account's one slot;
    // the failed transaction leaves no partial order or stock reservation.
    const secondId = '99999999-9999-4999-8999-999999999999'
    const retrySummary = { ...summary, items: [{ productId: 'nrs-garanti-live-3try', name: 'Controlled 3 TRY', description: 'Private', quantity: 1, unitPrice: 3 }], subtotal: 3, discount: 0, shipping: 0, total: 3 }
    const secondArgs = [...args]; secondArgs[0] = secondId; secondArgs[3] = secondId
    secondArgs[5] = JSON.stringify([{ productId: 'nrs-garanti-live-3try', variantId: '55555555-5555-4555-8555-555555555555', quantity: 1 }])
    secondArgs[7] = JSON.stringify(fixture.historicalRecord(secondId, retrySummary))
    await assert.rejects(db.query('SELECT public.nrs_create_garanti_live_single_finalize_order($1::uuid,$2::uuid,$3,$4::uuid,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10::uuid)', secondArgs), /slot unavailable/)
    assert.equal((await db.query('SELECT count(*)::int n FROM public.orders')).rows[0].n, 2)
    assert.equal((await db.query("SELECT stock_quantity FROM public.product_variants WHERE id='44444444-4444-4444-8444-444444444444'")).rows[0].stock_quantity, 3)
    assert.equal((await db.query('SELECT count(*)::int n FROM public.payment_stock_reservations WHERE order_id=$1::uuid', [secondId])).rows[0].n, 0)
    assert.equal((await db.query("SELECT stock_quantity FROM public.product_variants WHERE id='55555555-5555-4555-8555-555555555555'")).rows[0].stock_quantity, 1)
  } finally { await db.close() }
})

test('additional live slot preserves old claim and rejects non-approved products', async () => {
  const db = new PGlite()
  const oldId = '66666666-6666-4666-8666-666666666666', id = '99999999-9999-4999-8999-999999999999'
  const newKey = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', variant = '55555555-5555-4555-8555-555555555555'
  try {
    await fixture.setup(db)
    await db.exec('ALTER TABLE public.products ADD COLUMN payment_test_only boolean NOT NULL DEFAULT false')
    await db.exec(migration); await db.exec(failureMigration); await db.exec(slotMigration); await db.exec(roleClaimMigration)
    await db.exec('UPDATE public.products SET price_amount=2.80,compare_at_price=2.80; UPDATE public.product_variants SET stock_quantity=4')
    const oldSummary = { items: [{ productId: 'product', name: 'Test Ürün', description: 'Pamuk', size: 'M', quantity: 1, unitPrice: 2.8 }],
      buyer: { name: 'Test Alıcı', email: 'test@example.com', phone: '905551234567', address: 'Beytepe, Çankaya, Ankara' }, subtotal: 2.8, discount: 0,
      shipping: 0.2, total: 3, currency: 'TRY', paymentMethod: 'Online kartla ödeme', deliveryTerms: 'Teyit edilmiş süre', orderedAt: new Date().toISOString() }
    const customer = { firstName: 'Test', lastName: 'Alıcı', email: 'test@example.com', phone: '905551234567', address: 'Beytepe', city: 'Ankara', district: 'Çankaya', postalCode: '' }
    const oldArgs = [oldId, fixture.userId, null, oldId, 'c'.repeat(64), JSON.stringify([{ productId: 'product', variantId, quantity: 1 }]),
      JSON.stringify(customer), JSON.stringify(fixture.historicalRecord(oldId, oldSummary)), 'garanti-oos']
    await db.query('SELECT public.nrs_create_payment_order($1::uuid,$2::uuid,$3,$4::uuid,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)', oldArgs)
    await db.query("UPDATE public.payment_orders SET state='pending' WHERE order_id=$1::uuid", [oldId])
    await db.query('INSERT INTO public.garanti_live_single_finalize_slots(user_id,claimed_order_id,claimed_at) VALUES($1::uuid,$2::uuid,now())', [fixture.userId, oldId])
    await db.exec(additionalSlotMigration); await db.exec(selfTestMigration); await db.exec(liveFailureDiagnosticsMigration); await db.exec(catalogItemMigration)
    await db.query("INSERT INTO public.products(id,name,description,price_amount,currency,status,in_stock,payment_test_only) VALUES('nrs-garanti-live-3try','Controlled 3 TRY','Private',3,'TRY','active',true,true)")
    await db.query("INSERT INTO public.product_variants(id,product_id,size,stock_quantity,is_active) VALUES($1::uuid,'nrs-garanti-live-3try',NULL,1,true)", [variant])
    await db.query("SELECT set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)")
    const summary = { items: [{ productId: 'nrs-garanti-live-3try', name: 'Controlled 3 TRY', description: 'Private', measurementKind: 'accessory', measurements: {},
      quantity: 1, unitPrice: 3 }], buyer: { name: 'Test Alıcı', email: 'test@example.com', phone: '905551234567', address: 'Beytepe, Çankaya, Ankara' },
      subtotal: 3, discount: 0, shipping: 0, total: 3, currency: 'TRY', paymentMethod: 'Online kartla ödeme', deliveryTerms: 'Teyit edilmiş süre', orderedAt: new Date().toISOString() }
    const legal = fixture.historicalRecord(id, summary)
    const items = [{ productId: 'nrs-garanti-live-3try', variantId: variant, quantity: 1 }]
    const created = (await db.query('SELECT public.nrs_create_garanti_live_single_finalize_order($1::uuid,$2::uuid,$3,$4::uuid,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10::uuid) result',
      [id, fixture.userId, null, newKey, 'd'.repeat(64), JSON.stringify(items), JSON.stringify(customer), JSON.stringify(legal), 'garanti-oos', fixture.userId])).rows[0].result
    assert.equal(created.created, true); assert.equal(created.order.amountMinor, 300)
    assert.equal((await db.query('SELECT count(*)::int n FROM public.garanti_live_single_finalize_slots WHERE user_id=$1::uuid', [fixture.userId])).rows[0].n, 2)
    assert.equal((await db.query('SELECT state FROM public.payment_orders WHERE order_id=$1::uuid', [oldId])).rows[0].state, 'pending')
    assert.equal((await db.query('SELECT claimed_order_id=$1::uuid claimed FROM public.garanti_live_single_finalize_slots WHERE claimed_order_id=$1::uuid', [oldId])).rows[0].claimed, true)
    assert.equal((await db.query('SELECT claimed_order_id=$1::uuid claimed FROM public.garanti_live_single_finalize_slots WHERE claimed_order_id=$1::uuid', [id])).rows[0].claimed, true)
    const disallowedId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    await assert.rejects(db.query('SELECT public.nrs_create_garanti_live_single_finalize_order($1::uuid,$2::uuid,$3,$4::uuid,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10::uuid)',
      [disallowedId, fixture.userId, null, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'e'.repeat(64),
        JSON.stringify([{ productId: 'product', variantId, quantity: 1 }]), JSON.stringify(customer),
        JSON.stringify(fixture.historicalRecord(disallowedId, oldSummary)), 'garanti-oos', fixture.userId]), /item not approved/)
    assert.equal((await db.query('SELECT count(*)::int n FROM public.payment_orders')).rows[0].n, 2)
  } finally { await db.close() }
})

test('the controlled slot accepts only the selected public deneme item and remains one-use', async () => {
  const db = new PGlite()
  try {
    await fixture.setup(db)
    await db.exec('ALTER TABLE public.products ADD COLUMN payment_test_only boolean NOT NULL DEFAULT false')
    await db.exec(migration); await db.exec(failureMigration); await db.exec(slotMigration); await db.exec(roleClaimMigration)
    await db.exec(additionalSlotMigration); await db.exec(selfTestMigration); await db.exec(liveFailureDiagnosticsMigration)
    await db.exec(catalogItemMigration)
    await db.query("INSERT INTO public.products(id,name,description,price_amount,currency,status,in_stock,payment_test_only) VALUES('deneme','ben','Listed product',3,'TRY','active',true,false)")
    const catalogVariant = '33333333-3333-4333-8333-333333333333'
    await db.query("INSERT INTO public.product_variants(id,product_id,size,stock_quantity,is_active) VALUES($1::uuid,'deneme','M',2,true)", [catalogVariant])
    await db.query('INSERT INTO public.garanti_live_single_finalize_slots(user_id) VALUES($1::uuid)', [fixture.userId])
    await db.query("SELECT set_config('request.jwt.claims','{\"role\":\"service_role\"}',false)")
    const orderId = '22222222-2222-4222-8222-222222222222'
    const key = '11111111-1111-4111-8111-111111111111'
    const summary = { items: [{ productId: 'deneme', name: 'ben', description: 'Listed product', size: 'M', quantity: 1, unitPrice: 3 }],
      buyer: { name: 'Test Alıcı', email: 'test@example.com', phone: '905551234567', address: 'Beytepe, Ankara' },
      subtotal: 3, discount: 0, shipping: 0, total: 3, currency: 'TRY', paymentMethod: 'Online kartla ödeme',
      deliveryTerms: 'Teyit edilmiş süre', orderedAt: new Date().toISOString() }
    const args = [orderId, fixture.userId, null, key, 'f'.repeat(64), JSON.stringify([{ productId: 'deneme', variantId: catalogVariant, quantity: 1 }]),
      JSON.stringify({ firstName: 'Test', lastName: 'Alıcı', email: 'test@example.com', phone: '905551234567', address: 'Beytepe', city: 'Ankara', district: 'Çankaya', postalCode: '' }),
      JSON.stringify(fixture.historicalRecord(orderId, summary)), 'garanti-oos', fixture.userId]
    const create = () => db.query('SELECT public.nrs_create_garanti_live_single_finalize_order($1::uuid,$2::uuid,$3,$4::uuid,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10::uuid) result', args)
    const first = (await create()).rows[0].result
    assert.equal(first.created, true); assert.equal(first.order.amountMinor, 300)
    const retry = (await create()).rows[0].result
    assert.equal(retry.created, false); assert.equal(retry.order.id, orderId)
    assert.equal((await db.query('SELECT claimed_order_id=$1::uuid claimed FROM public.garanti_live_single_finalize_slots WHERE user_id=$2::uuid', [orderId, fixture.userId])).rows[0].claimed, true)
    assert.equal((await db.query('SELECT order_id=$1::uuid bound FROM public.garanti_live_single_finalize_allowances WHERE order_id=$1::uuid', [orderId])).rows[0].bound, true)
    assert.equal((await db.query("SELECT stock_quantity FROM public.product_variants WHERE id=$1::uuid", [catalogVariant])).rows[0].stock_quantity, 1)

    const disallowedId = '44444444-4444-4444-8444-444444444444'
    await assert.rejects(db.query('SELECT public.nrs_create_garanti_live_single_finalize_order($1::uuid,$2::uuid,$3,$4::uuid,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10::uuid)',
      [disallowedId, fixture.userId, null, '55555555-5555-4555-8555-555555555555', 'a'.repeat(64), JSON.stringify([{ productId: 'product', variantId, quantity: 1 }]),
        JSON.stringify({}), JSON.stringify(fixture.historicalRecord(disallowedId, summary)), 'garanti-oos', fixture.userId]), /item not approved/)
    assert.equal((await db.query('SELECT count(*)::int n FROM public.payment_orders')).rows[0].n, 1)
  } finally { await db.close() }
})

const liveId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
function makeLiveFixture() {
  const config = { mode: 'PROD', liveObservationOnly: true, observationOnly: false, merchantId: '1000001', terminalId: '12345678',
    userId: 'GARANTI', provisionUser: 'PROVAUT', queryUser: 'PROVAUT', queryAgentUserId: 'PROVAUT', provisionPassword: 'synthetic-provision',
    queryPassword: 'synthetic-query', storeKey: 'synthetic-store', handoffSecret: 'a'.repeat(64), siteOrigin: 'https://nrsbequiteluminous.com',
    formUrl: 'https://sanalposprov.garanti.com.tr/servlet/gt3dengine', queryUrl: 'https://sanalposprov.garanti.com.tr/VPServlet',
    successUrl: 'https://nrsbequiteluminous.com/api/payment/garanti/success', errorUrl: 'https://nrsbequiteluminous.com/api/payment/garanti/failure',
    installment: '', capturedStatus: '', capturedResultCode: '', saleChargeType: '', failedStatuses: [], initiationMaxAmountMinor: 1000 }
  const order = { id: liveId, merchantReference: liveId, amountMinor: 300, currency: 'TRY', state: 'pending', userId: 'synthetic-owner',
    legal: { order_summary: { buyer: { email: 'synthetic@example.com' } } } }
  const protocol = load('src/lib/payment/garanti/protocol.ts')
  const fields = { ...protocol.bankFields(config, order, '127.0.0.1'), clientid: config.terminalId, oid: liveId, authcode: '123456',
    procreturncode: '00', response: 'Approved', mdstatus: '1', cavv: 'safe-synthetic', eci: '05', md: 'synthetic', rnd: 'synthetic' }
  fields.hashparams = 'clientid:oid:authcode:procreturncode:response:mdstatus:cavv:eci:md:rnd:'
  fields.hash = crypto.createHash('sha1').update(Buffer.from(fields.hashparams.split(':').filter(Boolean).map(name => fields[name]).join('') + config.storeKey, 'latin1')).digest('base64')
  const body = new URLSearchParams(fields).toString()
  const xml = `<GVPSResponse><Terminal><ID>${config.terminalId}</ID><MerchantID>${config.merchantId}</MerchantID></Terminal><Order><OrderID>${liveId}</OrderID><OrderInqResult><Status>APPROVED</Status><ChargeType>S</ChargeType><Code>00</Code><ReasonCode>00</ReasonCode><AuthAmount>300</AuthAmount><AuthDate>2026-10-13 12:34:56.789</AuthDate><AuthCode>123456</AuthCode><RetrefNum>987654</RetrefNum><InstallmentCnt>0</InstallmentCnt></OrderInqResult></Order><Transaction><Response><Code>00</Code></Response></Transaction></GVPSResponse>`
  return { config, order, body, xml }
}

test('only a claimed live order stores signed/query evidence and finalizes; duplicate callback remains idempotent', async () => {
  const f = makeLiveFixture(), { GarantiProvider: BaseGarantiProvider, GarantiPending } = load('src/lib/payment/garanti/adapter.ts')
  const originalFetch = global.fetch, saved = [], failures = [], events = new Set(); let inquiryCalls = 0, finalizeCalls = 0
  global.fetch = async url => { inquiryCalls++; assert.equal(url, f.config.queryUrl); return new Response(f.xml, { headers: { 'content-type': 'text/xml;charset=utf-8' } }) }
  class GarantiProvider extends BaseGarantiProvider { constructor(config) { super(config, async () => f.order) } }
  const provider = new GarantiProvider(f.config)
  const stored = { saveGarantiLiveSingleFinalizeEvidence: async (orderId, proof) => { saved.push({ orderId, ...proof }) },
    saveGarantiLiveSingleFinalizeFailure: async (orderId, source, stage, safeCode) => { failures.push({ orderId, source, stage, safeCode }) },
    finalizeGarantiLiveSinglePayment: async payment => { finalizeCalls++; events.add(payment.eventId); f.order.state = 'paid' },
    createPaymentRepository: () => ({ finalizeAtomic: async () => { throw new Error('wrong finalizer') } }) }
  const mocks = {
    'next/server': { NextResponse: { redirect: (url, status) => Response.redirect(url, status) } },
    '@/lib/payment/provider': { paymentAvailable: () => true, getPaymentProvider: () => provider },
    '@/lib/payment/repository': stored,
    './adapter': { GarantiProvider, GarantiPending },
    './order': { loadGarantiOrder: async () => f.order, isGarantiLiveSingleFinalizeOrder: async order => order.state === 'pending' && order.id === liveId && order.amountMinor === 300,
      isGarantiSingleFinalizeOrder: async () => false },
    './protocol': load('src/lib/payment/garanti/protocol.ts'),
  }
  const handler = loader(mocks)('src/lib/payment/garanti/return-handler.ts').garantiReturn
  const request = () => new Request(f.config.successUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: f.body })
  try {
    const first = await handler(request())
    assert.equal(first.status, 303); assert.match(first.headers.get('location'), /checkout\/verify\?orderId=/)
    const second = await handler(request())
    assert.equal(second.status, 303)
    assert.equal(inquiryCalls, 2); assert.equal(saved.length, 1); assert.equal(finalizeCalls, 1); assert.equal(events.size, 1)
    const safeEvidence = JSON.stringify(saved)
    for (const secret of ['synthetic-store', 'synthetic-provision', 'synthetic-query', 'safe-synthetic', fieldsSecret(f.body)]) assert.equal(safeEvidence.includes(secret), false)
    assert.equal(saved[0].signature_verified, true); assert.equal(saved[0].query_result_codes_match, true)
    assert.equal(saved[0].auth_date_format, 'timestamp'); assert.equal(saved[0].callback_procreturncode, '00')
    const tampered = new URLSearchParams(f.body), originalHash = tampered.get('hash')
    tampered.set('hash', (originalHash[0] === 'A' ? 'B' : 'A') + originalHash.slice(1))
    const rejected = await handler(new Request(f.config.successUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: tampered.toString() }))
    assert.match(rejected.headers.get('location'), /GARANTI_SUCCESS_RETURN_SIGNATURE_HASH_MISMATCH/)
    assert.equal(failures.length, 0)
    assert.equal(saved.length, 1); assert.equal(finalizeCalls, 1); assert.equal(inquiryCalls, 2)
  } finally { global.fetch = originalFetch }
})

test('live single-finalize records the first safe verification stage without callback values', async () => {
  const f = makeLiveFixture(), { GarantiProvider: BaseGarantiProvider } = load('src/lib/payment/garanti/adapter.ts')
  const originalFetch = global.fetch, failures = []; let finalizeCalls = 0
  f.xml = f.xml.replace('<AuthCode>123456</AuthCode>', '<AuthCode>654321</AuthCode>')
  global.fetch = async () => new Response(f.xml, { headers: { 'content-type': 'text/xml;charset=utf-8' } })
  class GarantiProvider extends BaseGarantiProvider { constructor(config) { super(config, async () => f.order) } }
  const provider = new GarantiProvider(f.config)
  class Pending extends Error { constructor(reference) { super(); this.reference = reference } }
  const stored = { saveGarantiLiveSingleFinalizeFailure: async (orderId, source, stage, safeCode) => failures.push({ orderId, source, stage, safeCode }),
    saveGarantiLiveSingleFinalizeEvidence: async () => { throw new Error('positive evidence must not be stored') },
    finalizeGarantiLiveSinglePayment: async () => { finalizeCalls++ },
    createPaymentRepository: () => ({ finalizeAtomic: async () => { throw new Error('wrong finalizer') } }) }
  const handler = loader({
    'next/server': { NextResponse: { redirect: (url, status) => Response.redirect(url, status) } },
    '@/lib/payment/provider': { paymentAvailable: () => true, getPaymentProvider: () => provider },
    '@/lib/payment/repository': stored,
    '@/lib/payment/service': { validateVerifiedPayment: () => {} },
    './adapter': { GarantiProvider, GarantiPending: Pending },
    './order': { loadGarantiOrder: async () => f.order, isGarantiLiveSingleFinalizeOrder: async () => true, isGarantiSingleFinalizeOrder: async () => false },
    './diagnostics': { diagnoseLiveReturn: () => ({ order_id: liveId }), diagnoseTestReturn: () => ({}), saveTestDiagnostic: async () => {} },
    './protocol': load('src/lib/payment/garanti/protocol.ts'),
  })('src/lib/payment/garanti/return-handler.ts').garantiReturn
  try {
    const response = await handler(new Request(f.config.successUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: f.body }))
    assert.equal(response.status, 303)
    assert.deepEqual(failures, [{ orderId: liveId, source: 'success', stage: 'orderinq_auth_code', safeCode: 'GARANTI_SUCCESS_RETURN_ORDERINQ_AUTHORIZATION_MISMATCH' }])
    assert.equal(finalizeCalls, 0)
    for (const secret of ['synthetic-store', 'synthetic-provision', 'synthetic-query', 'safe-synthetic', fieldsSecret(f.body)])
      assert.equal(JSON.stringify(failures).includes(secret), false)
  } finally { global.fetch = originalFetch }
})

test('verified callback with evidence-write failure surfaces a safe failure code instead of the generic review page', async () => {
  const f = makeLiveFixture(), { GarantiProvider: BaseGarantiProvider } = load('src/lib/payment/garanti/adapter.ts')
  const originalFetch = global.fetch, failures = []
  global.fetch = async () => new Response(f.xml, { headers: { 'content-type': 'text/xml;charset=utf-8' } })
  class GarantiProvider extends BaseGarantiProvider { constructor(config) { super(config, async () => f.order) } }
  const provider = new GarantiProvider(f.config)
  const stored = {
    saveGarantiLiveSingleFinalizeEvidence: async () => { throw new Error('Verified payment evidence could not be stored.') },
    saveGarantiLiveSingleFinalizeFailure: async (orderId, source, stage, safeCode) => failures.push({ orderId, source, stage, safeCode }),
    finalizeGarantiLiveSinglePayment: async () => assert.fail('must not finalize after failed evidence write'),
    createPaymentRepository: () => ({ finalizeAtomic: async () => assert.fail('must not use generic finalizer') }),
  }
  const handler = loader({
    'next/server': { NextResponse: { redirect: (url, status) => Response.redirect(url, status) } },
    '@/lib/payment/provider': { paymentAvailable: () => true, getPaymentProvider: () => provider },
    '@/lib/payment/repository': stored,
    '@/lib/payment/service': { validateVerifiedPayment: () => {} },
    './adapter': { GarantiProvider, GarantiPending: class GarantiPending extends Error {} },
    './order': { loadGarantiOrder: async () => f.order, isGarantiLiveSingleFinalizeOrder: async () => true, isGarantiSingleFinalizeOrder: async () => false },
    './diagnostics': { diagnoseLiveReturn: () => ({ order_id: liveId }), diagnoseTestReturn: () => ({}), saveTestDiagnostic: async () => {} },
    './protocol': load('src/lib/payment/garanti/protocol.ts'),
  })('src/lib/payment/garanti/return-handler.ts').garantiReturn
  try {
    const response = await handler(new Request(f.config.successUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: f.body }))
    assert.equal(response.status, 303)
    assert.match(response.headers.get('location'), /checkout\/failure\?code=GARANTI_SUCCESS_RETURN_EVIDENCE_STORE_FAILED/)
    assert.deepEqual(failures, [{ orderId: liveId, source: 'success', stage: 'evidence_store', safeCode: 'GARANTI_SUCCESS_RETURN_EVIDENCE_STORE_FAILED' }])
    assert.equal(response.headers.get('location').includes('hash'), false)
  } finally { global.fetch = originalFetch }
})

test('live single-finalize records active-order invalid signatures and failed orderinq without finalizing', async () => {
  for (const scenario of [
    { name: 'invalid signature', tamper: true, expectedCode: 'GARANTI_SUCCESS_RETURN_SIGNATURE_HASH_MISMATCH', expectedStage: 'callback_signature' },
    { name: 'failed orderinq', xml: xml => xml.replace('<Status>APPROVED</Status>', '<Status>DECLINED</Status>')
      .replace('<Code>00</Code><ReasonCode>00</ReasonCode>', '<Code>05</Code><ReasonCode>05</ReasonCode>'),
      expectedCode: 'GARANTI_ORDERINQ_PENDING', expectedStage: 'orderinq_status' },
  ]) {
    const f = makeLiveFixture(), { GarantiProvider: BaseGarantiProvider } = load('src/lib/payment/garanti/adapter.ts')
    const originalFetch = global.fetch, failures = []; let finalizeCalls = 0
    if (scenario.xml) f.xml = scenario.xml(f.xml)
    global.fetch = async () => new Response(f.xml, { headers: { 'content-type': 'text/xml;charset=utf-8' } })
    class GarantiProvider extends BaseGarantiProvider { constructor(config) { super(config, async () => f.order) } }
    const provider = new GarantiProvider(f.config)
    const stored = { saveGarantiLiveSingleFinalizeFailure: async (orderId, source, stage, safeCode) => failures.push({ orderId, source, stage, safeCode }),
      saveGarantiLiveSingleFinalizeEvidence: async () => { throw new Error('failed verification cannot save positive evidence') },
      finalizeGarantiLiveSinglePayment: async () => { finalizeCalls++ },
      createPaymentRepository: () => ({ finalizeAtomic: async () => { throw new Error('wrong finalizer') } }) }
    const { GarantiPending } = load('src/lib/payment/garanti/adapter.ts')
    const handler = loader({
      'next/server': { NextResponse: { redirect: (url, status) => Response.redirect(url, status) } },
      '@/lib/payment/provider': { paymentAvailable: () => true, getPaymentProvider: () => provider },
      '@/lib/payment/repository': stored,
      '@/lib/payment/service': { validateVerifiedPayment: () => {} },
      './adapter': { GarantiProvider, GarantiPending },
      './order': { loadGarantiOrder: async () => f.order, isGarantiLiveSingleFinalizeOrder: async () => true, isGarantiSingleFinalizeOrder: async () => false },
      './diagnostics': { diagnoseLiveReturn: () => ({ order_id: liveId }), diagnoseTestReturn: () => ({}), saveTestDiagnostic: async () => {} },
      './protocol': load('src/lib/payment/garanti/protocol.ts'),
    })('src/lib/payment/garanti/return-handler.ts').garantiReturn
    try {
      let body = f.body
      if (scenario.tamper) { const params = new URLSearchParams(body), hash = params.get('hash'); params.set('hash', `${hash[0] === 'A' ? 'B' : 'A'}${hash.slice(1)}`); body = params.toString() }
      const response = await handler(new Request(f.config.successUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body }))
      assert.equal(response.status, 303, scenario.name)
      assert.deepEqual(failures, [{ orderId: liveId, source: 'success', stage: scenario.expectedStage, safeCode: scenario.expectedCode }], scenario.name)
      assert.equal(finalizeCalls, 0, scenario.name)
      const saved = JSON.stringify(failures)
      for (const secret of ['synthetic-store', 'synthetic-provision', 'synthetic-query', fieldsSecret(f.body)]) assert.equal(saved.includes(secret), false)
    } finally { global.fetch = originalFetch }
  }
})

test('signed live failure callback stores safe order-bound verification and first orderinq stage without finalizing', async () => {
  const f = makeLiveFixture(), { GarantiProvider: BaseGarantiProvider, GarantiPending } = load('src/lib/payment/garanti/adapter.ts')
  const protocol = load('src/lib/payment/garanti/protocol.ts')
  const fields = Object.fromEntries(new URLSearchParams(f.body))
  fields.mdstatus = '2'; fields.response = 'Declined'; fields.procreturncode = '92'
  fields.hash = crypto.createHash('sha1').update(Buffer.from(fields.hashparams.split(':').filter(Boolean).map(name => fields[name]).join('') + f.config.storeKey, 'latin1')).digest('base64')
  const failureBody = new URLSearchParams(fields).toString()
  const queryXml = f.xml.replace('<Transaction><Response><Code>00</Code></Response></Transaction>',
    '<Transaction><Response><Code>92</Code><ReasonCode>0110</ReasonCode></Response></Transaction>')
  const originalFetch = global.fetch; let inquiryCalls = 0, finalizeCalls = 0, evidenceWrites = 0; const failures = []
  global.fetch = async () => { inquiryCalls++; return new Response(queryXml, { headers: { 'content-type': 'text/xml;charset=utf-8' } }) }
  class GarantiProvider extends BaseGarantiProvider { constructor(config) { super(config, async () => f.order) } }
  const provider = new GarantiProvider(f.config)
  const stored = {
    saveGarantiLiveSingleFinalizeFailure: async (orderId, source, stage, safeCode, diagnostic) => failures.push({ orderId, source, stage, safeCode, diagnostic }),
    saveGarantiLiveSingleFinalizeEvidence: async () => { evidenceWrites++ },
    finalizeGarantiLiveSinglePayment: async () => { finalizeCalls++ },
    createPaymentRepository: () => ({ finalizeAtomic: async () => { finalizeCalls++ } }),
  }
  const mockedDiagnostic = { order_id: liveId, signature_verified: true, signature_result: 'verified',
    reported_mdstatus: '2', reported_response: 'declined', reported_procreturncode: '92',
    mderrormessage_present: null, errmsg_present: null, error_text_signed: false, error_category: 'not_recorded' }
  const handler = loader({
    'next/server': { NextResponse: { redirect: (url, status) => Response.redirect(url, status) } },
    '@/lib/payment/provider': { paymentAvailable: () => true, getPaymentProvider: () => provider },
    '@/lib/payment/repository': stored,
    '@/lib/payment/service': { validateVerifiedPayment: () => { throw new Error('failure must not produce a payment DTO') } },
    './adapter': { GarantiProvider, GarantiPending },
    './order': { loadGarantiOrder: async () => f.order, isGarantiLiveSingleFinalizeOrder: async candidate => candidate.id === liveId,
      isGarantiSingleFinalizeOrder: async () => false },
    './diagnostics': { diagnoseLiveReturn: () => mockedDiagnostic, diagnoseTestReturn: () => ({}), saveTestDiagnostic: async () => {} },
    './protocol': protocol,
  })('src/lib/payment/garanti/return-handler.ts').garantiReturn
  try {
    const response = await handler(new Request(f.config.errorUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: failureBody }))
    assert.equal(response.status, 303)
    assert.equal(new URL(response.headers.get('location')).pathname, '/checkout/verify')
    assert.equal(inquiryCalls, 1)
    assert.equal(evidenceWrites, 0)
    assert.equal(finalizeCalls, 0)
    assert.equal(failures.length, 1)
    assert.equal(failures[0].source, 'failure')
    assert.equal(failures[0].stage, 'orderinq_status')
    assert.equal(failures[0].safeCode, 'GARANTI_ORDERINQ_PENDING')
    assert.deepEqual(failures[0].diagnostic, {
      signature_verified: true, signature_result: 'verified', order_match: true, amount_match: true,
      currency_match: true, terminal_match: true, request_match: true, mdstatus: '2',
      response: 'declined', procreturncode: '92', mderrormessage_present: null,
      errmsg_present: null, error_text_signed: false, error_category: 'not_recorded', verification_basis: 'callback_runtime',
    })
    const saved = JSON.stringify(failures)
    for (const secret of ['synthetic-store', 'synthetic-provision', 'synthetic-query', 'safe-synthetic', fieldsSecret(f.body)]) assert.equal(saved.includes(secret), false)
  } finally { global.fetch = originalFetch }
})

test('private account permission status reports only armed/unused state and denies other identities', async () => {
  let currentUser = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const handler = loader({
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: currentUser ? { id: currentUser } : null } }) } }) },
    '@/lib/payment/garanti/config': { controlledLiveAccountAllowed: id => id === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      garantiLiveSingleFinalizeArmed: (id, amount) => id === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' && amount === 300,
      garantiLiveObservationOnly: () => true },
    '@/lib/payment/provider': { paymentAvailableForUser: () => true },
    '@/lib/payment/repository': { paymentDatabase: () => ({ from: () => ({ select: () => {
      const query = { eq: () => query, in: () => query, is: () => query, limit: () => query,
        maybeSingle: async () => ({ data: { slot_id: '55555555-5555-4555-8555-555555555555' }, error: null }) }
      return query
    } }) }) },
  })('src/app/api/account/payments/garanti/single-finalize-status/route.ts').GET
  const allowed = await handler(new Request('https://example.invalid/api/account/payments/garanti/single-finalize-status')); assert.equal(allowed.status, 200)
  assert.deepEqual(await allowed.json(), { armed: true, unused: true, amountMinor: 300, currency: 'TRY',
    otherOrdersRemainObservationOnly: true, generalCustomerPaymentsEnabled: false, unresolvedExistingOrderCount: 0 })
  currentUser = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  assert.equal((await handler(new Request('https://example.invalid/api/account/payments/garanti/single-finalize-status'))).status, 404)
})

test('Production RPC self-test uses the authenticated account gate and service-role repository RPC', async () => {
  const allowedId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; let currentUser = allowedId, called = null
  const proof = { create: true, failureWriteReadback: true, evidenceWriteReadback: true, finalize: true,
    repeatFinalizeIdempotent: true, syntheticOnly: true, bankRequestSent: false, rollback: true,
    anonAuthenticatedDenied: true }
  const handler = loader({
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: currentUser ? { id: currentUser } : null } }) } }) },
    '@/lib/payment/garanti/config': { controlledLiveAccountAllowed: id => id === allowedId,
      garantiLiveSingleFinalizeArmed: (id, amount) => id === allowedId && amount === 300, garantiLiveObservationOnly: () => true },
    '@/lib/payment/provider': { paymentAvailableForUser: () => true },
    '@/lib/payment/repository': { paymentDatabase: () => ({ rpc: async (name, args) => { called = { name, args }; return { data: proof, error: null } } }) },
  })('src/app/api/account/payments/garanti/single-finalize-status/route.ts').GET
  const response = await handler(new Request('https://example.invalid/api/account/payments/garanti/single-finalize-status?verifyRpcs=1'))
  assert.equal(response.status, 200)
  assert.deepEqual(called, { name: 'nrs_test_garanti_live_single_finalize_rpcs', args: { p_user_id: allowedId } })
  assert.deepEqual(await response.json(), { ...proof, accountOnly: true, productionObservationOnly: true })
  currentUser = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; called = null
  assert.equal((await handler(new Request('https://example.invalid/api/account/payments/garanti/single-finalize-status?verifyRpcs=1'))).status, 404)
  assert.equal(called, null)
})

function fieldsSecret(body) { return new URLSearchParams(body).get('hash') }
