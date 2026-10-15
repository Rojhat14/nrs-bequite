const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')
const fixture = require('./payment-security-fixture.cjs')

const orderId = fixture.orderId
const safe = {
  signature_verified: false, signature_result: 'hashparams_invalid', order_match: null,
  amount_match: null, currency_match: null, terminal_match: null, request_match: null,
  mdstatus: '7', response: 'declined', procreturncode: '51',
  mderrormessage_present: true, errmsg_present: true, error_text_signed: false,
  error_category: 'unclassified', verification_basis: 'callback_runtime',
}

test('safe failure diagnostics support general order amounts and retain service-role-only storage', async () => {
  const db = new PGlite()
  try {
    await fixture.setup(db)
    await fixture.create(db)
    await db.exec(fs.readFileSync('supabase/migrations/20261014120000_garanti_failure_reconciliation.sql', 'utf8'))
    await db.exec(fs.readFileSync('supabase/migrations/20261015130000_garanti_general_callback_diagnostics.sql', 'utf8'))
    await db.query("UPDATE public.payment_orders SET provider='garanti-oos',state='pending',amount_minor=5540000,currency='TRY' WHERE order_id=$1::uuid", [orderId])
    await db.query("SELECT set_config('request.jwt.claim.role','service_role',false)")
    const record = () => db.query('SELECT public.nrs_record_garanti_payment_return_diagnostic($1::uuid,$2,$3,$4,$5::jsonb)',
      [orderId, 'failure', 'orderinq_result', 'GARANTI_ORDERINQ_PENDING', JSON.stringify(safe)])
    await record()
    const row = (await db.query('SELECT diagnostic,source,safe_code FROM public.garanti_payment_return_diagnostics WHERE order_id=$1::uuid', [orderId])).rows[0]
    assert.equal(row.source, 'failure')
    assert.equal(row.safe_code, 'GARANTI_ORDERINQ_PENDING')
    assert.deepEqual(row.diagnostic, safe)
    await db.query('SELECT public.nrs_record_garanti_payment_return_diagnostic($1::uuid,$2,$3,$4,$5::jsonb)',
      [orderId, 'failure', 'callback_signature', 'GARANTI_ORDERINQ_CONFIGURED_FAILURE_STATUS',
        JSON.stringify({ ...safe, signature_verified: true, signature_result: 'verified', verification_basis: 'callback_runtime' })])
    await record() // a later untrusted retry must not downgrade verified evidence
    const strongest = (await db.query('SELECT diagnostic,safe_code FROM public.garanti_payment_return_diagnostics WHERE order_id=$1::uuid', [orderId])).rows[0]
    assert.equal(strongest.diagnostic.signature_verified, true)
    assert.equal(strongest.diagnostic.signature_result, 'verified')
    assert.equal(strongest.safe_code, 'GARANTI_ORDERINQ_CONFIGURED_FAILURE_STATUS')
    await assert.rejects(db.query('SELECT public.nrs_record_garanti_payment_return_diagnostic($1::uuid,$2,$3,$4,$5::jsonb)',
      [orderId, 'failure', 'orderinq_result', 'GARANTI_ORDERINQ_PENDING', JSON.stringify({ ...safe, raw_post: 'must-not-persist' })]), /invalid safe Garanti callback diagnostic/)
    assert.equal((await db.query("SELECT has_function_privilege('anon','public.nrs_record_garanti_payment_return_diagnostic(uuid,text,text,text,jsonb)','EXECUTE') allowed")).rows[0].allowed, false)
    assert.equal((await db.query("SELECT has_function_privilege('authenticated','public.nrs_record_garanti_payment_return_diagnostic(uuid,text,text,text,jsonb)','EXECUTE') allowed")).rows[0].allowed, false)
  } finally { await db.close() }
})
