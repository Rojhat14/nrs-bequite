-- Enables server-created guest orders while preserving direct-table RLS.
-- This migration does not grant anon/authenticated table or RPC access.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
DECLARE definition text; updated text; expected_security boolean;
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='orders'
      AND column_name='user_id' AND udt_name='uuid' AND is_nullable='NO') THEN
    RAISE EXCEPTION 'Expected orders.user_id uuid NOT NULL; inspect ownership schema before guest migration';
  END IF;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_orders'
      AND column_name='guest_hash' AND udt_name='text')
     OR NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_orders'
      AND column_name='guest_expires_at' AND udt_name='timestamptz') THEN
    RAISE EXCEPTION 'Existing payment guest capability schema is missing; migration stopped';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_class WHERE oid='public.orders'::regclass AND relrowsecurity)
     OR NOT EXISTS (SELECT FROM pg_class WHERE oid='public.order_items'::regclass AND relrowsecurity)
     OR NOT EXISTS (SELECT FROM pg_class WHERE oid='public.payment_orders'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'Order/payment RLS must remain enabled';
  END IF;
  IF has_table_privilege('anon','public.orders','SELECT') OR has_table_privilege('anon','public.orders','INSERT')
     OR has_table_privilege('anon','public.order_items','SELECT') OR has_table_privilege('anon','public.order_items','INSERT')
     OR has_table_privilege('anon','public.payment_orders','SELECT') OR has_table_privilege('anon','public.payment_orders','INSERT') THEN
    RAISE EXCEPTION 'Anonymous direct table privileges detected; no privilege changes applied';
  END IF;
  IF has_function_privilege('anon','public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)','EXECUTE')
     OR has_function_privilege('authenticated','public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Payment order RPC is not service-role-only';
  END IF;

  SELECT pg_get_functiondef(p.oid),p.prosecdef INTO definition,expected_security
    FROM pg_proc p WHERE p.oid='public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'::regprocedure;
  IF definition NOT LIKE '%IF p_user_id IS NULL OR p_guest_hash IS NOT NULL THEN RAISE EXCEPTION ''Authenticated checkout required''; END IF;%'
     OR definition NOT LIKE '%hashtextextended(''payment-owner:''||p_user_id::text,0)%' THEN
    RAISE EXCEPTION 'Payment RPC differs from the reviewed authenticated-only owner checks';
  END IF;

  updated := replace(definition,
    'IF p_user_id IS NULL OR p_guest_hash IS NOT NULL THEN RAISE EXCEPTION ''Authenticated checkout required''; END IF;',
    'IF (p_user_id IS NULL AND (p_guest_hash IS NULL OR p_guest_hash !~ ''^[0-9a-f]{64}$'')) OR (p_user_id IS NOT NULL AND p_guest_hash IS NOT NULL) THEN RAISE EXCEPTION ''Invalid order owner''; END IF;');
  updated := replace(updated,
    'hashtextextended(''payment-owner:''||p_user_id::text,0)',
    'hashtextextended(''payment-owner:''||coalesce(p_user_id::text,''guest:''||p_guest_hash),0)');
  IF updated=definition
     OR updated LIKE '%Authenticated checkout required%'
     OR updated NOT LIKE '%p_guest_hash !~ ''^[0-9a-f]{64}$''%'
     OR updated NOT LIKE '%guest:''||p_guest_hash%' THEN
    RAISE EXCEPTION 'Guest owner RPC update did not pass postflight checks';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'::regprocedure) IS DISTINCT FROM expected_security THEN
    RAISE EXCEPTION 'Payment RPC security mode changed unexpectedly';
  END IF;

  ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;
  EXECUTE updated;
END
$preflight$;

NOTIFY pgrst, 'reload schema';
COMMIT;
