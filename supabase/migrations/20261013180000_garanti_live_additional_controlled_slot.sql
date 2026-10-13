-- Preserve prior claimed live attempts and permit one separately claimed slot
-- for the same explicitly controlled account. Only this exact private 3 TRY
-- item may use the narrow pending-payment exception.
BEGIN;

ALTER TABLE public.garanti_live_single_finalize_slots
  DROP CONSTRAINT IF EXISTS garanti_live_single_finalize_slots_pkey;
ALTER TABLE public.garanti_live_single_finalize_slots
  ADD COLUMN IF NOT EXISTS slot_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.garanti_live_single_finalize_slots
  ADD CONSTRAINT garanti_live_single_finalize_slots_pkey PRIMARY KEY (slot_id);
CREATE UNIQUE INDEX IF NOT EXISTS garanti_live_single_finalize_one_unused_slot_per_user
  ON public.garanti_live_single_finalize_slots(user_id) WHERE claimed_order_id IS NULL;
CREATE INDEX IF NOT EXISTS garanti_live_single_finalize_slots_by_user
  ON public.garanti_live_single_finalize_slots(user_id, created_at DESC);

-- Add exactly one fresh unused slot for each account whose prior slot is
-- already bound. The current Production configuration has only the one
-- controlled account; old claimed rows are never changed.
INSERT INTO public.garanti_live_single_finalize_slots(user_id)
SELECT DISTINCT user_id FROM public.garanti_live_single_finalize_slots
WHERE claimed_order_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.nrs_create_garanti_live_single_finalize_order(
  p_order_id uuid,p_user_id uuid,p_guest_hash text,p_key uuid,p_request_hash text,
  p_items jsonb,p_customer jsonb,p_legal jsonb,p_provider text,p_authorized_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; order_row public.payment_orders%ROWTYPE; slot uuid; item jsonb;
BEGIN
  IF p_authorized_user_id IS NULL OR p_user_id IS DISTINCT FROM p_authorized_user_id
    OR p_guest_hash IS NOT NULL OR p_provider IS DISTINCT FROM 'garanti-oos'
    OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'controlled live order not authorized' USING ERRCODE='42501';
  END IF;
  item:=p_items->0;
  IF item->>'productId' IS DISTINCT FROM 'nrs-garanti-live-3try'
    OR (item->>'quantity')::integer IS DISTINCT FROM 1
    OR NOT EXISTS (SELECT FROM public.products p JOIN public.product_variants v ON v.product_id=p.id
      WHERE p.id='nrs-garanti-live-3try' AND p.status='active' AND p.payment_test_only
        AND p.currency='TRY' AND p.price_amount=3.00 AND v.id=(item->>'variantId')::uuid
        AND v.is_active AND v.stock_quantity>=1) THEN
    RAISE EXCEPTION 'controlled live order must use the private 3 TRY item' USING ERRCODE='22023';
  END IF;

  result:=public.nrs_create_payment_order(p_order_id,p_user_id,p_guest_hash,p_key,p_request_hash,p_items,p_customer,p_legal,p_provider);
  IF coalesce((result->>'created')::boolean,false) THEN
    SELECT * INTO order_row FROM public.payment_orders WHERE order_id=(result->'order'->>'id')::uuid FOR UPDATE;
    IF NOT FOUND OR order_row.user_id IS DISTINCT FROM p_authorized_user_id OR order_row.provider IS DISTINCT FROM 'garanti-oos'
      OR order_row.amount_minor IS DISTINCT FROM 300 OR order_row.currency IS DISTINCT FROM 'TRY'
      OR order_row.state IS DISTINCT FROM 'initiating' THEN
      RAISE EXCEPTION 'controlled live order must be exactly 3 TRY';
    END IF;
    SELECT slot_id INTO slot FROM public.garanti_live_single_finalize_slots
      WHERE user_id=p_authorized_user_id AND claimed_order_id IS NULL
      ORDER BY created_at,slot_id FOR UPDATE SKIP LOCKED LIMIT 1;
    IF slot IS NULL THEN RAISE EXCEPTION 'controlled live finalize slot unavailable' USING ERRCODE='P0001'; END IF;
    UPDATE public.garanti_live_single_finalize_slots SET claimed_order_id=order_row.order_id,claimed_at=now()
      WHERE slot_id=slot AND claimed_order_id IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'controlled live finalize slot unavailable' USING ERRCODE='P0001'; END IF;
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
