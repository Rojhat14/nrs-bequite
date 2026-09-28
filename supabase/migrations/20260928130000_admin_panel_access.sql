-- Additive admin read access for existing customer/order tables plus a narrow
-- server RPC for operational order status changes. Existing policies are kept.
DO $$
BEGIN
  IF to_regclass('public.admin_users') IS NULL
     OR to_regprocedure('public.nrs_is_active_admin()') IS NULL THEN
    RAISE EXCEPTION 'Apply the admin and product foundation migrations before this migration.';
  END IF;
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.wishlist') IS NULL
     OR to_regclass('public.orders') IS NULL
     OR to_regclass('public.order_items') IS NULL THEN
    RAISE EXCEPTION 'An expected existing NRS customer/order table is missing; inspect live schema before continuing.';
  END IF;
END;
$$;

-- These are permissive SELECT policies restricted to active admins. They do
-- not remove or rewrite existing customer policies and grant no write access.
CREATE POLICY nrs_admin_panel_profiles_read
  ON public.profiles FOR SELECT TO authenticated
  USING (public.nrs_is_active_admin());

CREATE POLICY nrs_admin_panel_wishlist_read
  ON public.wishlist FOR SELECT TO authenticated
  USING (public.nrs_is_active_admin());

CREATE POLICY nrs_admin_panel_orders_read
  ON public.orders FOR SELECT TO authenticated
  USING (public.nrs_is_active_admin());

CREATE POLICY nrs_admin_panel_order_items_read
  ON public.order_items FOR SELECT TO authenticated
  USING (public.nrs_is_active_admin());

-- Admins may update only operational status via this function. In particular,
-- 'paid' remains exclusively controlled by the payment callback/provider.
CREATE OR REPLACE FUNCTION public.nrs_admin_update_order_status(p_order_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_status text;
BEGIN
  IF NOT public.nrs_is_active_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('pending', 'payment_pending', 'processing', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported operational order status' USING ERRCODE = '22023';
  END IF;

  SELECT o.status INTO current_status
  FROM public.orders AS o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;

  -- This legacy schema stores payment and fulfillment state in one column.
  -- Do not overwrite a payment result or advance an unpaid order to fulfillment.
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

-- Aggregate customer totals without exposing Auth Admin API or returning an
-- unbounded order/wishlist result to the browser.
CREATE OR REPLACE FUNCTION public.nrs_admin_user_summary(p_user_id uuid)
RETURNS TABLE(order_count bigint, total_order_amount numeric, favorite_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.nrs_is_active_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.orders AS o WHERE o.user_id = p_user_id),
    (SELECT coalesce(sum(o.total_amount), 0) FROM public.orders AS o WHERE o.user_id = p_user_id),
    (SELECT count(*) FROM public.wishlist AS w WHERE w.user_id = p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.nrs_admin_user_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nrs_admin_user_summary(uuid) TO authenticated;
