-- Keep the already claimed order/allowance intact while authorizing one
-- additional, separate 3 TRY order for the same controlled account.
BEGIN;

-- A user can now own multiple order-bound allowances; each payment order stays
-- unique and the old order_id FK/evidence/failure history remains unchanged.
ALTER TABLE public.garanti_live_single_finalize_allowances
  DROP CONSTRAINT IF EXISTS garanti_live_single_finalize_allowances_pkey;
ALTER TABLE public.garanti_live_single_finalize_allowances
  ADD COLUMN allowance_id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.garanti_live_single_finalize_allowances
  ADD CONSTRAINT garanti_live_single_finalize_allowances_pkey PRIMARY KEY (allowance_id);

CREATE TABLE public.garanti_live_single_finalize_slots (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  claimed_order_id uuid UNIQUE REFERENCES public.payment_orders(order_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz
);
ALTER TABLE public.garanti_live_single_finalize_slots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.garanti_live_single_finalize_slots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.garanti_live_single_finalize_slots TO service_role;

CREATE OR REPLACE FUNCTION public.nrs_create_garanti_live_single_finalize_order(
  p_order_id uuid,p_user_id uuid,p_guest_hash text,p_key uuid,p_request_hash text,
  p_items jsonb,p_customer jsonb,p_legal jsonb,p_provider text,p_authorized_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; order_row public.payment_orders%ROWTYPE; claimed uuid;
BEGIN
  IF p_authorized_user_id IS NULL OR p_user_id IS DISTINCT FROM p_authorized_user_id
    OR p_guest_hash IS NOT NULL OR p_provider IS DISTINCT FROM 'garanti-oos' THEN
    RAISE EXCEPTION 'controlled live order not authorized' USING ERRCODE='42501';
  END IF;
  result:=public.nrs_create_payment_order(p_order_id,p_user_id,p_guest_hash,p_key,p_request_hash,p_items,p_customer,p_legal,p_provider);
  IF coalesce((result->>'created')::boolean,false) THEN
    SELECT * INTO order_row FROM public.payment_orders WHERE order_id=(result->'order'->>'id')::uuid FOR UPDATE;
    IF NOT FOUND OR order_row.user_id IS DISTINCT FROM p_authorized_user_id OR order_row.provider IS DISTINCT FROM 'garanti-oos'
      OR order_row.amount_minor IS DISTINCT FROM 300 OR order_row.currency IS DISTINCT FROM 'TRY'
      OR order_row.state IS DISTINCT FROM 'initiating' THEN
      RAISE EXCEPTION 'controlled live order must be exactly 3 TRY';
    END IF;
    -- Competing distinct checkouts serialize on this account's slot. If it was
    -- already claimed, the exception rolls back order and reservation creation.
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

REVOKE ALL ON FUNCTION public.nrs_create_garanti_live_single_finalize_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_create_garanti_live_single_finalize_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
