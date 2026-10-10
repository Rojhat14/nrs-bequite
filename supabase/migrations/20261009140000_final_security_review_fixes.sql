-- Corrective migration: F-01/F-02/F-03 from final security review.
-- Run ONLY after 20261009120000 and 20261009130000. No legacy rows repaired.
-- No live application authorized. Keep both payment flags false until staging.
BEGIN;
DO $$
DECLARE r record; state text; accepted boolean; status_column smallint; invalid_count bigint;
BEGIN
  IF to_regprocedure('public.nrs_is_active_admin()') IS NULL
    OR to_regprocedure('public.nrs_admin_update_order_status(uuid,text)') IS NULL
    OR to_regprocedure('public.nrs_finalize_payment(jsonb,text)') IS NULL
    OR NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
      AND table_name='payment_events' AND column_name='merchant_id' AND udt_name='text') THEN
    RAISE EXCEPTION 'Final security fix prerequisites missing: apply preceding hardening migrations first';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('orders','id','uuid'),('orders','user_id','uuid'),
    ('orders','status','text'),('payment_orders','order_id','uuid'),('payment_orders','state','text')) required(t,c,typ) LOOP
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
      AND table_name=r.t AND column_name=r.c AND udt_name=r.typ AND domain_name IS NULL) THEN
      RAISE EXCEPTION 'Schema mismatch: %.%; enum/domain status requires explicit review',r.t,r.c;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='orders'
    AND column_name='user_id' AND is_nullable='NO') THEN RAISE EXCEPTION 'Expected orders.user_id NOT NULL'; END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.payment_orders'::regclass AND contype='p'
    AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.payment_orders'::regclass AND attname='order_id')])
    OR NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.payment_orders'::regclass AND contype='f'
      AND confrelid='public.orders'::regclass
      AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.payment_orders'::regclass AND attname='order_id')]
      AND confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.orders'::regclass AND attname='id')]) THEN
    RAISE EXCEPTION 'Expected one payment per order and matching order FK';
  END IF;
  -- Validate every state written by create/finalize/admin, not only settlement.
  -- Composite status constraints cannot be evaluated without real row context.
  SELECT attnum INTO status_column FROM pg_attribute WHERE attrelid='public.orders'::regclass AND attname='status';
  FOR r IN SELECT conname,conkey,pg_get_expr(conbin,conrelid) expression FROM pg_constraint
    WHERE conrelid='public.orders'::regclass AND contype='c' AND status_column=ANY(conkey) LOOP
    IF r.conkey IS DISTINCT FROM ARRAY[status_column] THEN RAISE EXCEPTION 'Review composite status constraint %',r.conname; END IF;
    FOREACH state IN ARRAY ARRAY['pending','payment_pending','paid','processing','shipped','delivered','cancelled'] LOOP
      EXECUTE format('SELECT (%s) FROM jsonb_populate_record(NULL::public.orders,jsonb_build_object(''status'',$1))',r.expression)
        INTO accepted USING state;
      IF accepted IS DISTINCT FROM true THEN RAISE EXCEPTION 'Status % incompatible with constraint %',state,r.conname; END IF;
    END LOOP;
  END LOOP;
  -- Report counts only. Never guess the payment/fulfillment state of legacy rows.
  SELECT count(*) INTO invalid_count FROM public.orders WHERE status IS NULL OR status NOT IN
    ('pending','payment_pending','paid','processing','shipped','delivered','cancelled','refunded');
  RAISE NOTICE 'Legacy NULL/unknown statuses requiring manual review: %',invalid_count;
  IF EXISTS (SELECT FROM public.orders o JOIN public.payment_orders p ON p.order_id=o.id
    WHERE p.state IN ('initiating','pending') AND o.status IS DISTINCT FROM 'payment_pending') THEN
    RAISE EXCEPTION 'Existing unresolved payment/order conflict; authenticated provider reconciliation and manual review required';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.nrs_admin_update_order_status(p_order_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_status text;
  payment_state text;
  has_payment boolean;
BEGIN
  IF public.nrs_is_active_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('pending', 'payment_pending', 'processing', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported operational order status' USING ERRCODE = '22023';
  END IF;

  -- Match finalize lock order: payment first, then order. A callback either
  -- commits before this read or waits; no stale read can cancel settlement.
  SELECT p.state INTO payment_state FROM public.payment_orders p
  WHERE p.order_id=p_order_id FOR UPDATE;
  has_payment:=FOUND;

  SELECT o.status INTO current_status
  FROM public.orders AS o
  WHERE o.id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;

  IF current_status IS NULL OR current_status NOT IN
    ('pending','payment_pending','paid','processing','shipped','delivered','cancelled','refunded') THEN
    RAISE EXCEPTION 'unknown current order status; manual review required' USING ERRCODE='22023';
  END IF;
  IF has_payment AND (payment_state IS NULL OR payment_state NOT IN ('paid','failed')) THEN
    RAISE EXCEPTION 'Unresolved online payment; reconcile before operational changes' USING ERRCODE='22023';
  END IF;

  -- This legacy schema stores payment and fulfillment state in one column.
  -- Do not overwrite a payment result or advance an unpaid order to fulfillment.
  IF current_status='paid' AND p_status='processing' AND EXISTS (
    SELECT FROM public.payment_orders WHERE order_id=p_order_id AND state='paid'
  ) THEN
    -- Payment remains paid in payment_orders; orders.status may track fulfillment.
    UPDATE public.orders SET status='processing' WHERE id=p_order_id;
    RETURN;
  END IF;
  IF p_status='cancelled' AND current_status IN ('processing','shipped') AND EXISTS (
    SELECT FROM public.payment_orders WHERE order_id=p_order_id AND state='paid'
  ) THEN RAISE EXCEPTION 'Verified payment requires bank refund workflow, not manual cancellation' USING ERRCODE='22023'; END IF;
  IF current_status IN ('paid', 'refunded') THEN
    RAISE EXCEPTION 'payment state cannot be replaced by an operational status' USING ERRCODE = '22023';
  END IF;
  IF current_status IN ('pending', 'payment_pending') AND p_status <> 'cancelled' THEN
    RAISE EXCEPTION 'unpaid order cannot advance to fulfillment' USING ERRCODE = '22023';
  END IF;
  IF current_status = 'processing' AND p_status NOT IN ('shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported fulfillment transition' USING ERRCODE = '22023';
  END IF;
  IF current_status = 'shipped' AND p_status NOT IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported fulfillment transition' USING ERRCODE = '22023';
  END IF;
  IF current_status NOT IN ('pending', 'payment_pending', 'processing', 'shipped') THEN
    RAISE EXCEPTION 'current order status is not editable in admin' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET status = p_status
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.nrs_admin_update_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nrs_admin_update_order_status(uuid, text) TO authenticated;


COMMIT;
