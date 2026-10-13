BEGIN;

-- PostgREST versions may expose the JWT role either as the legacy individual
-- setting or inside request.jwt.claims. Accept either signed claim while
-- keeping these RPCs restricted to the service_role grant.
CREATE OR REPLACE FUNCTION public.nrs_garanti_service_role_request()
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', ''),
    ''
  ) = 'service_role'
$$;
REVOKE ALL ON FUNCTION public.nrs_garanti_service_role_request() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_garanti_service_role_request() TO service_role;

CREATE OR REPLACE FUNCTION public.nrs_store_garanti_live_single_finalize_evidence(p_order_id uuid,p_evidence jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.nrs_garanti_service_role_request()
    OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'object'
    OR p_evidence->>'order_id' IS DISTINCT FROM p_order_id::text
    OR p_evidence->>'signature_verified' IS DISTINCT FROM 'true'
    OR p_evidence->>'signature_algorithm' IS DISTINCT FROM 'sha1'
    OR p_evidence->>'signature_encoding' IS DISTINCT FROM 'iso-8859-9'
    OR p_evidence->>'order_match' IS DISTINCT FROM 'true'
    OR p_evidence->>'amount_match' IS DISTINCT FROM 'true'
    OR p_evidence->>'currency_match' IS DISTINCT FROM 'true'
    OR p_evidence->>'terminal_match' IS DISTINCT FROM 'true'
    OR p_evidence->>'request_match' IS DISTINCT FROM 'true'
    OR p_evidence->>'callback_mdstatus' IS DISTINCT FROM '1'
    OR p_evidence->>'callback_response' IS DISTINCT FROM 'approved'
    OR p_evidence->>'callback_procreturncode' IS DISTINCT FROM '00'
    OR p_evidence->>'query_order_match' IS DISTINCT FROM 'true'
    OR p_evidence->>'query_identity_match' IS DISTINCT FROM 'true'
    OR p_evidence->>'query_amount_match' IS DISTINCT FROM 'true'
    OR p_evidence->>'query_result_codes_match' IS DISTINCT FROM 'true'
    OR p_evidence->>'query_status' IS DISTINCT FROM 'APPROVED'
    OR p_evidence->>'query_charge_type' IS DISTINCT FROM 'S'
    OR p_evidence->>'auth_code_match' IS DISTINCT FROM 'true'
    OR p_evidence->>'bank_reference_present' IS DISTINCT FROM 'true'
    OR p_evidence->>'auth_date_format' NOT IN ('missing','yyyymmdd','timestamp')
    OR (p_evidence->>'query_http') !~ '^2[0-9][0-9]$' THEN
    RAISE EXCEPTION 'incomplete verified Garanti evidence' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.garanti_live_single_finalize_evidence(
    order_id,signature_verified,signature_algorithm,signature_encoding,order_match,amount_match,currency_match,terminal_match,request_match,
    callback_mdstatus,callback_response,callback_procreturncode,query_http,query_order_match,query_identity_match,query_amount_match,
    query_result_codes_match,query_status,query_charge_type,auth_date_format,auth_code_match,bank_reference_present)
  SELECT p_order_id,true,'sha1','iso-8859-9',true,true,true,true,true,'1','approved','00',
    (p_evidence->>'query_http')::integer,true,true,true,true,'APPROVED','S',p_evidence->>'auth_date_format',true,true
  WHERE EXISTS (SELECT FROM public.garanti_live_single_finalize_allowances a
    JOIN public.payment_orders p ON p.order_id=a.order_id
    WHERE a.order_id=p_order_id AND p.amount_minor=300 AND p.currency='TRY' AND p.provider='garanti-oos')
  ON CONFLICT (order_id) DO NOTHING;
  IF NOT FOUND AND NOT EXISTS(SELECT FROM public.garanti_live_single_finalize_evidence WHERE order_id=p_order_id) THEN
    RAISE EXCEPTION 'single-order permission unavailable' USING ERRCODE='P0002';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.nrs_record_garanti_live_single_finalize_failure(
  p_order_id uuid,p_source text,p_failure_stage text,p_safe_code text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
    OR NOT EXISTS (
      SELECT 1 FROM public.garanti_live_single_finalize_allowances a
      JOIN public.payment_orders p ON p.order_id=a.order_id
      WHERE a.order_id=p_order_id AND p.provider='garanti-oos' AND p.amount_minor=300
        AND p.currency='TRY' AND p.state='pending'
    ) THEN
    RAISE EXCEPTION 'invalid controlled live failure diagnostic' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.garanti_live_single_finalize_failures(order_id,source,failure_stage,safe_code)
    VALUES(p_order_id,p_source,p_failure_stage,p_safe_code)
    ON CONFLICT (order_id) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.nrs_finalize_garanti_live_single_finalize_payment(p_payment jsonb,p_provider text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE oid uuid; amount bigint; current_state text; existing_event boolean;
BEGIN
  IF NOT public.nrs_garanti_service_role_request()
    OR p_provider IS DISTINCT FROM 'garanti-oos' OR p_payment->>'status' IS DISTINCT FROM 'paid'
    OR p_payment->>'threeDS' IS DISTINCT FROM 'authenticated' THEN
    RAISE EXCEPTION 'controlled live finalization not authorized' USING ERRCODE='42501';
  END IF;
  BEGIN oid:=(p_payment->>'merchantReference')::uuid; amount:=(p_payment->>'amountMinor')::bigint;
  EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid controlled payment'; END;
  SELECT state INTO current_state FROM public.payment_orders WHERE order_id=oid AND provider='garanti-oos' FOR UPDATE;
  IF NOT FOUND OR amount<>300 THEN RAISE EXCEPTION 'controlled live order mismatch'; END IF;
  SELECT EXISTS(SELECT FROM public.payment_events WHERE provider=p_provider AND event_id=p_payment->>'eventId' AND order_id=oid) INTO existing_event;
  IF existing_event THEN
    PERFORM public.nrs_finalize_payment(p_payment,p_provider);
    RETURN;
  END IF;
  IF current_state<>'pending' OR NOT EXISTS (
    SELECT FROM public.garanti_live_single_finalize_allowances a
    JOIN public.garanti_live_single_finalize_evidence e ON e.order_id=a.order_id
    WHERE a.order_id=oid AND a.consumed_at IS NULL
      AND e.signature_verified AND e.order_match AND e.amount_match AND e.currency_match AND e.terminal_match AND e.request_match
      AND e.query_order_match AND e.query_identity_match AND e.query_amount_match AND e.query_result_codes_match
      AND e.callback_mdstatus='1' AND e.callback_response='approved' AND e.callback_procreturncode='00'
      AND e.query_status='APPROVED' AND e.query_charge_type='S' AND e.query_http BETWEEN 200 AND 299
      AND e.auth_code_match AND e.bank_reference_present AND e.auth_date_format IN ('missing','yyyymmdd','timestamp')) THEN
    RAISE EXCEPTION 'verified single-order evidence unavailable';
  END IF;
  PERFORM public.nrs_finalize_payment(p_payment,p_provider);
  UPDATE public.garanti_live_single_finalize_allowances SET consumed_at=now() WHERE order_id=oid AND consumed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'single-order permission already consumed'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.nrs_store_garanti_live_single_finalize_evidence(uuid,jsonb),
  public.nrs_record_garanti_live_single_finalize_failure(uuid,text,text,text),
  public.nrs_finalize_garanti_live_single_finalize_payment(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_store_garanti_live_single_finalize_evidence(uuid,jsonb),
  public.nrs_record_garanti_live_single_finalize_failure(uuid,text,text,text),
  public.nrs_finalize_garanti_live_single_finalize_payment(jsonb,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
