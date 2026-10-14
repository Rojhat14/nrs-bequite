-- Permit the existing one-account/one-order live observation slot to cover
-- the explicitly selected public 3 TRY catalog item `deneme`. Other catalog
-- items, accounts, amounts, and the private trial SKU's rules remain scoped.
BEGIN;

CREATE OR REPLACE FUNCTION public.nrs_create_garanti_live_single_finalize_order(
  p_order_id uuid,p_user_id uuid,p_guest_hash text,p_key uuid,p_request_hash text,
  p_items jsonb,p_customer jsonb,p_legal jsonb,p_provider text,p_authorized_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  result jsonb;
  order_row public.payment_orders%ROWTYPE;
  claimed uuid;
  item jsonb;
  item_id text;
BEGIN
  IF p_authorized_user_id IS NULL OR p_user_id IS DISTINCT FROM p_authorized_user_id
    OR p_guest_hash IS NOT NULL OR p_provider IS DISTINCT FROM 'garanti-oos'
    OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'controlled live order not authorized' USING ERRCODE='42501';
  END IF;

  item:=p_items->0;
  item_id:=item->>'productId';
  IF item->>'quantity' IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'controlled live order must use one approved item' USING ERRCODE='22023';
  END IF;

  IF item_id='nrs-garanti-live-3try' THEN
    IF NOT EXISTS (
      SELECT FROM public.products p JOIN public.product_variants v ON v.product_id=p.id
      WHERE p.id='nrs-garanti-live-3try' AND p.status='active' AND p.payment_test_only
        AND p.currency='TRY' AND p.price_amount=3.00 AND p.in_stock
        AND v.id::text=item->>'variantId' AND v.is_active AND v.stock_quantity>=1
    ) THEN
      RAISE EXCEPTION 'controlled live order item unavailable' USING ERRCODE='22023';
    END IF;
  ELSIF item_id='deneme' THEN
    IF NOT EXISTS (
      SELECT FROM public.products p JOIN public.product_variants v ON v.product_id=p.id
      WHERE p.id='deneme' AND p.status='active' AND NOT p.payment_test_only
        AND p.currency='TRY' AND p.price_amount=3.00 AND p.in_stock
        AND v.id::text=item->>'variantId' AND v.is_active AND v.stock_quantity>=1
    ) THEN
      RAISE EXCEPTION 'controlled live catalog item unavailable' USING ERRCODE='22023';
    END IF;
  ELSE
    RAISE EXCEPTION 'controlled live order item not approved' USING ERRCODE='22023';
  END IF;

  result:=public.nrs_create_payment_order(p_order_id,p_user_id,p_guest_hash,p_key,p_request_hash,p_items,p_customer,p_legal,p_provider);
  IF coalesce((result->>'created')::boolean,false) THEN
    SELECT * INTO order_row FROM public.payment_orders WHERE order_id=(result->'order'->>'id')::uuid FOR UPDATE;
    IF NOT FOUND OR order_row.user_id IS DISTINCT FROM p_authorized_user_id OR order_row.provider IS DISTINCT FROM 'garanti-oos'
      OR order_row.amount_minor IS DISTINCT FROM 300 OR order_row.currency IS DISTINCT FROM 'TRY'
      OR order_row.state IS DISTINCT FROM 'initiating' THEN
      RAISE EXCEPTION 'controlled live order must be exactly 3 TRY';
    END IF;
    UPDATE public.garanti_live_single_finalize_slots
      SET claimed_order_id=order_row.order_id,claimed_at=now()
      WHERE user_id=p_authorized_user_id AND claimed_order_id IS NULL
      RETURNING claimed_order_id INTO claimed;
    IF claimed IS DISTINCT FROM order_row.order_id THEN
      RAISE EXCEPTION 'controlled live finalize slot unavailable' USING ERRCODE='P0001';
    END IF;
    INSERT INTO public.garanti_live_single_finalize_allowances(user_id,order_id)
      VALUES(p_authorized_user_id,order_row.order_id);
  END IF;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.nrs_create_garanti_live_single_finalize_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_create_garanti_live_single_finalize_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text,uuid)
  TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
