-- Private application-runtime verification. The nested exception block rolls
-- back every synthetic order, evidence row, event, and stock mutation before
-- the function returns its boolean proof.
BEGIN;

CREATE OR REPLACE FUNCTION public.nrs_test_garanti_live_single_finalize_rpcs(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE synthetic_order uuid:=gen_random_uuid(); synthetic_key uuid:=gen_random_uuid();
  synthetic_event text:='controlled-rpc-rollback-'||gen_random_uuid()::text;
  product_row public.products%ROWTYPE; variant_id uuid; customer jsonb; items jsonb; summary jsonb; legal jsonb;
  created jsonb; evidence jsonb; payment jsonb; result jsonb;
  evidence_ok boolean; failure_ok boolean; paid_ok boolean; duplicate_ok boolean; rollback_ok boolean;
  order_count bigint; payment_count bigint; event_count bigint; reservation_count bigint;
  evidence_count bigint; failure_count bigint; allowance_count bigint; stock_before integer; stock_after integer;
  unused_slots_before bigint; unused_slots_after bigint;
BEGIN
  IF NOT public.nrs_garanti_service_role_request() OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'runtime verification not authorized' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('garanti-live-rpc-selftest:'||p_user_id::text,0));
  SELECT * INTO STRICT product_row FROM public.products WHERE id='nrs-garanti-live-3try' AND status='active'
    AND payment_test_only AND currency='TRY' AND price_amount=3.00;
  SELECT id,stock_quantity INTO STRICT variant_id,stock_before FROM public.product_variants
    WHERE product_id=product_row.id AND is_active AND stock_quantity>0 ORDER BY id LIMIT 1;
  SELECT count(*) INTO STRICT unused_slots_before FROM public.garanti_live_single_finalize_slots
    WHERE user_id=p_user_id AND claimed_order_id IS NULL;
  IF unused_slots_before<1 THEN RAISE EXCEPTION 'runtime verification slot unavailable'; END IF;
  SELECT count(*) INTO order_count FROM public.orders;
  SELECT count(*) INTO payment_count FROM public.payment_orders;
  SELECT count(*) INTO event_count FROM public.payment_events;
  SELECT count(*) INTO reservation_count FROM public.payment_stock_reservations;
  SELECT count(*) INTO evidence_count FROM public.garanti_live_single_finalize_evidence;
  SELECT count(*) INTO failure_count FROM public.garanti_live_single_finalize_failures;
  SELECT count(*) INTO allowance_count FROM public.garanti_live_single_finalize_allowances WHERE user_id=p_user_id;

  BEGIN
    customer:=jsonb_build_object('firstName','Synthetic','lastName','Rollback','email','rpc-check@example.invalid',
      'phone','905550000000','address','Synthetic','city','Test','district','Test','postalCode','00000');
    items:=jsonb_build_array(jsonb_build_object('productId',product_row.id,'variantId',variant_id,'quantity',1));
    summary:=jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',product_row.id,'name',product_row.name,
      'description',coalesce(nullif(product_row.description,''),product_row.name),'quantity',1,'unitPrice',3)),
      'buyer',jsonb_build_object('name','Synthetic Rollback','email','rpc-check@example.invalid','phone','905550000000',
        'address','Synthetic, Test, Test, 00000'), 'subtotal',3,'discount',0,'shipping',0,'total',3,'currency','TRY',
      'paymentMethod','Online kartla ödeme','deliveryTerms','Synthetic rollback test','orderedAt',now());
    legal:=jsonb_build_object('order_id',synthetic_order,'contract_accepted',true,'contract_version','v1.1',
      'pre_information_version','v1.1','accepted_at',now(),'document_hash',repeat('a',64),'summary_hash',repeat('b',64),'order_summary',summary);
    created:=public.nrs_create_garanti_live_single_finalize_order(synthetic_order,p_user_id,NULL,synthetic_key,repeat('c',64),
      items,customer,legal,'garanti-oos',p_user_id);
    IF created->>'created' IS DISTINCT FROM 'true' OR created->'order'->>'id' IS DISTINCT FROM synthetic_order::text
      OR created->'order'->>'amountMinor' IS DISTINCT FROM '300' THEN RAISE EXCEPTION 'synthetic order creation failed'; END IF;
    UPDATE public.payment_orders SET state='pending' WHERE order_id=synthetic_order;
    PERFORM public.nrs_record_garanti_live_single_finalize_failure(synthetic_order,'success','callback_parse','GARANTI_SYNTHETIC_RPC_ROLLBACK');
    SELECT safe_code='GARANTI_SYNTHETIC_RPC_ROLLBACK' INTO STRICT failure_ok
      FROM public.garanti_live_single_finalize_failures WHERE order_id=synthetic_order;
    evidence:=jsonb_build_object('order_id',synthetic_order,'signature_verified',true,'signature_algorithm','sha1','signature_encoding','iso-8859-9',
      'order_match',true,'amount_match',true,'currency_match',true,'terminal_match',true,'request_match',true,
      'callback_mdstatus','1','callback_response','approved','callback_procreturncode','00','query_http',200,
      'query_order_match',true,'query_identity_match',true,'query_amount_match',true,'query_result_codes_match',true,
      'query_status','APPROVED','query_charge_type','S','auth_date_format','timestamp','auth_code_match',true,'bank_reference_present',true);
    PERFORM public.nrs_store_garanti_live_single_finalize_evidence(synthetic_order,evidence);
    SELECT signature_verified AND order_match AND amount_match AND currency_match AND terminal_match AND request_match
      AND query_order_match AND query_identity_match AND query_amount_match AND query_result_codes_match
      INTO STRICT evidence_ok FROM public.garanti_live_single_finalize_evidence WHERE order_id=synthetic_order;
    IF failure_ok IS DISTINCT FROM true OR evidence_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'synthetic evidence readback failed'; END IF;
    payment:=jsonb_build_object('eventId',synthetic_event,'merchantId','synthetic-merchant','merchantReference',synthetic_order,
      'transactionId','synthetic-terminal:rollback','amountMinor',300,'currency','TRY','status','paid','threeDS','authenticated');
    PERFORM public.nrs_finalize_garanti_live_single_finalize_payment(payment,'garanti-oos');
    SELECT p.state='paid' AND o.status='paid' AND a.consumed_at IS NOT NULL AND v.stock_quantity=stock_before-1
      INTO STRICT paid_ok FROM public.payment_orders p JOIN public.orders o ON o.id=p.order_id
      JOIN public.payment_stock_reservations r ON r.order_id=p.order_id AND NOT r.released
      JOIN public.product_variants v ON v.id=r.variant_id
      JOIN public.garanti_live_single_finalize_allowances a ON a.order_id=p.order_id WHERE p.order_id=synthetic_order;
    PERFORM public.nrs_finalize_garanti_live_single_finalize_payment(payment,'garanti-oos');
    SELECT (SELECT count(*)=1 FROM public.payment_events WHERE order_id=synthetic_order)
      AND (SELECT count(*)=1 FROM public.payment_stock_reservations WHERE order_id=synthetic_order AND NOT released)
      AND (SELECT stock_quantity=stock_before-1 FROM public.product_variants WHERE id=variant_id)
      INTO duplicate_ok;
    IF paid_ok IS DISTINCT FROM true OR duplicate_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'synthetic finalize assertion failed'; END IF;
    result:=jsonb_build_object('create',true,'failureWriteReadback',failure_ok,'evidenceWriteReadback',evidence_ok,
      'finalize',paid_ok,'repeatFinalizeIdempotent',duplicate_ok,'syntheticOnly',true,'bankRequestSent',false);
    RAISE EXCEPTION 'nrs_expected_selftest_rollback' USING ERRCODE='P0001';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM<>'nrs_expected_selftest_rollback' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO unused_slots_after FROM public.garanti_live_single_finalize_slots
    WHERE user_id=p_user_id AND claimed_order_id IS NULL;
  SELECT stock_quantity INTO stock_after FROM public.product_variants WHERE id=variant_id;
  rollback_ok:=unused_slots_after=unused_slots_before AND stock_after=stock_before
    AND (SELECT count(*) FROM public.orders)=order_count
    AND (SELECT count(*) FROM public.payment_orders)=payment_count
    AND (SELECT count(*) FROM public.payment_events)=event_count
    AND (SELECT count(*) FROM public.payment_stock_reservations)=reservation_count
    AND (SELECT count(*) FROM public.garanti_live_single_finalize_evidence)=evidence_count
    AND (SELECT count(*) FROM public.garanti_live_single_finalize_failures)=failure_count
    AND (SELECT count(*) FROM public.garanti_live_single_finalize_allowances WHERE user_id=p_user_id)=allowance_count
    AND NOT has_function_privilege('anon','public.nrs_finalize_garanti_live_single_finalize_payment(jsonb,text)','EXECUTE')
    AND NOT has_function_privilege('authenticated','public.nrs_finalize_garanti_live_single_finalize_payment(jsonb,text)','EXECUTE')
    AND has_function_privilege('service_role','public.nrs_finalize_garanti_live_single_finalize_payment(jsonb,text)','EXECUTE');
  IF rollback_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'synthetic rollback assertion failed'; END IF;
  RETURN result||jsonb_build_object('rollback',true,'anonAuthenticatedDenied',true);
END $$;

REVOKE ALL ON FUNCTION public.nrs_test_garanti_live_single_finalize_rpcs(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_test_garanti_live_single_finalize_rpcs(uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
