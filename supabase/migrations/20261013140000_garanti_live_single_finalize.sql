-- One Production Garanti success may auto-finalize for the one already
-- controlled account. Claiming the permission is part of order creation, so
-- the order, inventory reservation and permission commit or roll back together.
BEGIN;
CREATE TABLE IF NOT EXISTS public.garanti_live_single_finalize_allowances (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL UNIQUE REFERENCES public.payment_orders(order_id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.garanti_live_single_finalize_evidence (
  order_id uuid PRIMARY KEY REFERENCES public.garanti_live_single_finalize_allowances(order_id) ON DELETE RESTRICT,
  signature_verified boolean NOT NULL CHECK (signature_verified),
  signature_algorithm text NOT NULL CHECK (signature_algorithm = 'sha1'),
  signature_encoding text NOT NULL CHECK (signature_encoding = 'iso-8859-9'),
  order_match boolean NOT NULL CHECK (order_match),
  amount_match boolean NOT NULL CHECK (amount_match),
  currency_match boolean NOT NULL CHECK (currency_match),
  terminal_match boolean NOT NULL CHECK (terminal_match),
  request_match boolean NOT NULL CHECK (request_match),
  callback_mdstatus text NOT NULL CHECK (callback_mdstatus = '1'),
  callback_response text NOT NULL CHECK (callback_response = 'approved'),
  callback_procreturncode text NOT NULL CHECK (callback_procreturncode = '00'),
  query_http integer NOT NULL CHECK (query_http BETWEEN 200 AND 299),
  query_order_match boolean NOT NULL CHECK (query_order_match),
  query_identity_match boolean NOT NULL CHECK (query_identity_match),
  query_amount_match boolean NOT NULL CHECK (query_amount_match),
  query_result_codes_match boolean NOT NULL CHECK (query_result_codes_match),
  query_status text NOT NULL CHECK (query_status = 'APPROVED'),
  query_charge_type text NOT NULL CHECK (query_charge_type = 'S'),
  auth_date_format text NOT NULL CHECK (auth_date_format IN ('missing','yyyymmdd','timestamp')),
  auth_code_match boolean NOT NULL CHECK (auth_code_match),
  bank_reference_present boolean NOT NULL CHECK (bank_reference_present),
  saved_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.garanti_live_single_finalize_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garanti_live_single_finalize_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.garanti_live_single_finalize_allowances, public.garanti_live_single_finalize_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.garanti_live_single_finalize_allowances, public.garanti_live_single_finalize_evidence TO service_role;

CREATE OR REPLACE FUNCTION public.nrs_create_garanti_live_single_finalize_order(
  p_order_id uuid,p_user_id uuid,p_guest_hash text,p_key uuid,p_request_hash text,
  p_items jsonb,p_customer jsonb,p_legal jsonb,p_provider text,p_authorized_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; order_row public.payment_orders%ROWTYPE;
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
    -- A user can claim this controlled exception once. A later attempt fails
    -- the whole transaction, including order and stock writes.
    INSERT INTO public.garanti_live_single_finalize_allowances(user_id,order_id)
      VALUES(p_authorized_user_id,order_row.order_id);
  END IF;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.nrs_store_garanti_live_single_finalize_evidence(p_order_id uuid,p_evidence jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
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

CREATE OR REPLACE FUNCTION public.nrs_finalize_garanti_live_single_finalize_payment(p_payment jsonb,p_provider text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE oid uuid; amount bigint; current_state text; existing_event boolean;
BEGIN
  IF coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
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
  -- The original idempotent finalizer remains the only writer of payment
  -- state, events, and stock. Permission consumption shares its transaction.
  PERFORM public.nrs_finalize_payment(p_payment,p_provider);
  UPDATE public.garanti_live_single_finalize_allowances SET consumed_at=now() WHERE order_id=oid AND consumed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'single-order permission already consumed'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.nrs_create_garanti_live_single_finalize_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text,uuid),
  public.nrs_store_garanti_live_single_finalize_evidence(uuid,jsonb),
  public.nrs_finalize_garanti_live_single_finalize_payment(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text),
  public.nrs_create_garanti_live_single_finalize_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text,uuid),
  public.nrs_store_garanti_live_single_finalize_evidence(uuid,jsonb),
  public.nrs_finalize_garanti_live_single_finalize_payment(jsonb,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
