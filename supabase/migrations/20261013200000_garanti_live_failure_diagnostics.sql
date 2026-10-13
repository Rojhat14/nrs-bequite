BEGIN;

ALTER TABLE public.garanti_live_single_finalize_failures
  ADD COLUMN IF NOT EXISTS callback_signature_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS callback_signature_result text NOT NULL DEFAULT 'not_evaluated'
    CHECK (callback_signature_result IN ('verified','hashparams_invalid','hash_format_invalid','encoding_rejected','hash_mismatch','field_duplicate_field','not_evaluated','parse_rejected')),
  ADD COLUMN IF NOT EXISTS order_match boolean,
  ADD COLUMN IF NOT EXISTS amount_match boolean,
  ADD COLUMN IF NOT EXISTS currency_match boolean,
  ADD COLUMN IF NOT EXISTS terminal_match boolean,
  ADD COLUMN IF NOT EXISTS request_match boolean,
  ADD COLUMN IF NOT EXISTS callback_mdstatus text CHECK (callback_mdstatus IS NULL OR callback_mdstatus ~ '^[0-9]$'),
  ADD COLUMN IF NOT EXISTS callback_response text CHECK (callback_response IS NULL OR callback_response IN ('approved','declined','error','failed')),
  ADD COLUMN IF NOT EXISTS callback_procreturncode text CHECK (callback_procreturncode IS NULL OR callback_procreturncode ~ '^[0-9]{2}$'),
  ADD COLUMN IF NOT EXISTS mderrormessage_present boolean,
  ADD COLUMN IF NOT EXISTS errmsg_present boolean,
  ADD COLUMN IF NOT EXISTS error_text_signed boolean,
  ADD COLUMN IF NOT EXISTS error_category text NOT NULL DEFAULT 'not_recorded'
    CHECK (error_category IN ('not_recorded','authentication_failed','expired_card','invalid_card','user_cancelled','bank_declined','system_error','unclassified')),
  ADD COLUMN IF NOT EXISTS verification_basis text NOT NULL DEFAULT 'callback_runtime'
    CHECK (verification_basis IN ('callback_runtime','runtime_log_reconstruction'));

CREATE OR REPLACE FUNCTION public.nrs_record_garanti_live_single_finalize_failure_v2(
  p_order_id uuid,p_source text,p_failure_stage text,p_safe_code text,p_diagnostic jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d jsonb:=coalesce(p_diagnostic,'{}'::jsonb);
BEGIN
  IF NOT public.nrs_garanti_service_role_request()
    OR p_order_id IS NULL OR p_source IS NULL OR p_failure_stage IS NULL OR p_safe_code IS NULL
    OR p_source NOT IN ('success','failure')
    OR p_failure_stage NOT IN (
      'callback_parse','order_lookup','permission_lookup','callback_signature','callback_match',
      'orderinq_request','orderinq_response','orderinq_identity','orderinq_status','orderinq_result',
      'orderinq_capture','orderinq_auth_code','verified_payment','verified_evidence','evidence_store','finalize_rpc'
    )
    OR p_safe_code !~ '^GARANTI_[A-Z0-9_]{1,80}$'
    OR jsonb_typeof(d) IS DISTINCT FROM 'object'
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(d) AS keys(key) WHERE key NOT IN (
      'signature_verified','signature_result','order_match','amount_match','currency_match','terminal_match','request_match',
      'mdstatus','response','procreturncode','mderrormessage_present','errmsg_present','error_text_signed','error_category','verification_basis'))
    OR (d ? 'signature_verified' AND d->>'signature_verified' NOT IN ('true','false'))
    OR (d ? 'order_match' AND coalesce(d->>'order_match','null') NOT IN ('true','false','null'))
    OR (d ? 'amount_match' AND coalesce(d->>'amount_match','null') NOT IN ('true','false','null'))
    OR (d ? 'currency_match' AND coalesce(d->>'currency_match','null') NOT IN ('true','false','null'))
    OR (d ? 'terminal_match' AND coalesce(d->>'terminal_match','null') NOT IN ('true','false','null'))
    OR (d ? 'request_match' AND coalesce(d->>'request_match','null') NOT IN ('true','false','null'))
    OR (d ? 'mderrormessage_present' AND d->>'mderrormessage_present' NOT IN ('true','false'))
    OR (d ? 'errmsg_present' AND d->>'errmsg_present' NOT IN ('true','false'))
    OR (d ? 'error_text_signed' AND d->>'error_text_signed' NOT IN ('true','false'))
    OR coalesce(d->>'signature_result','not_evaluated') NOT IN ('verified','hashparams_invalid','hash_format_invalid','encoding_rejected','hash_mismatch','field_duplicate_field','not_evaluated','parse_rejected')
    OR (d ? 'mdstatus' AND d->>'mdstatus' IS NOT NULL AND d->>'mdstatus' !~ '^[0-9]$')
    OR (d ? 'response' AND d->>'response' IS NOT NULL AND d->>'response' NOT IN ('approved','declined','error','failed'))
    OR (d ? 'procreturncode' AND d->>'procreturncode' IS NOT NULL AND d->>'procreturncode' !~ '^[0-9]{2}$')
    OR coalesce(d->>'error_category','not_recorded') NOT IN ('not_recorded','authentication_failed','expired_card','invalid_card','user_cancelled','bank_declined','system_error','unclassified')
    OR coalesce(d->>'verification_basis','callback_runtime') NOT IN ('callback_runtime','runtime_log_reconstruction')
    OR NOT EXISTS (
      SELECT 1 FROM public.garanti_live_single_finalize_allowances a
      JOIN public.payment_orders p ON p.order_id=a.order_id
      WHERE a.order_id=p_order_id AND p.provider='garanti-oos' AND p.amount_minor=300
        AND p.currency='TRY' AND p.state='pending'
    ) THEN
    RAISE EXCEPTION 'invalid controlled live failure diagnostic' USING ERRCODE='42501';
  END IF;

  INSERT INTO public.garanti_live_single_finalize_failures(
    order_id,source,failure_stage,safe_code,callback_signature_verified,callback_signature_result,
    order_match,amount_match,currency_match,terminal_match,request_match,callback_mdstatus,callback_response,
    callback_procreturncode,mderrormessage_present,errmsg_present,error_text_signed,error_category,verification_basis)
  VALUES (
    p_order_id,p_source,p_failure_stage,p_safe_code,coalesce((d->>'signature_verified')::boolean,false),coalesce(d->>'signature_result','not_evaluated'),
    (d->>'order_match')::boolean,(d->>'amount_match')::boolean,(d->>'currency_match')::boolean,
    (d->>'terminal_match')::boolean,(d->>'request_match')::boolean,d->>'mdstatus',d->>'response',d->>'procreturncode',
    (d->>'mderrormessage_present')::boolean,(d->>'errmsg_present')::boolean,
    (d->>'error_text_signed')::boolean,coalesce(d->>'error_category','not_recorded'),
    coalesce(d->>'verification_basis','callback_runtime'))
  ON CONFLICT (order_id) DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION public.nrs_record_garanti_live_single_finalize_failure_v2(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_record_garanti_live_single_finalize_failure_v2(uuid,text,text,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
