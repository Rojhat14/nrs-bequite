-- TEST ONLY: one future order for the owner of the already verified TEST order.
-- Install only in dzuxhwtbuojnhibzfxqy; never add this to production migrations.
BEGIN;
DO $$ BEGIN
  IF current_setting('app.nrs_test_project_ref',true) IS DISTINCT FROM 'dzuxhwtbuojnhibzfxqy'
    OR to_regprocedure('public.nrs_create_garanti_test_observation_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)') IS NULL
    OR to_regclass('public.garanti_test_observation_policy') IS NULL THEN
    RAISE EXCEPTION 'Isolated Garanti TEST project required';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.garanti_test_single_finalize_allowances (
  project_ref text NOT NULL CHECK (project_ref='dzuxhwtbuojnhibzfxqy'),
  site_origin text NOT NULL CHECK (site_origin='https://nrs-bequite-garanti-test.vercel.app'),
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  order_id uuid UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.garanti_test_single_finalize_allowances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.garanti_test_single_finalize_allowances FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.garanti_test_single_finalize_allowances TO service_role;

DO $seed$
DECLARE owner_id uuid;
BEGIN
  SELECT user_id INTO owner_id FROM public.payment_orders
  WHERE order_id='1ef478d7-fa48-4568-86c0-47a4dd399a2a'
    AND provider='garanti-oos' AND state='paid' AND currency='TRY';
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Verified TEST account anchor missing'; END IF;
  INSERT INTO public.garanti_test_single_finalize_allowances(project_ref,site_origin,user_id)
    VALUES('dzuxhwtbuojnhibzfxqy','https://nrs-bequite-garanti-test.vercel.app',owner_id)
    ON CONFLICT (user_id) DO NOTHING;
  IF NOT EXISTS (SELECT FROM public.garanti_test_single_finalize_allowances
    WHERE project_ref='dzuxhwtbuojnhibzfxqy'
      AND site_origin='https://nrs-bequite-garanti-test.vercel.app'
      AND user_id=owner_id) THEN
    RAISE EXCEPTION 'Single TEST allowance missing or inconsistent';
  END IF;
END $seed$;

DO $install$
DECLARE source text; anchor text; legal_anchor text; early_guard text; late_claim text; old_claim text;
BEGIN
  source := pg_get_functiondef('public.nrs_create_garanti_test_observation_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'::regprocedure);
  anchor := E'  IF (p_legal->>''contract_accepted'') IS DISTINCT FROM ''true'' OR coalesce';
  legal_anchor := '  INSERT INTO public.order_legal_records(';
  old_claim := $old$
  -- Claim one TEST order for the anchored account inside the order transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended('garanti-test-single-finalize:'||p_user_id::text,0));
  UPDATE public.garanti_test_single_finalize_allowances
    SET order_id=p_order_id,claimed_at=now()
    WHERE project_ref='dzuxhwtbuojnhibzfxqy'
      AND site_origin='https://nrs-bequite-garanti-test.vercel.app'
      AND user_id=p_user_id AND order_id IS NULL;
  IF NOT FOUND AND EXISTS (SELECT FROM public.garanti_test_single_finalize_allowances WHERE user_id=p_user_id) THEN
    RAISE EXCEPTION 'Single TEST finalization order already claimed';
  END IF;
$old$;
  early_guard := $early$
  -- Serialize the one-order claim and reject a second distinct order.
  PERFORM pg_advisory_xact_lock(hashtextextended('garanti-test-single-finalize:'||p_user_id::text,0));
  IF EXISTS (SELECT FROM public.garanti_test_single_finalize_allowances
    WHERE project_ref='dzuxhwtbuojnhibzfxqy'
      AND site_origin='https://nrs-bequite-garanti-test.vercel.app'
      AND user_id=p_user_id AND order_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Single TEST finalization order already claimed';
  END IF;
$early$;
  late_claim := $late$
  -- Bind only after the referenced order exists; keep this update in the same transaction.
  UPDATE public.garanti_test_single_finalize_allowances
    SET order_id=p_order_id,claimed_at=now()
    WHERE project_ref='dzuxhwtbuojnhibzfxqy'
      AND site_origin='https://nrs-bequite-garanti-test.vercel.app'
      AND user_id=p_user_id AND order_id IS NULL;
  IF NOT FOUND AND EXISTS (SELECT FROM public.garanti_test_single_finalize_allowances
    WHERE user_id=p_user_id AND project_ref='dzuxhwtbuojnhibzfxqy') THEN
    RAISE EXCEPTION 'Single TEST finalization order already claimed';
  END IF;
$late$;
  IF position(anchor IN source)=0 OR position(legal_anchor IN source)=0 THEN
    RAISE EXCEPTION 'Observation order function changed; review before installation';
  END IF;
  IF position(old_claim IN source)>0 THEN
    source := replace(source,old_claim,early_guard);
  ELSIF position('garanti-test-single-finalize:' IN source)=0 THEN
    source := replace(source,anchor,early_guard||anchor);
  END IF;
  IF position('Bind only after the referenced order exists' IN source)=0 THEN
    source := replace(source,legal_anchor,late_claim||legal_anchor);
  END IF;
  IF position('garanti-test-single-finalize:' IN source)=0
    OR position('Bind only after the referenced order exists' IN source)=0
    OR position(old_claim IN source)>0 THEN
    RAISE EXCEPTION 'Single TEST claim placement validation failed';
  END IF;
  IF source IS DISTINCT FROM pg_get_functiondef('public.nrs_create_garanti_test_observation_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'::regprocedure) THEN
    EXECUTE source;
  END IF;
END $install$;
NOTIFY pgrst,'reload schema';
COMMIT;
