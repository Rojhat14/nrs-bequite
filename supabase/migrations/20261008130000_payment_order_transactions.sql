-- PREPARED, NOT APPLIED. Inspect actual orders/order_items constraints/defaults
-- and existing policies before deployment. This does not alter existing tables
-- or policies. RPCs are service-role only; no browser can supply trusted totals.
BEGIN;
DO $$
DECLARE field text;
BEGIN
  IF to_regclass('public.order_legal_records') IS NULL OR to_regprocedure('public.nrs_is_active_admin()') IS NULL THEN
    RAISE EXCEPTION 'Apply reviewed legal/admin migrations first';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items' AND column_name='order_id' AND udt_name='uuid') THEN
    RAISE EXCEPTION 'Inspect order_items.order_id type';
  END IF;
  FOREACH field IN ARRAY ARRAY['id','user_id','total_amount','status','customer_name','customer_email','customer_phone','shipping_address','shipping_city','shipping_district','shipping_postal_code'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name=field) THEN
      RAISE EXCEPTION 'Expected orders column % missing; inspect actual schema', field;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders'
    AND is_nullable='NO' AND column_default IS NULL AND is_identity='NO'
    AND column_name <> ALL(ARRAY['id','user_id','total_amount','status','customer_name','customer_email','customer_phone','shipping_address','shipping_city','shipping_district','shipping_postal_code'])) THEN
    RAISE EXCEPTION 'Unknown required order field; adapt atomic insert to actual schema';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items'
    AND is_nullable='NO' AND column_default IS NULL AND is_identity='NO'
    AND column_name <> ALL(ARRAY['order_id','product_id','quantity','price_at_purchase'])) THEN
    RAISE EXCEPTION 'Unknown required order item field; inspect actual defaults';
  END IF;
END $$;

CREATE TABLE public.payment_orders (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  guest_hash text CHECK (guest_hash ~ '^[0-9a-f]{64}$'),
  guest_expires_at timestamptz,
  idempotency_key uuid NOT NULL UNIQUE,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  provider text NOT NULL CHECK (length(provider)>0),
  merchant_reference uuid NOT NULL UNIQUE,
  amount_minor bigint NOT NULL CHECK (amount_minor>0),
  currency text NOT NULL CHECK (currency='TRY'),
  state text NOT NULL DEFAULT 'initiating' CHECK (state IN ('initiating','pending','paid','failed')),
  transaction_id text,
  redirect_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NOT NULL AND guest_hash IS NULL) OR (user_id IS NULL AND guest_hash IS NOT NULL))
);
CREATE UNIQUE INDEX payment_orders_transaction ON public.payment_orders(provider,transaction_id) WHERE transaction_id IS NOT NULL;
CREATE TABLE public.payment_stock_reservations (
  order_id uuid NOT NULL REFERENCES public.payment_orders(order_id) ON DELETE RESTRICT,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity>0),
  released boolean NOT NULL DEFAULT false,
  PRIMARY KEY(order_id,variant_id)
);
CREATE TABLE public.payment_events (
  provider text NOT NULL,
  event_id text NOT NULL,
  order_id uuid NOT NULL REFERENCES public.payment_orders(order_id) ON DELETE RESTRICT,
  transaction_id text NOT NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  state text NOT NULL,
  three_ds text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(provider,event_id)
);
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_orders, public.payment_stock_reservations, public.payment_events FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON public.payment_orders, public.payment_stock_reservations TO service_role;
GRANT SELECT,INSERT ON public.payment_events TO service_role;
-- No direct browser access, including tokens/redirect URLs. Use narrow server RPC.
CREATE POLICY nrs_order_legal_admin_read ON public.order_legal_records FOR SELECT TO authenticated USING (public.nrs_is_active_admin());

CREATE FUNCTION public.nrs_create_payment_order(p_order_id uuid,p_user_id uuid,p_guest_hash text,p_key uuid,
  p_request_hash text,p_items jsonb,p_customer jsonb,p_legal jsonb,p_provider text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.payment_orders%ROWTYPE; item jsonb; product public.products%ROWTYPE;
  variant public.product_variants%ROWTYPE; snapshot jsonb; line jsonb; total_minor bigint:=0; subtotal_minor bigint:=0;
  sale_minor bigint; shipping_minor bigint; quantity integer; count_items integer:=0;
BEGIN
  -- Same-key concurrent requests serialize before checking/creating anything.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
  SELECT * INTO previous FROM public.payment_orders WHERE idempotency_key=p_key FOR UPDATE;
  IF FOUND THEN
    IF previous.user_id IS DISTINCT FROM p_user_id OR previous.guest_hash IS DISTINCT FROM p_guest_hash OR previous.request_hash<>p_request_hash THEN
      RAISE EXCEPTION 'idempotency ownership/content mismatch';
    END IF;
    RETURN jsonb_build_object('created',false,'order',jsonb_build_object('id',previous.order_id,'merchantReference',previous.merchant_reference,
      'amountMinor',previous.amount_minor,'currency',previous.currency,'state',previous.state,
      'legal',(SELECT to_jsonb(l) FROM public.order_legal_records l WHERE l.order_id=previous.order_id)));
  END IF;
  IF (p_legal->>'contract_accepted') IS DISTINCT FROM 'true' OR coalesce(p_legal->>'contract_version','') NOT IN ('v1.1','v1.3','v1.4')
    OR coalesce(p_legal->>'pre_information_version','') NOT IN ('v1.1','v1.3','v1.4')
    OR p_legal->>'contract_version' IS DISTINCT FROM p_legal->>'pre_information_version' OR (p_legal->>'order_id') IS DISTINCT FROM p_order_id::text THEN
    RAISE EXCEPTION 'invalid legal acceptance';
  END IF;
  snapshot:=p_legal->'order_summary';
  IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100
    OR jsonb_array_length(snapshot->'items')<>jsonb_array_length(p_items)
    OR snapshot->>'currency'<>'TRY' OR snapshot->>'shipping' IS NULL THEN RAISE EXCEPTION 'invalid summary'; END IF;
  -- Lock products/variants in consistent order. All stock mutations for these
  -- online orders happen inside this transaction; no separate decrement call.
  PERFORM 1 FROM public.products p WHERE p.id IN (SELECT x->>'productId' FROM jsonb_array_elements(p_items) x) ORDER BY p.id FOR UPDATE;
  PERFORM 1 FROM public.product_variants v WHERE v.id IN (SELECT (x->>'variantId')::uuid FROM jsonb_array_elements(p_items) x) ORDER BY v.id FOR UPDATE;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    quantity:=(item->>'quantity')::integer;
    IF quantity NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid quantity'; END IF;
    SELECT * INTO product FROM public.products WHERE id=item->>'productId';
    IF NOT FOUND OR product.status<>'active' OR NOT product.in_stock OR product.currency<>'TRY' OR product.price_amount<=0 THEN RAISE EXCEPTION 'product unavailable'; END IF;
    SELECT * INTO variant FROM public.product_variants WHERE id=(item->>'variantId')::uuid AND product_id=product.id;
    IF NOT FOUND OR NOT variant.is_active OR variant.stock_quantity<quantity THEN RAISE EXCEPTION 'stock unavailable'; END IF;
    line:=snapshot->'items'->count_items;
    sale_minor:=round(product.price_amount*100)::bigint;
    IF line->>'productId' IS DISTINCT FROM product.id OR line->>'name' IS DISTINCT FROM product.name
      OR line->>'description' IS DISTINCT FROM coalesce(nullif(product.description,''),product.name)
      OR line->>'size' IS DISTINCT FROM nullif(variant.size,'') OR (line->>'quantity')::integer<>quantity
      OR round((line->>'unitPrice')::numeric*100)::bigint<>sale_minor THEN RAISE EXCEPTION 'quote changed'; END IF;
    total_minor:=total_minor+sale_minor*quantity;
    subtotal_minor:=subtotal_minor+round(greatest(product.price_amount,coalesce(product.compare_at_price,product.price_amount))*100)::bigint*quantity;
    count_items:=count_items+1;
  END LOOP;
  shipping_minor:=round((snapshot->>'shipping')::numeric*100)::bigint;
  IF shipping_minor<0 OR round((snapshot->>'subtotal')::numeric*100)::bigint<>subtotal_minor
    OR round((snapshot->>'discount')::numeric*100)::bigint<>subtotal_minor-total_minor
    OR round((snapshot->>'total')::numeric*100)::bigint<>total_minor+shipping_minor THEN RAISE EXCEPTION 'total mismatch'; END IF;
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

CREATE FUNCTION public.nrs_store_payment_redirect(p_order_id uuid,p_redirect text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  UPDATE public.payment_orders SET redirect_url=p_redirect,state='pending',updated_at=now() WHERE order_id=p_order_id AND state='initiating';
  -- A callback may arrive first; never overwrite its terminal state.
END $$;

CREATE FUNCTION public.nrs_finalize_payment(p_payment jsonb,p_provider text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE payment public.payment_orders%ROWTYPE; event public.payment_events%ROWTYPE; reservation record; final_state text; order_status text;
BEGIN
  SELECT * INTO payment FROM public.payment_orders WHERE merchant_reference=(p_payment->>'merchantReference')::uuid FOR UPDATE;
  IF NOT FOUND OR payment.provider<>p_provider OR payment.amount_minor<>(p_payment->>'amountMinor')::bigint
    OR payment.currency<>p_payment->>'currency' THEN RAISE EXCEPTION 'verified result mismatch'; END IF;
  SELECT * INTO event FROM public.payment_events WHERE provider=p_provider AND event_id=p_payment->>'eventId';
  IF FOUND THEN
    IF event.order_id<>payment.order_id OR event.transaction_id<>p_payment->>'transactionId'
      OR event.state<>p_payment->>'status' OR event.amount_minor<>payment.amount_minor OR event.currency<>payment.currency
      OR event.three_ds<>p_payment->>'threeDS' THEN RAISE EXCEPTION 'event replay mismatch'; END IF;
    RETURN;
  END IF;
  final_state:=p_payment->>'status';
  IF final_state NOT IN ('paid','failed','pending') OR (final_state='paid' AND p_payment->>'threeDS' NOT IN ('authenticated','not_required')) THEN RAISE EXCEPTION 'unverified payment'; END IF;
  IF payment.state IN ('paid','failed') AND payment.state<>final_state THEN RAISE EXCEPTION 'terminal state conflict; reconcile with provider'; END IF;
  IF payment.transaction_id IS NOT NULL AND payment.transaction_id<>p_payment->>'transactionId' THEN RAISE EXCEPTION 'transaction mismatch'; END IF;
  SELECT status INTO order_status FROM public.orders WHERE id=payment.order_id FOR UPDATE;
  IF final_state='paid' AND order_status NOT IN ('payment_pending','paid') THEN RAISE EXCEPTION 'order state conflict; reconcile'; END IF;
  INSERT INTO public.payment_events(provider,event_id,order_id,transaction_id,amount_minor,currency,state,three_ds)
    VALUES(p_provider,p_payment->>'eventId',payment.order_id,p_payment->>'transactionId',payment.amount_minor,payment.currency,final_state,p_payment->>'threeDS');
  IF payment.state NOT IN ('paid','failed') THEN
    UPDATE public.payment_orders SET state=final_state,transaction_id=p_payment->>'transactionId',updated_at=now() WHERE order_id=payment.order_id;
    IF final_state='paid' THEN UPDATE public.orders SET status='paid',payment_id=p_payment->>'transactionId' WHERE id=payment.order_id; END IF;
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

CREATE FUNCTION public.nrs_read_payment_order(p_order_id uuid,p_user_id uuid,p_guest_hash text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT jsonb_build_object('id',p.order_id,'status',p.state,'legal',to_jsonb(l))
    FROM public.payment_orders p JOIN public.order_legal_records l ON l.order_id=p.order_id
    WHERE p.order_id=p_order_id AND ((p.user_id IS NOT NULL AND p.user_id=p_user_id)
      OR (p.user_id IS NULL AND p.guest_hash=p_guest_hash AND p.guest_expires_at>now()));
$$;
REVOKE ALL ON FUNCTION public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text),public.nrs_store_payment_redirect(uuid,text),public.nrs_finalize_payment(jsonb,text),public.nrs_read_payment_order(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text),public.nrs_store_payment_redirect(uuid,text),public.nrs_finalize_payment(jsonb,text),public.nrs_read_payment_order(uuid,uuid,text) TO service_role;
COMMIT;
