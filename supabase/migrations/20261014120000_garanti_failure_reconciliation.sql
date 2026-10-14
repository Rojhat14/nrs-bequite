BEGIN;

CREATE TABLE IF NOT EXISTS public.garanti_payment_return_diagnostics (
  order_id uuid NOT NULL REFERENCES public.payment_orders(order_id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('success','failure')),
  failure_stage text NOT NULL CHECK (failure_stage ~ '^[a-z_]{1,40}$'),
  safe_code text NOT NULL CHECK (safe_code ~ '^GARANTI_[A-Z0-9_]{1,80}$'),
  diagnostic jsonb NOT NULL CHECK (jsonb_typeof(diagnostic)='object'),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(order_id,source),
  CHECK (diagnostic - ARRAY['signature_verified','signature_result','order_match','amount_match','currency_match',
    'terminal_match','request_match','mdstatus','response','procreturncode','mderrormessage_present','errmsg_present',
    'error_text_signed','error_category','verification_basis']::text[] = '{}'::jsonb)
);
ALTER TABLE public.garanti_payment_return_diagnostics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.garanti_payment_return_diagnostics FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.garanti_payment_return_diagnostics TO service_role;

CREATE OR REPLACE FUNCTION public.nrs_record_garanti_payment_return_diagnostic(
  p_order_id uuid,p_source text,p_failure_stage text,p_safe_code text,p_diagnostic jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
    OR p_order_id IS NULL OR p_source NOT IN ('success','failure')
    OR p_failure_stage IS NULL OR p_failure_stage !~ '^[a-z_]{1,40}$'
    OR p_safe_code IS NULL OR p_safe_code !~ '^GARANTI_[A-Z0-9_]{1,80}$'
    OR jsonb_typeof(p_diagnostic) IS DISTINCT FROM 'object'
    OR (p_diagnostic - ARRAY['signature_verified','signature_result','order_match','amount_match','currency_match',
      'terminal_match','request_match','mdstatus','response','procreturncode','mderrormessage_present','errmsg_present',
      'error_text_signed','error_category','verification_basis']::text[]) <> '{}'::jsonb
    OR (p_diagnostic ? 'signature_verified' AND jsonb_typeof(p_diagnostic->'signature_verified') NOT IN ('boolean','null'))
    OR (p_diagnostic ? 'signature_result' AND p_diagnostic->>'signature_result' NOT IN
      ('verified','hashparams_invalid','hash_format_invalid','encoding_rejected','hash_mismatch','field_duplicate_field','not_evaluated','parse_rejected'))
    OR (p_diagnostic ? 'mdstatus' AND p_diagnostic->>'mdstatus' !~ '^[0-7]$')
    OR (p_diagnostic ? 'response' AND p_diagnostic->>'response' NOT IN ('approved','declined','error','failed'))
    OR (p_diagnostic ? 'procreturncode' AND p_diagnostic->>'procreturncode' !~ '^\d{2}$')
    OR (p_diagnostic ? 'error_category' AND p_diagnostic->>'error_category' !~ '^[a-z_]{1,32}$')
    OR NOT EXISTS (SELECT 1 FROM public.payment_orders p WHERE p.order_id=p_order_id
      AND p.provider='garanti-oos' AND p.amount_minor <= 1000 AND p.currency='TRY'
      AND p.state IN ('pending','paid','failed')) THEN
    RAISE EXCEPTION 'invalid safe Garanti callback diagnostic' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.garanti_payment_return_diagnostics(order_id,source,failure_stage,safe_code,diagnostic)
  VALUES(p_order_id,p_source,p_failure_stage,p_safe_code,p_diagnostic)
  ON CONFLICT(order_id,source) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.nrs_record_garanti_payment_return_diagnostic(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_record_garanti_payment_return_diagnostic(uuid,text,text,text,jsonb) TO service_role;

CREATE TABLE IF NOT EXISTS public.garanti_orderinq_reconciliations (
  order_id uuid PRIMARY KEY REFERENCES public.payment_orders(order_id) ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('verified_success','verified_failure','pending')),
  reason text NOT NULL CHECK (reason ~ '^GARANTI_[A-Z0-9_]{1,80}$'),
  evidence jsonb NOT NULL CHECK (jsonb_typeof(evidence)='object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (evidence - ARRAY['order_id','decision','reason','order_match','terminal_match','mode_match','amount_match',
    'outer_response_code','outer_reason_code','result_code','result_reason_code','status','charge_type','auth_amount_state',
    'auth_code_present','bank_reference_present','history_http','history_transaction_code','history_transaction_reason_code',
    'history_result_state','history_record_count','history_identity_match','callback_signature_verified','signature_evidence_present']::text[] = '{}'::jsonb)
);
ALTER TABLE public.garanti_orderinq_reconciliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.garanti_orderinq_reconciliations FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.garanti_orderinq_reconciliations TO service_role;

CREATE OR REPLACE FUNCTION public.nrs_record_garanti_orderinq_reconciliation(
  p_order_id uuid,p_decision text,p_reason text,p_evidence jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
    OR p_order_id IS NULL OR p_decision NOT IN ('verified_success','verified_failure','pending')
    OR p_reason IS NULL OR p_reason !~ '^GARANTI_[A-Z0-9_]{1,80}$'
    OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'object'
    OR (p_evidence - ARRAY['order_id','decision','reason','order_match','terminal_match','mode_match','amount_match',
      'outer_response_code','outer_reason_code','result_code','result_reason_code','status','charge_type','auth_amount_state',
      'auth_code_present','bank_reference_present','history_http','history_transaction_code','history_transaction_reason_code',
      'history_result_state','history_record_count','history_identity_match','callback_signature_verified','signature_evidence_present']::text[]) <> '{}'::jsonb
    OR (p_evidence ? 'order_id' AND p_evidence->>'order_id' IS DISTINCT FROM p_order_id::text)
    OR (p_evidence ? 'decision' AND p_evidence->>'decision' IS DISTINCT FROM p_decision)
    OR (p_evidence ? 'reason' AND p_evidence->>'reason' IS DISTINCT FROM p_reason)
    OR NOT EXISTS (SELECT 1 FROM public.payment_orders p WHERE p.order_id=p_order_id
      AND p.provider='garanti-oos' AND p.state='pending' AND p.currency='TRY') THEN
    RAISE EXCEPTION 'invalid Garanti reconciliation evidence' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.garanti_orderinq_reconciliations(order_id,decision,reason,evidence,updated_at)
  VALUES(p_order_id,p_decision,p_reason,p_evidence,now())
  ON CONFLICT(order_id) DO UPDATE SET decision=excluded.decision,reason=excluded.reason,evidence=excluded.evidence,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.nrs_record_garanti_orderinq_reconciliation(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_record_garanti_orderinq_reconciliation(uuid,text,text,jsonb) TO service_role;

-- A terminal failed event is committed once, releases each reservation once,
-- and invalidates the submitted bank handoff in the same database transaction.
-- A later contradictory success is rejected by the locked terminal-state check.
CREATE OR REPLACE FUNCTION public.nrs_finalize_payment(p_payment jsonb,p_provider text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE payment public.payment_orders%ROWTYPE; event public.payment_events%ROWTYPE; reservation record; final_state text; order_status text;
BEGIN
  IF jsonb_typeof(p_payment) IS DISTINCT FROM 'object' OR p_provider IS NULL OR btrim(p_provider)=''
    OR EXISTS (SELECT FROM unnest(ARRAY['merchantId','merchantReference','transactionId','eventId','currency','status','threeDS']) field
      WHERE jsonb_typeof(p_payment->field) IS DISTINCT FROM 'string' OR btrim(p_payment->>field)='')
    OR jsonb_typeof(p_payment->'amountMinor') IS DISTINCT FROM 'number'
    OR (p_payment->>'amountMinor') !~ '^[0-9]+$' OR (p_payment->>'amountMinor')::numeric<=0
    OR p_payment->>'status' NOT IN ('paid','failed','pending')
    OR p_payment->>'threeDS' NOT IN ('authenticated','not_required','failed')
    OR (p_payment->>'status'='paid' AND p_payment->>'threeDS' NOT IN ('authenticated','not_required')) THEN
    RAISE EXCEPTION 'unverified payment';
  END IF;
  SELECT * INTO payment FROM public.payment_orders WHERE merchant_reference=(p_payment->>'merchantReference')::uuid FOR UPDATE;
  IF NOT FOUND OR payment.provider IS DISTINCT FROM p_provider OR payment.amount_minor IS DISTINCT FROM (p_payment->>'amountMinor')::bigint
    OR payment.currency IS DISTINCT FROM p_payment->>'currency' THEN RAISE EXCEPTION 'verified result mismatch'; END IF;
  SELECT * INTO event FROM public.payment_events WHERE provider=p_provider AND event_id=p_payment->>'eventId';
  IF FOUND THEN
    IF event.order_id IS DISTINCT FROM payment.order_id OR event.transaction_id IS DISTINCT FROM p_payment->>'transactionId'
      OR event.state IS DISTINCT FROM p_payment->>'status' OR event.amount_minor IS DISTINCT FROM payment.amount_minor OR event.currency IS DISTINCT FROM payment.currency
      OR event.three_ds IS DISTINCT FROM p_payment->>'threeDS' OR event.merchant_id IS DISTINCT FROM p_payment->>'merchantId' THEN RAISE EXCEPTION 'event replay mismatch'; END IF;
    RETURN;
  END IF;
  final_state:=p_payment->>'status';
  IF final_state NOT IN ('paid','failed','pending') OR (final_state='paid' AND p_payment->>'threeDS' NOT IN ('authenticated','not_required')) THEN RAISE EXCEPTION 'unverified payment'; END IF;
  IF payment.state IN ('paid','failed') THEN RAISE EXCEPTION 'terminal payment already finalized'; END IF;
  IF payment.transaction_id IS NOT NULL AND payment.transaction_id IS DISTINCT FROM p_payment->>'transactionId' THEN RAISE EXCEPTION 'transaction mismatch'; END IF;
  SELECT status INTO order_status FROM public.orders WHERE id=payment.order_id FOR UPDATE;
  IF order_status IS NULL OR (final_state='paid' AND order_status NOT IN ('payment_pending','paid'))
    OR (final_state='failed' AND order_status IS DISTINCT FROM 'payment_pending') THEN
    RAISE EXCEPTION 'order state conflict; reconcile';
  END IF;
  INSERT INTO public.payment_events(provider,event_id,order_id,transaction_id,amount_minor,currency,state,three_ds,merchant_id)
    VALUES(p_provider,p_payment->>'eventId',payment.order_id,p_payment->>'transactionId',payment.amount_minor,p_payment->>'currency',final_state,p_payment->>'threeDS',p_payment->>'merchantId');
  IF final_state='pending' THEN RETURN; END IF;
  UPDATE public.payment_orders SET state=final_state,transaction_id=p_payment->>'transactionId',
    redirect_url=CASE WHEN final_state='failed' THEN NULL ELSE redirect_url END,updated_at=now()
    WHERE order_id=payment.order_id;
  IF final_state='paid' THEN
    UPDATE public.orders SET status='paid' WHERE id=payment.order_id;
  ELSE
    FOR reservation IN SELECT * FROM public.payment_stock_reservations WHERE order_id=payment.order_id AND NOT released ORDER BY variant_id FOR UPDATE LOOP
      UPDATE public.product_variants SET stock_quantity=stock_quantity+reservation.quantity WHERE id=reservation.variant_id;
      UPDATE public.payment_stock_reservations SET released=true WHERE order_id=payment.order_id AND variant_id=reservation.variant_id AND NOT released;
    END LOOP;
    UPDATE public.orders SET status='payment_failed' WHERE id=payment.order_id AND status='payment_pending';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.nrs_finalize_payment(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_finalize_payment(jsonb,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
