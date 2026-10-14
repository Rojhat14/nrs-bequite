BEGIN;

-- Application expiry only: allow a dedicated order state while leaving the
-- independent bank payment state pending/unknown.
DO $migration$
DECLARE c record; status_column smallint; accepts boolean;
BEGIN
  SELECT attnum INTO status_column FROM pg_attribute
    WHERE attrelid='public.orders'::regclass AND attname='status' AND NOT attisdropped;
  IF status_column IS NULL THEN RAISE EXCEPTION 'orders.status is missing'; END IF;
  FOR c IN SELECT conname,pg_get_expr(conbin,conrelid) expression
    FROM pg_constraint WHERE conrelid='public.orders'::regclass AND contype='c' AND status_column=ANY(conkey)
  LOOP
    EXECUTE format('SELECT (%s) FROM jsonb_populate_record(NULL::public.orders,jsonb_build_object(''status'',$1))',c.expression)
      INTO STRICT accepts USING 'payment_unverified';
    IF accepts IS DISTINCT FROM true THEN
      EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I',c.conname);
      EXECUTE format('ALTER TABLE public.orders ADD CONSTRAINT %I CHECK ((%s) OR status = %L)',
        c.conname,c.expression,'payment_unverified');
    END IF;
  END LOOP;
END
$migration$;

CREATE TABLE IF NOT EXISTS public.garanti_late_settlement_reviews (
  provider text NOT NULL CHECK(provider='garanti-oos'),
  event_id text NOT NULL CHECK(length(event_id) BETWEEN 1 AND 200),
  order_id uuid NOT NULL REFERENCES public.payment_orders(order_id) ON DELETE RESTRICT,
  transaction_id text NOT NULL CHECK(length(transaction_id) BETWEEN 1 AND 200),
  merchant_id text NOT NULL CHECK(length(merchant_id) BETWEEN 1 AND 80),
  amount_minor bigint NOT NULL CHECK(amount_minor>0),
  currency text NOT NULL CHECK(currency='TRY'),
  three_ds text NOT NULL CHECK(three_ds IN ('authenticated','not_required')),
  signature_verified boolean NOT NULL CHECK(signature_verified),
  review_status text NOT NULL DEFAULT 'open' CHECK(review_status IN ('open','resolved')),
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(provider,transaction_id),
  UNIQUE(provider,event_id),
  UNIQUE(order_id,event_id)
);
ALTER TABLE public.garanti_late_settlement_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.garanti_late_settlement_reviews FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.garanti_late_settlement_reviews TO service_role;

CREATE OR REPLACE FUNCTION public.nrs_close_expired_garanti_no_record_order(
  p_order_id uuid,p_handoff_expires_at bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE payment public.payment_orders%ROWTYPE; app_status text; evidence jsonb; reservation record;
BEGIN
  IF NOT public.nrs_garanti_service_role_request() OR p_order_id IS NULL OR p_handoff_expires_at IS NULL
    OR p_handoff_expires_at >= floor(extract(epoch FROM now()))::bigint THEN
    RAISE EXCEPTION 'expired application handoff required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO payment FROM public.payment_orders WHERE order_id=p_order_id AND provider='garanti-oos' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Garanti order unavailable'; END IF;
  SELECT status INTO app_status FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF app_status='payment_unverified' AND payment.state='pending'
    AND payment.redirect_url IS NULL
    AND NOT EXISTS(SELECT FROM public.payment_stock_reservations WHERE order_id=p_order_id AND NOT released) THEN
    RETURN jsonb_build_object('closed',false,'idempotent',true,'reason','GARANTI_BANK_RECORD_NOT_FOUND');
  END IF;
  SELECT r.evidence INTO evidence FROM public.garanti_orderinq_reconciliations r
    WHERE r.order_id=p_order_id AND r.decision='pending' AND r.reason='GARANTI_BANK_RECORD_NOT_FOUND';
  IF payment.state IS DISTINCT FROM 'pending' OR app_status IS DISTINCT FROM 'payment_pending'
    OR payment.redirect_url IS NULL OR evidence IS NULL
    OR evidence->>'outer_response_code' IS DISTINCT FROM '92'
    OR evidence->>'outer_reason_code' IS DISTINCT FROM '0110'
    OR evidence->>'history_http' IS DISTINCT FROM '200'
    OR evidence->>'history_transaction_code' IS DISTINCT FROM '92'
    OR evidence->>'history_transaction_reason_code' IS DISTINCT FROM '0108'
    OR evidence->>'history_result_state' IS DISTINCT FROM 'empty'
    OR evidence->>'history_record_count' IS DISTINCT FROM '0'
    OR evidence->>'order_match' IS DISTINCT FROM 'true'
    OR evidence->>'terminal_match' IS DISTINCT FROM 'true'
    OR evidence->>'order_currency_match' IS DISTINCT FROM 'true'
    OR evidence->>'prov_user_match' IS DISTINCT FROM 'true'
    OR evidence->>'agent_user_match' IS DISTINCT FROM 'true'
    OR evidence->>'history_identity_match' IS DISTINCT FROM 'true'
    OR evidence->>'payment_event_count' IS DISTINCT FROM '0'
    OR evidence->>'signed_callback_evidence_count' IS DISTINCT FROM '0'
    OR evidence->>'live_finalize_evidence_count' IS DISTINCT FROM '0'
    OR EXISTS(SELECT FROM public.payment_events WHERE order_id=p_order_id)
    OR EXISTS(SELECT FROM public.garanti_payment_return_diagnostics WHERE order_id=p_order_id
      AND diagnostic->>'signature_verified'='true')
    OR EXISTS(SELECT FROM public.garanti_live_single_finalize_evidence WHERE order_id=p_order_id AND signature_verified)
    OR EXISTS(SELECT FROM public.garanti_live_single_finalize_failures WHERE order_id=p_order_id AND callback_signature_verified)
    OR EXISTS(SELECT FROM public.garanti_late_settlement_reviews WHERE order_id=p_order_id) THEN
    RAISE EXCEPTION 'no-record evidence or application state is not safe to close';
  END IF;
  IF NOT EXISTS(SELECT FROM public.payment_stock_reservations WHERE order_id=p_order_id AND NOT released) THEN
    RAISE EXCEPTION 'active stock reservation missing';
  END IF;
  UPDATE public.orders SET status='payment_unverified' WHERE id=p_order_id AND status='payment_pending';
  UPDATE public.payment_orders SET redirect_url=NULL,updated_at=now()
    WHERE order_id=p_order_id AND state='pending';
  FOR reservation IN SELECT * FROM public.payment_stock_reservations
    WHERE order_id=p_order_id AND NOT released ORDER BY variant_id FOR UPDATE LOOP
    UPDATE public.product_variants SET stock_quantity=stock_quantity+reservation.quantity WHERE id=reservation.variant_id;
    UPDATE public.payment_stock_reservations SET released=true
      WHERE order_id=p_order_id AND variant_id=reservation.variant_id AND NOT released;
  END LOOP;
  RETURN jsonb_build_object('closed',true,'idempotent',false,'reason','GARANTI_BANK_RECORD_NOT_FOUND');
END $$;
REVOKE ALL ON FUNCTION public.nrs_close_expired_garanti_no_record_order(uuid,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_close_expired_garanti_no_record_order(uuid,bigint) TO service_role;

-- Preserve any verified late success for an operator without changing the
-- bank/payment state, order state, event ledger or already-released stock.
DO $migration$
DECLARE definition text; marker text; replacement text;
BEGIN
  SELECT pg_get_functiondef('public.nrs_finalize_payment(jsonb,text)'::regprocedure) INTO definition;
  marker := '  SELECT status INTO order_status FROM public.orders WHERE id=payment.order_id FOR UPDATE;';
  IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Finalize function shape differs from reviewed version'; END IF;
  replacement := $block$  IF final_state='paid' AND order_status='payment_unverified' THEN
    IF p_payment->>'callbackSignatureVerified' IS DISTINCT FROM 'true'
      OR payment.state IS DISTINCT FROM 'pending'
      OR NOT EXISTS(SELECT FROM public.garanti_orderinq_reconciliations r
        WHERE r.order_id=payment.order_id AND r.decision='pending' AND r.reason='GARANTI_BANK_RECORD_NOT_FOUND') THEN
      RAISE EXCEPTION 'late verified callback review requires signed callback evidence';
    END IF;
    INSERT INTO public.garanti_late_settlement_reviews(provider,event_id,order_id,transaction_id,merchant_id,
      amount_minor,currency,three_ds,signature_verified)
    VALUES(p_provider,p_payment->>'eventId',payment.order_id,p_payment->>'transactionId',p_payment->>'merchantId',
      payment.amount_minor,payment.currency,p_payment->>'threeDS',true)
    ON CONFLICT(provider,event_id) DO NOTHING;
    IF NOT EXISTS(SELECT FROM public.garanti_late_settlement_reviews r WHERE r.provider=p_provider
      AND r.transaction_id=p_payment->>'transactionId' AND r.order_id=payment.order_id
      AND r.transaction_id=p_payment->>'transactionId' AND r.merchant_id=p_payment->>'merchantId'
      AND r.amount_minor=payment.amount_minor AND r.currency=payment.currency
      AND r.three_ds=p_payment->>'threeDS' AND r.signature_verified) THEN
      RAISE EXCEPTION 'late settlement replay mismatch';
    END IF;
    RETURN;
  END IF;
$block$;
  definition := replace(definition,marker,marker || replacement);
  EXECUTE definition;
END
$migration$;

CREATE OR REPLACE FUNCTION public.nrs_admin_late_settlement_reviews(p_order_id uuid DEFAULT NULL)
RETURNS TABLE(provider text,event_id text,order_id uuid,transaction_id text,merchant_id text,
  amount_minor bigint,currency text,three_ds text,signature_verified boolean,review_status text,received_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT r.provider,r.event_id,r.order_id,r.transaction_id,r.merchant_id,r.amount_minor,r.currency,
    r.three_ds,r.signature_verified,r.review_status,r.received_at
  FROM public.garanti_late_settlement_reviews r
  WHERE public.nrs_is_active_admin() IS TRUE AND (p_order_id IS NULL OR r.order_id=p_order_id)
  ORDER BY r.received_at DESC;
$$;
REVOKE ALL ON FUNCTION public.nrs_admin_late_settlement_reviews(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.nrs_admin_late_settlement_reviews(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.nrs_read_payment_order(p_order_id uuid,p_user_id uuid,p_guest_hash text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('id',p.order_id,
    'status',CASE WHEN o.status='payment_unverified' THEN 'payment_unverified' ELSE p.state END,
    'legal',to_jsonb(l))
    FROM public.payment_orders p JOIN public.order_legal_records l ON l.order_id=p.order_id
      JOIN public.orders o ON o.id=p.order_id
    WHERE p.order_id=p_order_id AND ((p.user_id IS NOT NULL AND p.user_id=p_user_id)
      OR (p.user_id IS NULL AND p.guest_hash=p_guest_hash AND p.guest_expires_at>now()));
$$;
REVOKE ALL ON FUNCTION public.nrs_read_payment_order(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_read_payment_order(uuid,uuid,text) TO service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
