-- TEST ONLY: allow the already-authorized test account to create distinct
-- observation-only orders for bank decline/cancel scenarios. The existing
-- single-finalize allowance remains bound to its original order.
SET app.nrs_test_project_ref='dzuxhwtbuojnhibzfxqy';
BEGIN;
DO $$ BEGIN
  IF current_setting('app.nrs_test_project_ref',true) IS DISTINCT FROM 'dzuxhwtbuojnhibzfxqy'
    OR to_regprocedure('public.nrs_create_garanti_test_observation_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)') IS NULL
    OR to_regclass('public.garanti_test_single_finalize_allowances') IS NULL THEN
    RAISE EXCEPTION 'Isolated Garanti TEST project required';
  END IF;
END $$;

DO $install$
DECLARE source text; early_guard text; observation_guard text; late_claim text;
BEGIN
  source := pg_get_functiondef('public.nrs_create_garanti_test_observation_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'::regprocedure);
  early_guard := $old$
  -- Serialize the one-order claim and reject a second distinct order.
  PERFORM pg_advisory_xact_lock(hashtextextended('garanti-test-single-finalize:'||p_user_id::text,0));
  IF EXISTS (SELECT FROM public.garanti_test_single_finalize_allowances
    WHERE project_ref='dzuxhwtbuojnhibzfxqy'
      AND site_origin='https://nrs-bequite-garanti-test.vercel.app'
      AND user_id=p_user_id AND order_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Single TEST finalization order already claimed';
  END IF;
$old$;
  observation_guard := $replacement$
  -- Limit additional observation attempts to the existing authorized TEST account.
  IF NOT EXISTS (SELECT FROM public.garanti_test_single_finalize_allowances
    WHERE project_ref='dzuxhwtbuojnhibzfxqy'
      AND site_origin='https://nrs-bequite-garanti-test.vercel.app'
      AND user_id=p_user_id AND order_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Authorized Garanti TEST account required';
  END IF;
$replacement$;
  late_claim := $claim$
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
$claim$;
  IF position(early_guard IN source)=0 OR position(late_claim IN source)=0 THEN
    RAISE EXCEPTION 'Single-finalize TEST implementation changed; review before installation';
  END IF;
  source := replace(source,early_guard,observation_guard);
  source := replace(source,late_claim,'');
  IF position('Authorized Garanti TEST account required' IN source)=0
    OR position('Single TEST finalization order already claimed' IN source)>0
    OR position('Bind only after the referenced order exists' IN source)>0
    OR position('garanti-test-single-finalize:' IN source)>0 THEN
    RAISE EXCEPTION 'Observation-only guard validation failed';
  END IF;
  EXECUTE source;
END $install$;
NOTIFY pgrst,'reload schema';
COMMIT;
