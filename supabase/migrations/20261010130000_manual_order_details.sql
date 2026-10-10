-- Apply only AFTER the reviewed security migration chain and SECURITY_APPLY.
-- An unpaid request does not reserve stock or confirm manufacture/delivery.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.order_legal_records') IS NULL
    OR to_regprocedure('public.nrs_admin_payment_summary(uuid)') IS NULL
    OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role' AND rolbypassrls)
    OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.orders'::regclass AND attname='user_id' AND attnotnull AND atttypid='uuid'::regtype AND NOT attisdropped)
    OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.orders'::regclass AND attname='total_amount' AND attnotnull AND atttypid='numeric'::regtype AND NOT attisdropped)
    THEN RAISE EXCEPTION 'Reviewed order/security prerequisites missing'; END IF;
  IF NOT has_table_privilege('service_role','public.products','SELECT')
    OR NOT has_table_privilege('service_role','public.products','UPDATE')
    OR NOT has_table_privilege('service_role','public.product_variants','SELECT')
    OR NOT has_table_privilege('service_role','public.product_variants','UPDATE')
    THEN RAISE EXCEPTION 'Service catalog read/lock privileges missing'; END IF;
  FOR r IN SELECT unnest(ARRAY['orders','order_items','profiles','wishlist']) AS name LOOP
    IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('public.'||r.name) AND relrowsecurity)
      OR has_table_privilege('anon', 'public.'||r.name, 'SELECT,INSERT,UPDATE,DELETE')
      THEN RAISE EXCEPTION 'Customer security prerequisites missing: %',r.name; END IF;
  END LOOP;
  IF has_table_privilege('authenticated','public.orders','INSERT,UPDATE,DELETE')
    OR has_table_privilege('authenticated','public.order_items','INSERT,UPDATE,DELETE')
    OR EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.orders'::regclass AND attname IN ('manual_request_key','manual_request_hash','manual_paid_at','manual_payment_reference','manual_payment_confirmed_by') AND NOT attisdropped)
    OR to_regprocedure('public.nrs_create_manual_order(uuid,uuid,uuid,text,jsonb,jsonb,jsonb)') IS NOT NULL
    THEN RAISE EXCEPTION 'Unexpected existing manual-order definition or unsafe grants'; END IF;
END $$;
ALTER TABLE public.orders ADD COLUMN manual_request_key uuid UNIQUE,
  ADD COLUMN manual_request_hash text CHECK(manual_request_hash ~ '^[0-9a-f]{64}$'),
  ADD COLUMN manual_paid_at timestamptz,
  ADD COLUMN manual_payment_reference text,
  ADD COLUMN manual_payment_confirmed_by uuid REFERENCES auth.users(id);
-- Invoker, service-only: no new browser privileges or SECURITY DEFINER surface.
CREATE FUNCTION public.nrs_create_manual_order(p_order_id uuid,p_user_id uuid,p_key uuid,p_hash text,
  p_items jsonb,p_customer jsonb,p_legal jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE previous public.orders%ROWTYPE; product public.products%ROWTYPE; variant public.product_variants%ROWTYPE;
  item jsonb; line jsonb; snapshot jsonb; n integer:=0; qty integer;
  total_minor bigint:=0; subtotal_minor bigint:=0; shipping_minor bigint;
BEGIN
  IF p_order_id IS NULL OR p_user_id IS NULL OR p_key IS NULL OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid request'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('manual:'||p_key::text,0));
  SELECT * INTO previous FROM public.orders WHERE manual_request_key=p_key FOR UPDATE;
  IF FOUND THEN
    IF previous.user_id IS DISTINCT FROM p_user_id OR previous.manual_request_hash IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'retry mismatch'; END IF;
    RETURN jsonb_build_object('id',previous.id,'created',false);
  END IF;
  IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 100
    OR EXISTS(SELECT FROM jsonb_array_elements(p_items) x GROUP BY x->>'variantId' HAVING count(*)>1)
    OR (p_legal->>'contract_accepted') IS DISTINCT FROM 'true'
    OR coalesce(p_legal->>'contract_version','') NOT IN ('v1.1','v1.3','v1.4')
    OR coalesce(p_legal->>'pre_information_version','') NOT IN ('v1.1','v1.3','v1.4')
    OR p_legal->>'contract_version' IS DISTINCT FROM p_legal->>'pre_information_version'
    OR p_legal->>'order_id' IS DISTINCT FROM p_order_id::text
    THEN RAISE EXCEPTION 'invalid acceptance/items'; END IF;
  IF EXISTS(SELECT FROM unnest(ARRAY['firstName','lastName','email','phone','address','city','district']) k
    WHERE nullif(btrim(p_customer->>k),'') IS NULL OR length(p_customer->>k)>500)
    OR length(p_customer->>'orderNote')>2000 THEN RAISE EXCEPTION 'invalid customer'; END IF;
  snapshot:=p_legal->'order_summary';
  IF jsonb_typeof(snapshot->'items') IS DISTINCT FROM 'array'
    OR jsonb_array_length(snapshot->'items') IS DISTINCT FROM jsonb_array_length(p_items)
    OR snapshot->>'currency' IS DISTINCT FROM 'TRY'
    OR nullif(btrim(snapshot->>'deliveryTerms'),'') IS NULL
    OR snapshot->>'paymentMethod' IS DISTINCT FROM 'Havale / EFT — ödeme henüz doğrulanmadı'
    OR snapshot->'buyer'->>'name' IS DISTINCT FROM (p_customer->>'firstName')||' '||(p_customer->>'lastName')
    OR snapshot->'buyer'->>'email' IS DISTINCT FROM p_customer->>'email'
    OR snapshot->'buyer'->>'phone' IS DISTINCT FROM p_customer->>'phone'
    OR snapshot->'buyer'->>'address' IS DISTINCT FROM concat_ws(', ',nullif(p_customer->>'address',''),nullif(p_customer->>'district',''),nullif(p_customer->>'city',''),nullif(p_customer->>'postalCode',''))
    OR snapshot->>'orderNote' IS DISTINCT FROM nullif(p_customer->>'orderNote','')
    THEN RAISE EXCEPTION 'invalid summary'; END IF;
  PERFORM 1 FROM public.products p WHERE p.id IN(SELECT x->>'productId' FROM jsonb_array_elements(p_items) x) ORDER BY p.id FOR SHARE;
  PERFORM 1 FROM public.product_variants v WHERE v.id IN(SELECT (x->>'variantId')::uuid FROM jsonb_array_elements(p_items) x) ORDER BY v.id FOR SHARE;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    qty:=(item->>'quantity')::integer;
    IF qty IS NULL OR qty NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid quantity'; END IF;
    SELECT * INTO product FROM public.products WHERE id=item->>'productId';
    IF NOT FOUND OR product.status IS DISTINCT FROM 'active' OR product.currency IS DISTINCT FROM 'TRY'
      OR product.price_amount IS NULL OR product.price_amount<=0 THEN RAISE EXCEPTION 'product unavailable'; END IF;
    SELECT * INTO variant FROM public.product_variants WHERE id=(item->>'variantId')::uuid AND product_id=product.id;
    IF NOT FOUND OR variant.is_active IS DISTINCT FROM true OR variant.stock_quantity IS NULL OR variant.stock_quantity<qty THEN RAISE EXCEPTION 'variant unavailable'; END IF;
    line:=snapshot->'items'->n;

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
    IF line->>'productId' IS DISTINCT FROM product.id OR line->>'variantId' IS DISTINCT FROM variant.id::text
      OR line->>'name' IS DISTINCT FROM product.name OR line->>'size' IS DISTINCT FROM nullif(variant.size,'')
      OR line->>'description' IS DISTINCT FROM coalesce(nullif(product.description,''),product.name)
      OR (line->>'quantity')::integer IS DISTINCT FROM qty
      OR round((line->>'unitPrice')::numeric*100)::bigint IS DISTINCT FROM round(product.price_amount*100)::bigint
      OR coalesce(line->'measurements','{}'::jsonb) IS DISTINCT FROM coalesce(item->'measurements','{}'::jsonb)
      THEN RAISE EXCEPTION 'quote changed'; END IF;
    IF jsonb_typeof(coalesce(item->'measurements','{}'::jsonb)) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'invalid measurements'; END IF;
    IF EXISTS(SELECT FROM jsonb_each(coalesce(item->'measurements','{}'::jsonb)) m
      WHERE m.key NOT IN('chest','waist','hips','height','shoulder','sleeve','length','inseam') OR jsonb_typeof(m.value)<>'number'
      OR (m.value::text)::numeric NOT BETWEEN 1 AND 300) THEN RAISE EXCEPTION 'invalid measurements'; END IF;
    total_minor:=total_minor+round(product.price_amount*100)::bigint*qty;
    subtotal_minor:=subtotal_minor+round(greatest(product.price_amount,coalesce(product.compare_at_price,product.price_amount))*100)::bigint*qty;
    n:=n+1;
  END LOOP;
  shipping_minor:=round((snapshot->>'shipping')::numeric*100)::bigint;
  IF shipping_minor IS NULL OR shipping_minor<0
    OR round((snapshot->>'subtotal')::numeric*100)::bigint IS DISTINCT FROM subtotal_minor
    OR round((snapshot->>'discount')::numeric*100)::bigint IS DISTINCT FROM subtotal_minor-total_minor
    OR round((snapshot->>'total')::numeric*100)::bigint IS DISTINCT FROM total_minor+shipping_minor THEN RAISE EXCEPTION 'total mismatch'; END IF;
  INSERT INTO public.orders(id,user_id,total_amount,status,customer_name,customer_email,customer_phone,
    shipping_address,shipping_city,shipping_district,shipping_postal_code,manual_request_key,manual_request_hash)
  VALUES(p_order_id,p_user_id,(total_minor+shipping_minor)/100.0,'pending',snapshot->'buyer'->>'name',p_customer->>'email',p_customer->>'phone',
    p_customer->>'address',p_customer->>'city',p_customer->>'district',p_customer->>'postalCode',p_key,p_hash);
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items(order_id,product_id,quantity,price_at_purchase)
      SELECT p_order_id,id,(item->>'quantity')::integer,price_amount FROM public.products WHERE id=item->>'productId';
  END LOOP;
  INSERT INTO public.order_legal_records(order_id,contract_accepted,contract_version,pre_information_version,accepted_at,document_hash,summary_hash,order_summary)
    VALUES(p_order_id,true,p_legal->>'contract_version',p_legal->>'pre_information_version',now(),p_legal->>'document_hash',p_legal->>'summary_hash',snapshot);
  RETURN jsonb_build_object('id',p_order_id,'created',true);
END $$;
REVOKE ALL ON FUNCTION public.nrs_create_manual_order(uuid,uuid,uuid,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_create_manual_order(uuid,uuid,uuid,text,jsonb,jsonb,jsonb) TO service_role;
-- Human confirmation of an actual bank transfer; never a card-payment callback.
CREATE FUNCTION public.nrs_confirm_manual_transfer(p_order_id uuid,p_actor uuid,p_amount numeric,p_reference text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE target public.orders%ROWTYPE;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS(SELECT FROM public.admin_users WHERE user_id=p_actor AND role='admin' AND is_active=true)
    THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
  SELECT * INTO target FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND OR target.manual_request_key IS NULL OR EXISTS(SELECT FROM public.payment_orders WHERE order_id=p_order_id)
    OR p_amount IS DISTINCT FROM target.total_amount OR p_reference IS NULL OR length(btrim(p_reference)) NOT BETWEEN 6 AND 200
    THEN RAISE EXCEPTION 'invalid transfer confirmation'; END IF;
  IF target.manual_paid_at IS NOT NULL THEN
    IF target.manual_payment_reference IS DISTINCT FROM btrim(p_reference) THEN RAISE EXCEPTION 'transfer already confirmed'; END IF;
    RETURN;
  END IF;
  IF target.status IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'order is not awaiting transfer'; END IF;
  UPDATE public.orders SET manual_paid_at=now(),manual_payment_reference=btrim(p_reference),manual_payment_confirmed_by=p_actor,status='processing' WHERE id=p_order_id;
END $$;
REVOKE ALL ON FUNCTION public.nrs_confirm_manual_transfer(uuid,uuid,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_confirm_manual_transfer(uuid,uuid,numeric,text) TO service_role;
GRANT SELECT ON public.admin_users TO service_role;
-- Existing row grants/RLS remain intact; snapshots inherit the legal table's immutable trigger.
COMMIT;
