-- A missing bank order record is recorded as pending evidence, not a terminal
-- decline. It must never block an unrelated, separately idempotent checkout.
BEGIN;

DO $migration$
DECLARE
  definition text;
  updated text;
BEGIN
  SELECT pg_get_functiondef('public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'::regprocedure)
    INTO definition;
  IF definition IS NULL THEN RAISE EXCEPTION 'Payment order RPC is missing'; END IF;

  updated := regexp_replace(definition,
    $pattern$IF EXISTS \(SELECT FROM public\.payment_orders WHERE user_id=p_user_id AND state IN \('initiating','pending'\)\) THEN[[:space:]]*RAISE EXCEPTION 'Unresolved payment exists; reconcile before a new attempt';[[:space:]]*END IF;$pattern$,
    '', 'g');
  IF updated <> definition THEN EXECUTE updated; END IF;

  IF position('Unresolved payment exists; reconcile before a new attempt' IN updated) > 0
    OR position('idempotency_key=p_key FOR UPDATE' IN updated) = 0
    OR position('stock_quantity<quantity' IN updated) = 0 THEN
    RAISE EXCEPTION 'Payment RPC still has a broad pending guard or lost its per-key/stock checks';
  END IF;
END
$migration$;

ALTER TABLE public.garanti_orderinq_reconciliations
  DROP CONSTRAINT IF EXISTS garanti_orderinq_reconciliations_evidence_check;
ALTER TABLE public.garanti_orderinq_reconciliations
  ADD CONSTRAINT garanti_orderinq_reconciliations_evidence_check CHECK (
    evidence - ARRAY[
      'order_id','decision','reason','order_match','terminal_match','mode_match','order_currency_match','prov_user_match','agent_user_match',
      'order_result_present','amount_match','outer_response_code','outer_reason_code','result_code','result_reason_code',
      'status','charge_type','auth_amount_state','auth_code_present','bank_reference_present',
      'history_http','history_transaction_code','history_transaction_reason_code','history_result_state',
      'history_record_count','history_identity_match','payment_event_count','signed_callback_evidence_count',
      'live_finalize_evidence_count','callback_signature_verified','signature_evidence_present'
    ]::text[] = '{}'::jsonb
    AND (NOT evidence ? 'payment_event_count' OR
      (jsonb_typeof(evidence->'payment_event_count')='number' AND (evidence->>'payment_event_count')::numeric >= 0))
    AND (NOT evidence ? 'signed_callback_evidence_count' OR
      (jsonb_typeof(evidence->'signed_callback_evidence_count')='number' AND (evidence->>'signed_callback_evidence_count')::numeric >= 0))
    AND (NOT evidence ? 'live_finalize_evidence_count' OR
      (jsonb_typeof(evidence->'live_finalize_evidence_count')='number' AND (evidence->>'live_finalize_evidence_count')::numeric >= 0))
  );

-- Keep the service-only recorder's own allowlist in sync with the table check.
-- Updating the table constraint alone would make the RPC reject the new safe
-- no-record proof fields before the row reaches that constraint.
DO $migration$
DECLARE
  definition text;
  old_keys text := '''history_result_state'',''history_record_count'',''history_identity_match'',''callback_signature_verified'',''signature_evidence_present''';
  new_keys text := old_keys || ',''order_currency_match'',''prov_user_match'',''agent_user_match'',''order_result_present'',''payment_event_count'',''signed_callback_evidence_count'',''live_finalize_evidence_count''';
BEGIN
  SELECT pg_get_functiondef('public.nrs_record_garanti_orderinq_reconciliation(uuid,text,text,jsonb)'::regprocedure)
    INTO definition;
  IF definition IS NULL THEN RAISE EXCEPTION 'Garanti reconciliation RPC is missing'; END IF;
  IF position('payment_event_count' IN definition) > 0
    AND position('signed_callback_evidence_count' IN definition) > 0
    AND position('live_finalize_evidence_count' IN definition) > 0 THEN
    RETURN;
  END IF;
  IF position(old_keys IN definition) = 0 THEN
    RAISE EXCEPTION 'Garanti reconciliation RPC allowlist differs from the reviewed schema';
  END IF;
  definition := replace(definition, old_keys, new_keys);
  EXECUTE definition;
END
$migration$;

NOTIFY pgrst,'reload schema';
COMMIT;
