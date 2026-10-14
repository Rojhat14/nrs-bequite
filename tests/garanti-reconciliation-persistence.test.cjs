const test = require('node:test');
const assert = require('node:assert/strict');
const { loader } = require('./source-loader.cjs');

test('orderinq evidence is projected onto the RPC safe allowlist before persistence', async () => {
  let call;
  const load = loader({
    '@supabase/supabase-js': { createClient: () => ({ rpc: async (...args) => { call = args; return { error: null }; } }) },
    './config': { requirePaymentDeployment() {} },
  });
  process.env.PAYMENT_DATABASE_VERIFIED = 'true';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  try {
    const { saveGarantiOrderinqReconciliation } = load('src/lib/payment/repository.ts');
    await saveGarantiOrderinqReconciliation('11111111-1111-4111-8111-111111111111', 'pending',
      'GARANTI_BANK_RECORD_NOT_FOUND', {
        order_id: '11111111-1111-4111-8111-111111111111', decision: 'pending',
        reason: 'GARANTI_BANK_RECORD_NOT_FOUND', http: 200, request_amount_minor: 300,
        order_currency_match: true, outer_response_code: '92', outer_reason_code: '0110',
        history_http: 200, history_transaction_code: '92',
        history_transaction_reason_code: '0108', history_result_state: 'empty',
        history_record_count: 0, history_identity_match: true,
        payment_event_count: 0, signed_callback_evidence_count: 0, live_finalize_evidence_count: 0,
        raw_post: 'must-not-persist',
      });
    assert.equal(call[0], 'nrs_record_garanti_orderinq_reconciliation');
    const evidence = call[1].p_evidence;
    assert.equal(evidence.outer_response_code, '92');
    assert.equal(evidence.history_transaction_reason_code, '0108');
    assert.equal(evidence.http, undefined);
    assert.equal(evidence.request_amount_minor, undefined);
    assert.equal(evidence.raw_post, undefined);
    assert.equal(Object.keys(evidence).every(key => !['http', 'raw_post', 'request_amount_minor'].includes(key)), true);
  } finally {
    delete process.env.PAYMENT_DATABASE_VERIFIED;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
});
