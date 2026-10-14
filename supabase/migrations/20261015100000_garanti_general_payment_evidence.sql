BEGIN;

-- Persist only allowlisted, order-bound verification facts. Never store the
-- callback body, hash, StoreKey, credentials, card data or arbitrary bank text.
CREATE TABLE IF NOT EXISTS public.garanti_verified_payment_evidence (
  order_id uuid PRIMARY KEY REFERENCES public.payment_orders(order_id) ON DELETE RESTRICT,
  event_id text NOT NULL CHECK(length(event_id) BETWEEN 1 AND 200),
  transaction_id text NOT NULL CHECK(length(transaction_id) BETWEEN 1 AND 200),
  merchant_id text NOT NULL CHECK(length(merchant_id) BETWEEN 1 AND 80),
  amount_minor bigint NOT NULL CHECK(amount_minor > 0),
  currency text NOT NULL CHECK(currency = 'TRY'),
  verification_mode text NOT NULL CHECK(verification_mode = 'PROD'),
  signature_verified boolean NOT NULL CHECK(signature_verified),
  signature_algorithm text NOT NULL CHECK(signature_algorithm = 'sha1'),
  signature_encoding text NOT NULL CHECK(signature_encoding = 'iso-8859-9'),
  order_match boolean NOT NULL CHECK(order_match),
  amount_match boolean NOT NULL CHECK(amount_match),
  currency_match boolean NOT NULL CHECK(currency_match),
  terminal_match boolean NOT NULL CHECK(terminal_match),
  request_match boolean NOT NULL CHECK(request_match),
  callback_mdstatus text NOT NULL CHECK(callback_mdstatus = '1'),
  callback_response text NOT NULL CHECK(callback_response = 'approved'),
  callback_procreturncode text NOT NULL CHECK(callback_procreturncode = '00'),
  query_http integer NOT NULL CHECK(query_http BETWEEN 200 AND 299),
  query_order_match boolean NOT NULL CHECK(query_order_match),
  query_identity_match boolean NOT NULL CHECK(query_identity_match),
  query_amount_match boolean NOT NULL CHECK(query_amount_match),
  query_result_codes_match boolean NOT NULL CHECK(query_result_codes_match),
  query_status text NOT NULL CHECK(query_status = 'APPROVED'),
  query_charge_type text NOT NULL CHECK(query_charge_type = 'S'),
  auth_date_format text NOT NULL CHECK(auth_date_format IN ('missing','yyyymmdd','timestamp')),
  auth_code_match boolean NOT NULL CHECK(auth_code_match),
  bank_reference_present boolean NOT NULL CHECK(bank_reference_present),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id),
  UNIQUE(transaction_id)
);
ALTER TABLE public.garanti_verified_payment_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.garanti_verified_payment_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.garanti_verified_payment_evidence TO service_role;

CREATE OR REPLACE FUNCTION public.nrs_store_garanti_verified_payment_evidence(p_order_id uuid,p_evidence jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE payment public.payment_orders%ROWTYPE;
BEGIN
  IF NOT public.nrs_garanti_service_role_request()
    OR p_order_id IS NULL OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'object'
    OR EXISTS (SELECT FROM jsonb_object_keys(p_evidence) AS k(key) WHERE k.key NOT IN (
      'order_id','event_id','transaction_id','merchant_id','amount_minor','currency','verification_mode',
      'signature_verified','signature_algorithm','signature_encoding','order_match','amount_match','currency_match',
      'terminal_match','request_match','callback_mdstatus','callback_response','callback_procreturncode','query_http',
      'query_order_match','query_identity_match','query_amount_match','query_result_codes_match','query_status',
      'query_charge_type','auth_date_format','auth_code_match','bank_reference_present')) THEN
    RAISE EXCEPTION 'invalid Garanti verification evidence' USING ERRCODE='42501';
  END IF;
  SELECT * INTO payment FROM public.payment_orders WHERE order_id=p_order_id AND provider='garanti-oos' FOR UPDATE;
  IF NOT FOUND OR payment.currency IS DISTINCT FROM 'TRY'
    OR payment.state NOT IN ('pending','paid')
    OR p_evidence->>'order_id' IS DISTINCT FROM p_order_id::text
    OR p_evidence->>'event_id' IS NULL OR length(p_evidence->>'event_id') NOT BETWEEN 1 AND 200
    OR p_evidence->>'transaction_id' IS NULL OR length(p_evidence->>'transaction_id') NOT BETWEEN 1 AND 200
    OR p_evidence->>'merchant_id' IS NULL OR length(p_evidence->>'merchant_id') NOT BETWEEN 1 AND 80
    OR (p_evidence->>'amount_minor') !~ '^[0-9]+$'
    OR (p_evidence->>'amount_minor')::numeric IS DISTINCT FROM payment.amount_minor::numeric
    OR p_evidence->>'currency' IS DISTINCT FROM payment.currency
    OR p_evidence->>'verification_mode' IS DISTINCT FROM 'PROD'
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
    OR (p_evidence->>'query_http') !~ '^2[0-9][0-9]$'
    OR p_evidence->>'query_order_match' IS DISTINCT FROM 'true'
    OR p_evidence->>'query_identity_match' IS DISTINCT FROM 'true'
    OR p_evidence->>'query_amount_match' IS DISTINCT FROM 'true'
    OR p_evidence->>'query_result_codes_match' IS DISTINCT FROM 'true'
    OR p_evidence->>'query_status' IS DISTINCT FROM 'APPROVED'
    OR p_evidence->>'query_charge_type' IS DISTINCT FROM 'S'
    OR p_evidence->>'auth_date_format' NOT IN ('missing','yyyymmdd','timestamp')
    OR p_evidence->>'auth_code_match' IS DISTINCT FROM 'true'
    OR p_evidence->>'bank_reference_present' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'incomplete verified Garanti evidence' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.garanti_verified_payment_evidence(
    order_id,event_id,transaction_id,merchant_id,amount_minor,currency,verification_mode,
    signature_verified,signature_algorithm,signature_encoding,order_match,amount_match,currency_match,
    terminal_match,request_match,callback_mdstatus,callback_response,callback_procreturncode,query_http,
    query_order_match,query_identity_match,query_amount_match,query_result_codes_match,query_status,
    query_charge_type,auth_date_format,auth_code_match,bank_reference_present)
  VALUES(p_order_id,p_evidence->>'event_id',p_evidence->>'transaction_id',p_evidence->>'merchant_id',
    (p_evidence->>'amount_minor')::bigint,p_evidence->>'currency','PROD',true,'sha1','iso-8859-9',true,true,true,
    true,true,'1','approved','00',(p_evidence->>'query_http')::integer,true,true,true,true,'APPROVED','S',
    p_evidence->>'auth_date_format',true,true)
  ON CONFLICT(order_id) DO NOTHING;
  IF NOT EXISTS (SELECT FROM public.garanti_verified_payment_evidence e WHERE e.order_id=p_order_id
    AND e.event_id=p_evidence->>'event_id' AND e.transaction_id=p_evidence->>'transaction_id'
    AND e.merchant_id=p_evidence->>'merchant_id' AND e.amount_minor=payment.amount_minor
    AND e.currency=payment.currency AND e.verification_mode='PROD' AND e.signature_verified
    AND e.signature_algorithm='sha1' AND e.signature_encoding='iso-8859-9' AND e.order_match
    AND e.amount_match AND e.currency_match AND e.terminal_match AND e.request_match
    AND e.callback_mdstatus='1' AND e.callback_response='approved' AND e.callback_procreturncode='00'
    AND e.query_http BETWEEN 200 AND 299 AND e.query_order_match AND e.query_identity_match
    AND e.query_amount_match AND e.query_result_codes_match AND e.query_status='APPROVED'
    AND e.query_charge_type='S' AND e.auth_code_match AND e.bank_reference_present) THEN
    RAISE EXCEPTION 'conflicting Garanti verification evidence' USING ERRCODE='22023';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.nrs_store_garanti_verified_payment_evidence(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_store_garanti_verified_payment_evidence(uuid,jsonb) TO service_role;

-- Production Garanti paid events require this durable order-bound proof. The
-- existing controlled single-order proof remains valid during the closed rollout.
DO $migration$
DECLARE definition text; marker text; guard text;
BEGIN
  SELECT pg_get_functiondef('public.nrs_finalize_payment(jsonb,text)'::regprocedure) INTO definition;
  marker := '  IF order_status IS NULL OR';
  IF position(marker IN definition)=0 OR position('general Garanti proof required' IN definition)>0 THEN
    RAISE EXCEPTION 'Payment finalize function differs from reviewed baseline';
  END IF;
  guard := $block$  IF p_provider='garanti-oos' AND p_payment->>'verificationMode'='PROD' AND final_state='paid'
    AND order_status IS DISTINCT FROM 'payment_unverified' AND NOT (
      EXISTS (SELECT FROM public.garanti_verified_payment_evidence e
        WHERE e.order_id=payment.order_id AND e.event_id=p_payment->>'eventId'
          AND e.transaction_id=p_payment->>'transactionId' AND e.merchant_id=p_payment->>'merchantId'
          AND e.amount_minor=payment.amount_minor AND e.currency=payment.currency
          AND e.signature_verified AND e.order_match AND e.amount_match AND e.currency_match
          AND e.terminal_match AND e.request_match AND e.callback_mdstatus='1'
          AND e.callback_response='approved' AND e.callback_procreturncode='00'
          AND e.query_http BETWEEN 200 AND 299 AND e.query_order_match AND e.query_identity_match
          AND e.query_amount_match AND e.query_result_codes_match AND e.query_status='APPROVED'
          AND e.query_charge_type='S' AND e.auth_code_match AND e.bank_reference_present)
      OR EXISTS (SELECT FROM public.garanti_live_single_finalize_evidence e
        JOIN public.garanti_live_single_finalize_allowances a ON a.order_id=e.order_id
        WHERE e.order_id=payment.order_id AND payment.amount_minor=300 AND e.signature_verified
          AND e.order_match AND e.amount_match AND e.currency_match AND e.terminal_match AND e.request_match
          AND e.callback_mdstatus='1' AND e.callback_response='approved' AND e.callback_procreturncode='00'
          AND e.query_order_match AND e.query_identity_match AND e.query_amount_match AND e.query_result_codes_match
          AND e.query_status='APPROVED' AND e.query_charge_type='S' AND e.auth_code_match AND e.bank_reference_present
          AND e.auth_date_format IN ('missing','yyyymmdd','timestamp'))
    ) THEN RAISE EXCEPTION 'general Garanti proof required'; END IF;
$block$;
  definition := replace(definition,marker,guard || marker);
  EXECUTE definition;
END
$migration$;

NOTIFY pgrst,'reload schema';
COMMIT;
