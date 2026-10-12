-- TEST ONLY. Install explicitly in the isolated project; never a PROD migration.
BEGIN;
DO $$ BEGIN
  IF current_setting('app.nrs_test_project_ref',true) IS DISTINCT FROM 'dzuxhwtbuojnhibzfxqy'
    OR to_regclass('public.garanti_test_return_diagnostics') IS NULL THEN
    RAISE EXCEPTION 'Isolated Garanti TEST project required';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.garanti_test_observation_policy (
  project_ref text PRIMARY KEY CHECK(project_ref='dzuxhwtbuojnhibzfxqy'),
  site_origin text NOT NULL CHECK(site_origin='https://nrs-bequite-garanti-test.vercel.app')
);
INSERT INTO public.garanti_test_observation_policy VALUES ('dzuxhwtbuojnhibzfxqy','https://nrs-bequite-garanti-test.vercel.app') ON CONFLICT DO NOTHING;
ALTER TABLE public.garanti_test_observation_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.garanti_test_observation_policy FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.garanti_test_observation_policy TO service_role;
DO $install$
DECLARE source text; guard text; replacement text;
BEGIN
  -- Copy the installed hardened implementation, retaining all locks, ownership,
  -- exact-key idempotency, price/legal/stock checks and atomic reservation writes.
  source := pg_get_functiondef('public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'::regprocedure);
  guard := $guard$  IF EXISTS (SELECT FROM public.payment_orders WHERE user_id=p_user_id AND state IN ('initiating','pending')) THEN
    RAISE EXCEPTION 'Unresolved payment exists; reconcile before a new attempt';
  END IF;$guard$;
  IF position(guard IN source)=0 OR position(E'BEGIN\n  IF p_user_id IS NULL' IN source)=0 THEN
    RAISE EXCEPTION 'Payment implementation changed; review TEST policy before installation';
  END IF;
  source := replace(source,'FUNCTION public.nrs_create_payment_order(', 'FUNCTION public.nrs_create_garanti_test_observation_order(');
  source := replace(source,guard,'  -- Isolated observation permits distinct keys; existing reservations remain.');
  replacement := $guard$BEGIN
  IF p_provider IS DISTINCT FROM 'garanti-oos'
    OR NOT EXISTS(SELECT FROM public.garanti_test_observation_policy WHERE project_ref='dzuxhwtbuojnhibzfxqy' AND site_origin='https://nrs-bequite-garanti-test.vercel.app')
    OR EXISTS(SELECT FROM jsonb_array_elements(p_items) x WHERE x->>'productId' IS NULL OR x->>'productId' NOT IN ('garanti-test-accessory','garanti-test-dress')) THEN
    RAISE EXCEPTION 'Isolated Garanti observation products required';
  END IF;
  IF p_user_id IS NULL$guard$;
  source := replace(source,E'BEGIN\n  IF p_user_id IS NULL',replacement);
  EXECUTE source;
END $install$;
REVOKE ALL ON FUNCTION public.nrs_create_garanti_test_observation_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_create_garanti_test_observation_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
