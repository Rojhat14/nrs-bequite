-- TEST ONLY. Apply explicitly to dzuxhwtbuojnhibzfxqy, never through migrations.
BEGIN;
DO $$ BEGIN
  IF current_setting('app.nrs_test_project_ref',true) IS DISTINCT FROM 'dzuxhwtbuojnhibzfxqy'
    OR NOT EXISTS (SELECT FROM public.products WHERE id='garanti-test-accessory') THEN
    RAISE EXCEPTION 'Isolated Garanti TEST project required';
  END IF;
END $$;
CREATE TABLE public.garanti_test_return_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  fingerprint text NOT NULL UNIQUE CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  order_id uuid REFERENCES public.payment_orders(order_id) ON DELETE RESTRICT,
  payment_attempt_id uuid,
  source text NOT NULL CHECK (source IN ('success','failure')),
  mdstatus text CHECK (mdstatus ~ '^[0-9]$'),
  response text CHECK (response IN ('approved','declined','error','failed')),
  procreturncode text CHECK (procreturncode ~ '^[0-9]{2}$'),
  mderrormessage text NOT NULL CHECK (length(mderrormessage)<=160),
  errmsg text NOT NULL CHECK (length(errmsg)<=160),
  error_text_signed boolean NOT NULL,
  signature_verified boolean NOT NULL,
  association text NOT NULL CHECK (association IN ('verified','claimed','unassociated')),
  order_match boolean, amount_match boolean, currency_match boolean,
  terminal_match boolean, request_match boolean,
  outcome text NOT NULL CHECK (outcome IN ('verified_failure','unverified_failure','unverified','verification_pending')),
  CHECK ((order_id IS NULL)=(payment_attempt_id IS NULL)),
  CHECK (association<>'verified' OR (signature_verified AND order_match IS TRUE AND amount_match IS TRUE AND currency_match IS TRUE AND terminal_match IS TRUE AND request_match IS TRUE)),
  CHECK (outcome<>'verified_failure' OR association='verified')
);
CREATE INDEX garanti_test_diagnostics_order ON public.garanti_test_return_diagnostics(order_id,created_at DESC);
ALTER TABLE public.garanti_test_return_diagnostics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.garanti_test_return_diagnostics FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.garanti_test_return_diagnostics TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
