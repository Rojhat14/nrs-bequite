-- Let admins clear unpaid cancelled orders out of the working order list.
-- Orders cannot be deleted: order_legal_records and payment_orders reference
-- them ON DELETE RESTRICT, and distance-sales records must be retained. An
-- archived order keeps every row; only the admin list hides it, and it can be
-- restored. Only cancelled orders with no confirmed transfer and no online
-- payment other than a failed one can be archived.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
  IF to_regprocedure('public.nrs_is_active_admin()') IS NULL
    OR to_regclass('public.payment_orders') IS NULL
    OR NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.orders'::regclass AND attname = 'manual_paid_at' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Admin, payment and manual-order foundations are required';
  END IF;
END
$preflight$;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.nrs_admin_set_order_archived(p_order_id uuid, p_archived boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_status text;
  manual_paid timestamptz;
  payment_state text;
  has_payment boolean;
BEGIN
  IF public.nrs_is_active_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  IF p_archived IS NULL THEN
    RAISE EXCEPTION 'archive flag is required' USING ERRCODE = '22023';
  END IF;

  -- Same lock order as payment finalisation: payment first, then order.
  SELECT p.state INTO payment_state FROM public.payment_orders p WHERE p.order_id = p_order_id FOR UPDATE;
  has_payment := FOUND;
  SELECT o.status, o.manual_paid_at INTO current_status, manual_paid FROM public.orders o WHERE o.id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_archived THEN
    IF current_status IS DISTINCT FROM 'cancelled' THEN
      RAISE EXCEPTION 'only cancelled orders can be archived' USING ERRCODE = '22023';
    END IF;
    IF manual_paid IS NOT NULL OR (has_payment AND payment_state IS DISTINCT FROM 'failed') THEN
      RAISE EXCEPTION 'paid or unresolved orders cannot be archived' USING ERRCODE = '22023';
    END IF;
    UPDATE public.orders SET admin_archived_at = COALESCE(admin_archived_at, now()) WHERE id = p_order_id;
  ELSE
    UPDATE public.orders SET admin_archived_at = NULL WHERE id = p_order_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.nrs_admin_archive_unpaid_cancelled_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  archived integer;
BEGIN
  IF public.nrs_is_active_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  WITH target AS (
    SELECT o.id FROM public.orders o
    WHERE o.status = 'cancelled' AND o.admin_archived_at IS NULL AND o.manual_paid_at IS NULL
      AND NOT EXISTS (SELECT FROM public.payment_orders p WHERE p.order_id = o.id AND p.state IS DISTINCT FROM 'failed')
    FOR UPDATE OF o
  )
  UPDATE public.orders o SET admin_archived_at = now() FROM target WHERE o.id = target.id;
  GET DIAGNOSTICS archived = ROW_COUNT;
  RETURN archived;
END;
$$;

REVOKE ALL ON FUNCTION public.nrs_admin_set_order_archived(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nrs_admin_set_order_archived(uuid, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.nrs_admin_archive_unpaid_cancelled_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nrs_admin_archive_unpaid_cancelled_orders() TO authenticated;

COMMIT;
