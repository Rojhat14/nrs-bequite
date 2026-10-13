-- Customer cancellation is serialized with handoff claim and payment finalize.
-- Same-key creation remains idempotent; distinct orders are stock-checked independently.
BEGIN;

DO $migration$
DECLARE
  definition text;
  old_guard text := $old$
  -- Serialize new attempts per owner as well as per key. A lost browser key or
  -- changed cart must not initiate a second payment while settlement is unknown.
  PERFORM pg_advisory_xact_lock(hashtextextended('payment-owner:'||p_user_id::text,0));
  IF EXISTS (SELECT FROM public.payment_orders WHERE user_id=p_user_id AND state IN ('initiating','pending')) THEN
    RAISE EXCEPTION 'Unresolved payment exists; reconcile before a new attempt';
  END IF;
$old$;
  new_guard text := $new$
  -- Serialize writes per owner, but do not make unrelated carts wait on the
  -- settlement of a prior order. Same-key retries are checked above and every
  -- new order locks/checks its own product variants before reserving stock.
  PERFORM pg_advisory_xact_lock(hashtextextended('payment-owner:'||p_user_id::text,0));
$new$;
BEGIN
  SELECT pg_get_functiondef('public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'::regprocedure)
    INTO definition;
  IF definition IS NULL OR position(old_guard IN definition)=0 THEN
    RAISE EXCEPTION 'Expected payment owner guard not found; refusing migration';
  END IF;
  EXECUTE replace(definition,old_guard,new_guard);
END
$migration$;

CREATE OR REPLACE FUNCTION public.nrs_customer_cancel_order(p_order_id uuid,p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  payment public.payment_orders%ROWTYPE;
  order_row public.orders%ROWTYPE;
  reservation record;
  has_payment boolean := false;
BEGIN
  IF p_order_id IS NULL OR p_user_id IS NULL THEN RETURN 'not_found'; END IF;

  -- Match callback/finalize order: payment row first, order row second.
  SELECT * INTO payment FROM public.payment_orders WHERE order_id=p_order_id FOR UPDATE;
  has_payment := FOUND;
  SELECT * INTO order_row FROM public.orders WHERE id=p_order_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;

  IF order_row.status='paid' OR order_row.status='refunded' OR order_row.manual_paid_at IS NOT NULL
    OR (has_payment AND payment.state='paid') THEN RETURN 'paid'; END IF;
  IF order_row.status='cancelled' THEN
    IF NOT has_payment OR payment.state='failed' THEN RETURN 'cancelled'; END IF;
    -- A cancelled row paired with an unresolved bank transaction is a conflict.
    RETURN 'needs_reconcile';
  END IF;

  IF has_payment THEN
    IF payment.user_id IS DISTINCT FROM p_user_id THEN RETURN 'not_found'; END IF;
    IF payment.state='failed' THEN RETURN 'not_cancellable'; END IF;
    IF payment.state NOT IN ('initiating','pending') THEN RETURN 'needs_reconcile'; END IF;
    IF payment.state='pending' AND payment.redirect_url IS NOT NULL
      AND payment.redirect_url ~ '([?&])used=1(&|$)' THEN RETURN 'needs_reconcile'; END IF;
    -- A missing redirect is still pre-handoff: initiation only created a signed
    -- application URL. A stored unused link has not passed the POST/CAS gate.
    IF order_row.status NOT IN ('payment_pending','pending') THEN RETURN 'not_cancellable'; END IF;

    UPDATE public.payment_orders SET state='failed',redirect_url=NULL,updated_at=now()
      WHERE order_id=p_order_id AND state IN ('initiating','pending');
    IF NOT FOUND THEN RETURN 'needs_reconcile'; END IF;
    UPDATE public.orders SET status='cancelled' WHERE id=p_order_id AND user_id=p_user_id
      AND status IN ('payment_pending','pending');
    IF NOT FOUND THEN RAISE EXCEPTION 'order state changed during cancellation'; END IF;
    FOR reservation IN SELECT * FROM public.payment_stock_reservations
      WHERE order_id=p_order_id AND NOT released ORDER BY variant_id FOR UPDATE LOOP
      UPDATE public.product_variants SET stock_quantity=stock_quantity+reservation.quantity
        WHERE id=reservation.variant_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'reservation variant missing'; END IF;
      UPDATE public.payment_stock_reservations SET released=true
        WHERE order_id=p_order_id AND variant_id=reservation.variant_id AND NOT released;
    END LOOP;
    RETURN 'cancelled';
  END IF;

  -- The legacy manual-order RPC reserves no inventory. Only its explicit
  -- request key identifies an eligible unpaid order in this no-payment path.
  IF order_row.manual_request_key IS NOT NULL AND order_row.status='pending' THEN
    UPDATE public.orders SET status='cancelled'
      WHERE id=p_order_id AND user_id=p_user_id AND status='pending' AND manual_paid_at IS NULL;
    IF FOUND THEN RETURN 'cancelled'; END IF;
    RETURN 'paid';
  END IF;
  RETURN 'not_cancellable';
END
$function$;

REVOKE ALL ON FUNCTION public.nrs_customer_cancel_order(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_customer_cancel_order(uuid,uuid) TO service_role;
COMMIT;
