-- User-supplied live function definition; no live database connection.
CREATE OR REPLACE FUNCTION public.nrs_admin_update_order_status(p_order_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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

  UPDATE public.orders SET status = p_status WHERE id = p_order_id;
END;
$function$;
