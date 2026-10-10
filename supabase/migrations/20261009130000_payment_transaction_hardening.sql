-- LOCAL REVIEW ONLY; apply after both 20261008 payment/legal migrations.
-- No guest schema change: retain orders.user_id NOT NULL and existing FK action.
-- Existing legacy events keep merchant_id NULL; ambiguous legacy replays fail.
BEGIN;
DO $$ DECLARE r record; state text; accepted boolean; status_column smallint; BEGIN
  IF to_regprocedure('public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)') IS NULL
    OR to_regprocedure('public.nrs_finalize_payment(jsonb,text)') IS NULL THEN RAISE EXCEPTION 'Payment RPC prerequisites missing'; END IF;
  FOR r IN SELECT * FROM (VALUES ('orders','id','uuid'),('orders','user_id','uuid'),('orders','status','text'),('orders','total_amount','numeric'),('order_items','product_id','text'),('products','id','text'),('products','price_amount','numeric'),('product_variants','id','uuid'),('product_variants','product_id','text'),('product_variants','stock_quantity','int4'),('payment_events','order_id','uuid'),('order_legal_records','order_id','uuid')) AS required(t,c,typ) LOOP
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name=r.t AND column_name=r.c AND udt_name=r.typ) THEN RAISE EXCEPTION 'Schema mismatch: %.%',r.t,r.c; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='user_id' AND is_nullable='NO') THEN RAISE EXCEPTION 'Review ownership schema: expected orders.user_id NOT NULL'; END IF;
  FOR r IN SELECT * FROM (VALUES ('orders','user_id','auth.users'),('order_legal_records','order_id','public.orders'),('payment_orders','order_id','public.orders'),('payment_stock_reservations','variant_id','public.product_variants')) AS required(t,c,target) LOOP
    IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid=format('public.%I',r.t)::regclass AND confrelid=r.target::regclass AND contype='f'
      AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=format('public.%I',r.t)::regclass AND attname=r.c)]
      AND confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=r.target::regclass AND attname='id')]) THEN RAISE EXCEPTION 'Foreign key mismatch: %.%',r.t,r.c; END IF;
  END LOOP;
  SELECT attnum INTO status_column FROM pg_attribute WHERE attrelid='public.orders'::regclass AND attname='status';
  FOR r IN SELECT conname,conkey,pg_get_expr(conbin,conrelid) AS expression FROM pg_constraint WHERE conrelid='public.orders'::regclass AND contype='c' AND status_column=ANY(conkey) LOOP
    IF r.conkey IS DISTINCT FROM ARRAY[status_column] THEN RAISE EXCEPTION 'Review composite status constraint %',r.conname; END IF;
    FOREACH state IN ARRAY ARRAY['payment_pending','paid','cancelled'] LOOP
      EXECUTE format('SELECT (%s) FROM jsonb_populate_record(NULL::public.orders,jsonb_build_object(''status'',$1))',r.expression) INTO accepted USING state;
      IF accepted IS DISTINCT FROM true THEN RAISE EXCEPTION 'Status % incompatible with constraint %',state,r.conname; END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_events' AND column_name='merchant_id') THEN RAISE EXCEPTION 'Already hardened: inspect migration history'; END IF;
END $$;
ALTER TABLE public.payment_events ADD COLUMN merchant_id text CHECK (merchant_id IS NULL OR length(btrim(merchant_id))>0);
CREATE OR REPLACE FUNCTION public.nrs_create_payment_order(p_order_id uuid,p_user_id uuid,p_guest_hash text,p_key uuid,
  p_request_hash text,p_items jsonb,p_customer jsonb,p_legal jsonb,p_provider text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.payment_orders%ROWTYPE; item jsonb; product public.products%ROWTYPE;
  variant public.product_variants%ROWTYPE; snapshot jsonb; line jsonb; total_minor bigint:=0; subtotal_minor bigint:=0;
  sale_minor bigint; shipping_minor bigint; quantity integer; count_items integer:=0;
BEGIN
  IF p_user_id IS NULL OR p_guest_hash IS NOT NULL THEN RAISE EXCEPTION 'Authenticated checkout required'; END IF;
  IF p_key IS NULL OR p_order_id IS NULL OR p_request_hash IS NULL OR p_request_hash !~ '^[0-9a-f]{64}$'
    OR p_provider IS NULL OR btrim(p_provider)='' THEN RAISE EXCEPTION 'invalid payment request'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid items'; END IF;
  IF EXISTS (SELECT FROM jsonb_array_elements(p_items) x GROUP BY x->>'variantId' HAVING count(*)>1) THEN RAISE EXCEPTION 'duplicate variant'; END IF;
  -- Same-key concurrent requests serialize before checking/creating anything.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
  SELECT * INTO previous FROM public.payment_orders WHERE idempotency_key=p_key FOR UPDATE;
  IF FOUND THEN
    IF previous.user_id IS DISTINCT FROM p_user_id OR previous.guest_hash IS DISTINCT FROM p_guest_hash OR previous.request_hash IS DISTINCT FROM p_request_hash OR previous.provider IS DISTINCT FROM p_provider THEN
      RAISE EXCEPTION 'idempotency ownership/content mismatch';
    END IF;
    RETURN jsonb_build_object('created',false,'order',jsonb_build_object('id',previous.order_id,'merchantReference',previous.merchant_reference,
      'amountMinor',previous.amount_minor,'currency',previous.currency,'state',previous.state,
      'legal',(SELECT to_jsonb(l) FROM public.order_legal_records l WHERE l.order_id=previous.order_id)));
  END IF;
  -- Serialize new attempts per owner as well as per key. A lost browser key or
  -- changed cart must not initiate a second payment while settlement is unknown.
  PERFORM pg_advisory_xact_lock(hashtextextended('payment-owner:'||p_user_id::text,0));
  IF EXISTS (SELECT FROM public.payment_orders WHERE user_id=p_user_id AND state IN ('initiating','pending')) THEN
    RAISE EXCEPTION 'Unresolved payment exists; reconcile before a new attempt';
  END IF;
  IF (p_legal->>'contract_accepted') IS DISTINCT FROM 'true' OR coalesce(p_legal->>'contract_version','') NOT IN ('v1.1','v1.3','v1.4')
    OR coalesce(p_legal->>'pre_information_version','') NOT IN ('v1.1','v1.3','v1.4')
    OR p_legal->>'contract_version' IS DISTINCT FROM p_legal->>'pre_information_version' OR (p_legal->>'order_id') IS DISTINCT FROM p_order_id::text THEN
    RAISE EXCEPTION 'invalid legal acceptance';
  END IF;
  snapshot:=p_legal->'order_summary';
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100
    OR jsonb_typeof(snapshot->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(snapshot->'items') IS DISTINCT FROM jsonb_array_length(p_items)
    OR snapshot->>'currency' IS DISTINCT FROM 'TRY' OR snapshot->>'shipping' IS NULL THEN RAISE EXCEPTION 'invalid summary'; END IF;
  -- Lock products/variants in consistent order. All stock mutations for these
  -- online orders happen inside this transaction; no separate decrement call.
  PERFORM 1 FROM public.products p WHERE p.id IN (SELECT x->>'productId' FROM jsonb_array_elements(p_items) x) ORDER BY p.id FOR UPDATE;
  PERFORM 1 FROM public.product_variants v WHERE v.id IN (SELECT (x->>'variantId')::uuid FROM jsonb_array_elements(p_items) x) ORDER BY v.id FOR UPDATE;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    quantity:=(item->>'quantity')::integer;
    IF quantity IS NULL OR quantity NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid quantity'; END IF;
    SELECT * INTO product FROM public.products WHERE id=item->>'productId';
    IF NOT FOUND OR product.status IS DISTINCT FROM 'active' OR product.currency IS DISTINCT FROM 'TRY' OR product.price_amount IS NULL OR product.price_amount<=0 THEN RAISE EXCEPTION 'product unavailable'; END IF;
    SELECT * INTO variant FROM public.product_variants WHERE id=(item->>'variantId')::uuid AND product_id=product.id;
    IF NOT FOUND OR variant.is_active IS DISTINCT FROM true OR variant.stock_quantity IS NULL OR variant.stock_quantity<quantity THEN RAISE EXCEPTION 'stock unavailable'; END IF;
    line:=snapshot->'items'->count_items;

    IF p_legal->>'contract_version' IN ('v1.3','v1.4') THEN
      IF line->>'measurementKind' IS NULL OR line->>'measurementKind' NOT IN ('dress','trousers','skirt','top','suit','accessory') THEN RAISE EXCEPTION 'measurement kind missing'; END IF;
      IF EXISTS(SELECT FROM unnest(CASE line->>'measurementKind'
        WHEN 'trousers' THEN ARRAY['waist','hips','inseam','length']
        WHEN 'skirt' THEN ARRAY['waist','hips','length']
        WHEN 'top' THEN ARRAY['chest','waist','shoulder','sleeve','length']
        WHEN 'suit' THEN ARRAY['chest','waist','hips','height','shoulder','sleeve','length','inseam']
        WHEN 'accessory' THEN ARRAY[]::text[] ELSE ARRAY['chest','waist','hips','height'] END) field
        WHERE jsonb_typeof(line->'measurements'->field) IS DISTINCT FROM 'number') THEN RAISE EXCEPTION 'required measurements missing'; END IF;
      IF jsonb_typeof(line->'measurements') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid measurements'; END IF;
      IF EXISTS(SELECT FROM jsonb_each(line->'measurements') m LEFT JOIN (VALUES
        ('chest',50,180),('waist',40,180),('hips',50,200),('height',120,220),('shoulder',20,70),('sleeve',10,100),('length',20,200),('inseam',30,120)) limits(k,lo,hi) ON limits.k=m.key
        WHERE limits.k IS NULL OR jsonb_typeof(m.value) IS DISTINCT FROM 'number' OR (m.value::text)::numeric NOT BETWEEN limits.lo AND limits.hi) THEN RAISE EXCEPTION 'invalid measurement range'; END IF;
    END IF;
    sale_minor:=round(product.price_amount*100)::bigint;
    IF line->>'productId' IS DISTINCT FROM product.id OR line->>'name' IS DISTINCT FROM product.name
      OR line->>'description' IS DISTINCT FROM coalesce(nullif(product.description,''),product.name)
      OR line->>'size' IS DISTINCT FROM nullif(variant.size,'') OR (line->>'quantity')::integer IS DISTINCT FROM quantity
      OR round((line->>'unitPrice')::numeric*100)::bigint IS DISTINCT FROM sale_minor THEN RAISE EXCEPTION 'quote changed'; END IF;
    total_minor:=total_minor+sale_minor*quantity;
    subtotal_minor:=subtotal_minor+round(greatest(product.price_amount,coalesce(product.compare_at_price,product.price_amount))*100)::bigint*quantity;
    count_items:=count_items+1;
  END LOOP;
  shipping_minor:=round((snapshot->>'shipping')::numeric*100)::bigint;
  IF shipping_minor IS NULL OR shipping_minor<0 OR round((snapshot->>'subtotal')::numeric*100)::bigint IS DISTINCT FROM subtotal_minor
    OR round((snapshot->>'discount')::numeric*100)::bigint IS DISTINCT FROM subtotal_minor-total_minor
    OR round((snapshot->>'total')::numeric*100)::bigint IS DISTINCT FROM total_minor+shipping_minor THEN RAISE EXCEPTION 'total mismatch'; END IF;
  IF snapshot->'buyer'->>'name' IS DISTINCT FROM (p_customer->>'firstName')||' '||(p_customer->>'lastName')
    OR snapshot->'buyer'->>'email' IS DISTINCT FROM p_customer->>'email'
    OR snapshot->'buyer'->>'phone' IS DISTINCT FROM p_customer->>'phone' THEN RAISE EXCEPTION 'buyer summary mismatch'; END IF;
  INSERT INTO public.orders(id,user_id,total_amount,status,customer_name,customer_email,customer_phone,shipping_address,shipping_city,shipping_district,shipping_postal_code)
    VALUES(p_order_id,p_user_id,(total_minor+shipping_minor)/100.0,'payment_pending',
      (p_customer->>'firstName')||' '||(p_customer->>'lastName'),p_customer->>'email',p_customer->>'phone',p_customer->>'address',p_customer->>'city',p_customer->>'district',p_customer->>'postalCode');
  INSERT INTO public.order_legal_records(order_id,contract_accepted,contract_version,pre_information_version,accepted_at,document_hash,summary_hash,order_summary)
    VALUES(p_order_id,true,p_legal->>'contract_version',p_legal->>'pre_information_version',now(),p_legal->>'document_hash',p_legal->>'summary_hash',snapshot);
  INSERT INTO public.payment_orders(order_id,user_id,guest_hash,guest_expires_at,idempotency_key,request_hash,provider,merchant_reference,amount_minor,currency)
    VALUES(p_order_id,p_user_id,p_guest_hash,CASE WHEN p_guest_hash IS NOT NULL THEN now()+interval '30 days' END,p_key,p_request_hash,p_provider,p_order_id,total_minor+shipping_minor,'TRY');
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO product FROM public.products WHERE id=item->>'productId';
    INSERT INTO public.order_items(order_id,product_id,quantity,price_at_purchase) VALUES(p_order_id,product.id,(item->>'quantity')::integer,product.price_amount);
    INSERT INTO public.payment_stock_reservations(order_id,variant_id,quantity) VALUES(p_order_id,(item->>'variantId')::uuid,(item->>'quantity')::integer);
    UPDATE public.product_variants SET stock_quantity=stock_quantity-(item->>'quantity')::integer WHERE id=(item->>'variantId')::uuid;
  END LOOP;
  RETURN jsonb_build_object('created',true,'order',jsonb_build_object('id',p_order_id,'merchantReference',p_order_id,
    'amountMinor',total_minor+shipping_minor,'currency','TRY','state','initiating',
    'legal',(SELECT to_jsonb(l) FROM public.order_legal_records l WHERE l.order_id=p_order_id)));
END $$;

CREATE OR REPLACE FUNCTION public.nrs_finalize_payment(p_payment jsonb,p_provider text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE payment public.payment_orders%ROWTYPE; event public.payment_events%ROWTYPE; reservation record; final_state text; order_status text;
BEGIN
  -- Only adapter-verified results reach this service-role-only RPC. This is
  -- structural/business validation, NOT a substitute for provider signatures.
  IF jsonb_typeof(p_payment) IS DISTINCT FROM 'object' OR p_provider IS NULL OR btrim(p_provider)=''
    OR EXISTS (SELECT FROM unnest(ARRAY['merchantId','merchantReference','transactionId','eventId','currency','status','threeDS']) field
      WHERE jsonb_typeof(p_payment->field) IS DISTINCT FROM 'string' OR btrim(p_payment->>field)='')
    OR jsonb_typeof(p_payment->'amountMinor') IS DISTINCT FROM 'number'
    OR (p_payment->>'amountMinor') !~ '^[0-9]+$'
    OR (p_payment->>'amountMinor')::numeric<=0
    OR p_payment->>'status' NOT IN ('paid','failed','pending')
    OR p_payment->>'threeDS' NOT IN ('authenticated','not_required','failed')
    OR (p_payment->>'status'='paid' AND p_payment->>'threeDS' NOT IN ('authenticated','not_required')) THEN
    RAISE EXCEPTION 'unverified payment';
  END IF;
  SELECT * INTO payment FROM public.payment_orders WHERE merchant_reference=(p_payment->>'merchantReference')::uuid FOR UPDATE;
  IF NOT FOUND OR payment.provider IS DISTINCT FROM p_provider OR payment.amount_minor IS DISTINCT FROM (p_payment->>'amountMinor')::bigint
    OR payment.currency IS DISTINCT FROM p_payment->>'currency' THEN RAISE EXCEPTION 'verified result mismatch'; END IF;
  SELECT * INTO event FROM public.payment_events WHERE provider=p_provider AND event_id=p_payment->>'eventId';
  IF FOUND THEN
    IF event.order_id IS DISTINCT FROM payment.order_id OR event.transaction_id IS DISTINCT FROM p_payment->>'transactionId'
      OR event.state IS DISTINCT FROM p_payment->>'status' OR event.amount_minor IS DISTINCT FROM payment.amount_minor OR event.currency IS DISTINCT FROM payment.currency
      OR event.three_ds IS DISTINCT FROM p_payment->>'threeDS' OR event.merchant_id IS DISTINCT FROM p_payment->>'merchantId' THEN RAISE EXCEPTION 'event replay mismatch'; END IF;
    RETURN;
  END IF;
  final_state:=p_payment->>'status';
  IF final_state NOT IN ('paid','failed','pending') OR (final_state='paid' AND p_payment->>'threeDS' NOT IN ('authenticated','not_required')) THEN RAISE EXCEPTION 'unverified payment'; END IF;
  IF payment.state IN ('paid','failed') AND payment.state<>final_state THEN RAISE EXCEPTION 'terminal state conflict; reconcile with provider'; END IF;
  IF payment.transaction_id IS NOT NULL AND payment.transaction_id IS DISTINCT FROM p_payment->>'transactionId' THEN RAISE EXCEPTION 'transaction mismatch'; END IF;
  SELECT status INTO order_status FROM public.orders WHERE id=payment.order_id FOR UPDATE;
  IF order_status IS NULL OR (final_state='paid' AND payment.state<>'paid' AND order_status NOT IN ('payment_pending','paid')) THEN RAISE EXCEPTION 'order state conflict; reconcile'; END IF;
  INSERT INTO public.payment_events(provider,event_id,order_id,transaction_id,amount_minor,currency,state,three_ds,merchant_id)
    VALUES(p_provider,p_payment->>'eventId',payment.order_id,p_payment->>'transactionId',payment.amount_minor,payment.currency,final_state,p_payment->>'threeDS',p_payment->>'merchantId');
  IF payment.state NOT IN ('paid','failed') THEN
    UPDATE public.payment_orders SET state=final_state,transaction_id=p_payment->>'transactionId',updated_at=now() WHERE order_id=payment.order_id;
    IF final_state='paid' THEN UPDATE public.orders SET status='paid' WHERE id=payment.order_id; END IF;
    IF final_state='failed' THEN
      -- Definitively failed verification only. Network timeout is pending and
      -- MUST NOT release stock until bank reconciliation excludes settlement.
      FOR reservation IN SELECT * FROM public.payment_stock_reservations WHERE order_id=payment.order_id AND NOT released ORDER BY variant_id FOR UPDATE LOOP
        UPDATE public.product_variants SET stock_quantity=stock_quantity+reservation.quantity WHERE id=reservation.variant_id;
        UPDATE public.payment_stock_reservations SET released=true WHERE order_id=payment.order_id AND variant_id=reservation.variant_id;
      END LOOP;
      UPDATE public.orders SET status='cancelled' WHERE id=payment.order_id AND status='payment_pending';
    END IF;
  END IF;
END $$;


CREATE OR REPLACE FUNCTION public.nrs_admin_update_order_status(p_order_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_status text;
  payment_state text;
  has_payment boolean;
BEGIN
  IF public.nrs_is_active_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('pending', 'payment_pending', 'processing', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported operational order status' USING ERRCODE = '22023';
  END IF;

  -- Match finalize lock order: payment first, then order. A callback either
  -- commits before this read or waits; no stale read can cancel settlement.
  SELECT p.state INTO payment_state FROM public.payment_orders p
  WHERE p.order_id=p_order_id FOR UPDATE;
  has_payment:=FOUND;

  SELECT o.status INTO current_status
  FROM public.orders AS o
  WHERE o.id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;

  IF current_status IS NULL OR current_status NOT IN
    ('pending','payment_pending','paid','processing','shipped','delivered','cancelled','refunded') THEN
    RAISE EXCEPTION 'unknown current order status; manual review required' USING ERRCODE='22023';
  END IF;
  IF has_payment AND (payment_state IS NULL OR payment_state NOT IN ('paid','failed')) THEN
    RAISE EXCEPTION 'Unresolved online payment; reconcile before operational changes' USING ERRCODE='22023';
  END IF;

  -- This legacy schema stores payment and fulfillment state in one column.
  -- Do not overwrite a payment result or advance an unpaid order to fulfillment.
  IF current_status='paid' AND p_status='processing' AND EXISTS (
    SELECT FROM public.payment_orders WHERE order_id=p_order_id AND state='paid'
  ) THEN
    -- Payment remains paid in payment_orders; orders.status may track fulfillment.
    UPDATE public.orders SET status='processing' WHERE id=p_order_id;
    RETURN;
  END IF;
  IF p_status='cancelled' AND current_status IN ('processing','shipped') AND EXISTS (
    SELECT FROM public.payment_orders WHERE order_id=p_order_id AND state='paid'
  ) THEN RAISE EXCEPTION 'Verified payment requires bank refund workflow, not manual cancellation' USING ERRCODE='22023'; END IF;
  IF current_status IN ('paid', 'refunded') THEN
    RAISE EXCEPTION 'payment state cannot be replaced by an operational status' USING ERRCODE = '22023';
  END IF;
  IF current_status IN ('pending', 'payment_pending') AND p_status <> 'cancelled' THEN
    RAISE EXCEPTION 'unpaid order cannot advance to fulfillment' USING ERRCODE = '22023';
  END IF;
  IF current_status = 'processing' AND p_status NOT IN ('shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported fulfillment transition' USING ERRCODE = '22023';
  END IF;
  IF current_status = 'shipped' AND p_status NOT IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported fulfillment transition' USING ERRCODE = '22023';
  END IF;
  IF current_status NOT IN ('pending', 'payment_pending', 'processing', 'shipped') THEN
    RAISE EXCEPTION 'current order status is not editable in admin' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET status = p_status
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.nrs_admin_update_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nrs_admin_update_order_status(uuid, text) TO authenticated;


-- Narrow active-admin metadata view. Never expose guest hashes or redirect tokens.
CREATE FUNCTION public.nrs_admin_payment_summary(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.nrs_is_active_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
  RETURN (SELECT jsonb_build_object('state',state,'provider',provider,'transactionId',transaction_id,
    'amountMinor',amount_minor,'currency',currency) FROM public.payment_orders WHERE order_id=p_order_id);
END $$;
REVOKE ALL ON FUNCTION public.nrs_admin_payment_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.nrs_admin_payment_summary(uuid) TO authenticated;

-- CREATE OR REPLACE retains prior ACLs; explicitly reassert service-only execution.
REVOKE ALL ON FUNCTION public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text),public.nrs_finalize_payment(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text),public.nrs_finalize_payment(jsonb,text) TO service_role;
COMMIT;
