BEGIN;

-- The callback diagnostic RPC was first introduced for the capped live trial.
-- General Production orders can exceed that trial amount, so retain the same
-- strict safe-field validation and service-role boundary without the obsolete
-- 1,000-kuruş ceiling. This stores diagnostics only; it never changes payment
-- or stock state.
CREATE OR REPLACE FUNCTION public.nrs_record_garanti_payment_return_diagnostic(
  p_order_id uuid,p_source text,p_failure_stage text,p_safe_code text,p_diagnostic jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
    OR p_order_id IS NULL OR p_source NOT IN ('success','failure')
    OR p_failure_stage IS NULL OR p_failure_stage !~ '^[a-z_]{1,40}$'
    OR p_safe_code IS NULL OR p_safe_code !~ '^GARANTI_[A-Z0-9_]{1,80}$'
    OR jsonb_typeof(p_diagnostic) IS DISTINCT FROM 'object'
    OR (p_diagnostic - ARRAY['signature_verified','signature_result','order_match','amount_match','currency_match',
      'terminal_match','request_match','mdstatus','response','procreturncode','mderrormessage_present','errmsg_present',
      'error_text_signed','error_category','verification_basis']::text[]) <> '{}'::jsonb
    OR (p_diagnostic ? 'signature_verified' AND jsonb_typeof(p_diagnostic->'signature_verified') NOT IN ('boolean','null'))
    OR (p_diagnostic ? 'signature_result' AND p_diagnostic->>'signature_result' NOT IN
      ('verified','hashparams_invalid','hash_format_invalid','encoding_rejected','hash_mismatch','field_duplicate_field','not_evaluated','parse_rejected'))
    OR (p_diagnostic ? 'mdstatus' AND p_diagnostic->>'mdstatus' !~ '^[0-7]$')
    OR (p_diagnostic ? 'response' AND p_diagnostic->>'response' NOT IN ('approved','declined','error','failed'))
    OR (p_diagnostic ? 'procreturncode' AND p_diagnostic->>'procreturncode' !~ '^\d{2}$')
    OR (p_diagnostic ? 'error_category' AND p_diagnostic->>'error_category' !~ '^[a-z_]{1,32}$')
    OR NOT EXISTS (SELECT 1 FROM public.payment_orders p WHERE p.order_id=p_order_id
      AND p.provider='garanti-oos' AND p.currency='TRY' AND p.state IN ('pending','paid','failed')) THEN
    RAISE EXCEPTION 'invalid safe Garanti callback diagnostic' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.garanti_payment_return_diagnostics(order_id,source,failure_stage,safe_code,diagnostic)
  VALUES(p_order_id,p_source,p_failure_stage,p_safe_code,p_diagnostic)
  ON CONFLICT(order_id,source) DO UPDATE SET
    failure_stage=excluded.failure_stage,safe_code=excluded.safe_code,
    diagnostic=excluded.diagnostic,recorded_at=now()
  WHERE coalesce(public.garanti_payment_return_diagnostics.diagnostic->>'signature_verified','false') <> 'true'
    OR coalesce(excluded.diagnostic->>'signature_verified','false') = 'true';
END $$;
REVOKE ALL ON FUNCTION public.nrs_record_garanti_payment_return_diagnostic(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_record_garanti_payment_return_diagnostic(uuid,text,text,text,jsonb) TO service_role;

COMMIT;
