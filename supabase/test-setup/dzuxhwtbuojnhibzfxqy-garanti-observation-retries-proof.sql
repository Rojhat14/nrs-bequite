-- Transactional TEST-only proof: creates two distinct observation attempts and
-- rolls them back. No bank request is made; the original finalize slot is read-only.
SET app.nrs_test_project_ref='dzuxhwtbuojnhibzfxqy';
BEGIN;
DO $proof$
DECLARE anchor public.payment_orders%ROWTYPE; legal jsonb; customer jsonb; items jsonb;
  id1 uuid:=gen_random_uuid(); id2 uuid:=gen_random_uuid(); key1 uuid:=gen_random_uuid(); key2 uuid:=gen_random_uuid();
  result jsonb; claimed_id uuid; before_orders bigint; before_payments bigint; before_events bigint;
  before_reservations bigint; before_stock bigint; qty bigint;
BEGIN
  SELECT p.* INTO STRICT anchor FROM public.payment_orders p
    JOIN public.garanti_test_single_finalize_allowances a ON a.order_id=p.order_id
    WHERE a.project_ref='dzuxhwtbuojnhibzfxqy'
      AND a.site_origin='https://nrs-bequite-garanti-test.vercel.app'
      AND p.provider='garanti-oos' AND p.state='paid';
  claimed_id:=anchor.order_id;
  SELECT to_jsonb(l) INTO STRICT legal FROM public.order_legal_records l WHERE order_id=anchor.order_id;
  SELECT jsonb_agg(jsonb_build_object('productId',x->>'productId','variantId',x->>'variantId','quantity',x->'quantity','measurements',x->'measurements')),
         sum((x->>'quantity')::integer)
    INTO items,qty FROM jsonb_array_elements(legal->'order_summary'->'items') x;
  SELECT jsonb_build_object('firstName',split_part(customer_name,' ',1),
      'lastName',substr(customer_name,position(' ' IN customer_name)+1),'email',customer_email,
      'phone',customer_phone,'address',shipping_address,'city',shipping_city,
      'district',shipping_district,'postalCode',shipping_postal_code)
    INTO customer FROM public.orders WHERE id=anchor.order_id;
  IF items IS NULL OR qty IS NULL THEN RAISE EXCEPTION 'Authorized TEST order summary unavailable'; END IF;
  SELECT count(*) INTO before_orders FROM public.orders;
  SELECT count(*) INTO before_payments FROM public.payment_orders;
  SELECT count(*) INTO before_events FROM public.payment_events;
  SELECT count(*) INTO before_reservations FROM public.payment_stock_reservations;
  SELECT sum(stock_quantity) INTO before_stock FROM public.product_variants;
  result:=public.nrs_create_garanti_test_observation_order(id1,anchor.user_id,NULL,key1,anchor.request_hash,items,customer,
    jsonb_set(legal,'{order_id}',to_jsonb(id1)),'garanti-oos');
  IF result->>'created'<>'true' OR result->'order'->>'id'<>id1::text THEN RAISE EXCEPTION 'First observation attempt failed'; END IF;
  result:=public.nrs_create_garanti_test_observation_order(id2,anchor.user_id,NULL,key2,anchor.request_hash,items,customer,
    jsonb_set(legal,'{order_id}',to_jsonb(id2)),'garanti-oos');
  IF result->>'created'<>'true' OR result->'order'->>'id'<>id2::text THEN RAISE EXCEPTION 'Second observation attempt failed'; END IF;
  IF (SELECT order_id FROM public.garanti_test_single_finalize_allowances WHERE user_id=anchor.user_id) IS DISTINCT FROM claimed_id
    THEN RAISE EXCEPTION 'Existing finalize allowance changed'; END IF;
  IF (SELECT count(*) FROM public.payment_orders WHERE order_id IN (id1,id2) AND state='initiating'
      AND idempotency_key IN (key1,key2) AND merchant_reference IN (id1,id2))<>2
    THEN RAISE EXCEPTION 'Distinct pending order references or idempotency keys missing'; END IF;
  IF (SELECT count(*) FROM public.payment_stock_reservations WHERE order_id IN (id1,id2))<>2*jsonb_array_length(items)
    THEN RAISE EXCEPTION 'Observation stock reservations missing'; END IF;
  BEGIN
    PERFORM public.nrs_create_garanti_test_observation_order(gen_random_uuid(),gen_random_uuid(),NULL,gen_random_uuid(),
      anchor.request_hash,items,customer,jsonb_set(legal,'{order_id}',to_jsonb(gen_random_uuid())),'garanti-oos');
    RAISE EXCEPTION 'Unapproved TEST account unexpectedly allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Authorized Garanti TEST account required' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.payment_events)<>before_events
    OR (SELECT count(*) FROM public.orders)<>before_orders+2
    OR (SELECT count(*) FROM public.payment_orders)<>before_payments+2
    OR (SELECT count(*) FROM public.payment_stock_reservations)<>before_reservations+2*jsonb_array_length(items)
    OR (SELECT sum(stock_quantity) FROM public.product_variants) IS DISTINCT FROM before_stock-2*qty
    THEN RAISE EXCEPTION 'Observation order side effects inconsistent'; END IF;
END $proof$;
ROLLBACK;
SELECT 'PASS' result,
  (SELECT state FROM public.payment_orders p JOIN public.garanti_test_single_finalize_allowances a ON a.order_id=p.order_id
    WHERE a.project_ref='dzuxhwtbuojnhibzfxqy') original_finalize_order_state,
  (SELECT count(*) FROM public.payment_events) events_after_rollback;
