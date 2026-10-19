-- The eleven reviewed dress records use made-to-order numeric sizes. They do
-- not consume ready inventory. Legacy variants remain for historical orders,
-- but become unavailable to new carts so customers must choose a current size.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
DECLARE mismatches integer;
BEGIN
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='payment_test_only')
    OR NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='status')
    OR NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='category_id') THEN
    RAISE EXCEPTION 'Reviewed product eligibility columns are missing';
  END IF;

  WITH expected(id,name) AS (VALUES
    ('noir-crystal-collar-saten-elbise','Noir Crystal Collar Saten Elbise'),
    ('burgundy-embroidered-kalem-elbise','Burgundy Embroidered Kalem Elbise'),
    ('11111222','Beige Cep Detaylı Büzgülü Maksi Gömlek Elbise'),
    ('slate-cepli-dugmeli-maxi-gomlek-elbise','Slate Maxi Gömlek Elbise'),
    ('azure-geometrik-desenli-dugmeli-maxi-elbise','Azure Geometrik Desenli Elbise'),
    ('noir-bros-detayli-kruvaze-uzun-elbise','Noir Broş Detaylı Kruvaze Uzun Elbise'),
    ('noir-cicek-aplikeli-gipeli-maksi-siyah-elbise','Noir Çiçek Aplikeli Gipeli Maksi Siyah Elbise'),
    ('scarlet-dik-yaka-v-dekolteli-kirmizi-midi-elbise','Scarlet Dik Yaka V Dekolteli Kırmızı Midi Elbise'),
    ('elysian-asimetrik-yaka-drape-katmanli-kahve-midi-elbise','Elysian Asimetrik Yaka Drape Katmanlı Kahve Midi Elbise'),
    ('scarlet-kruvaze-klapa-yaka-pileli-bordo-elbise','Scarlet Kruvaze Klapa Yaka Pileli Bordo Elbise'),
    ('etoile-bros-detayli-uzun-siyah-ceket-elbise','Etoile Broş Detaylı Uzun Siyah Ceket Elbise')
  )
  SELECT count(*) INTO mismatches
  FROM expected e LEFT JOIN public.products p ON p.id=e.id
  WHERE p.id IS NULL OR p.name IS DISTINCT FROM e.name OR p.status IS DISTINCT FROM 'active'
    OR p.payment_test_only IS DISTINCT FROM false OR p.category_id IS NULL;
  IF mismatches <> 0 THEN RAISE EXCEPTION 'Made-to-order dress identity/eligibility preflight failed for % record(s)',mismatches; END IF;
END
$preflight$;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS fulfillment_mode text NOT NULL DEFAULT 'stock';
ALTER TABLE public.products ALTER COLUMN fulfillment_mode SET DEFAULT 'stock';
UPDATE public.products SET fulfillment_mode='stock' WHERE fulfillment_mode IS NULL;
ALTER TABLE public.products ALTER COLUMN fulfillment_mode SET NOT NULL;

DO $constraint$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_fulfillment_mode_check') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_fulfillment_mode_check CHECK (fulfillment_mode IN ('stock','made_to_order'));
  END IF;
  IF EXISTS (SELECT FROM public.products WHERE fulfillment_mode NOT IN ('stock','made_to_order')) THEN
    RAISE EXCEPTION 'Unexpected fulfillment_mode value';
  END IF;
END
$constraint$;

CREATE OR REPLACE FUNCTION public.nrs_is_made_to_order_dress_variant(p_product_id text,p_size text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT coalesce(p_product_id = ANY(ARRAY[
    'noir-crystal-collar-saten-elbise','burgundy-embroidered-kalem-elbise','11111222',
    'slate-cepli-dugmeli-maxi-gomlek-elbise','azure-geometrik-desenli-dugmeli-maxi-elbise',
    'noir-bros-detayli-kruvaze-uzun-elbise','noir-cicek-aplikeli-gipeli-maksi-siyah-elbise',
    'scarlet-dik-yaka-v-dekolteli-kirmizi-midi-elbise','elysian-asimetrik-yaka-drape-katmanli-kahve-midi-elbise',
    'scarlet-kruvaze-klapa-yaka-pileli-bordo-elbise','etoile-bros-detayli-uzun-siyah-ceket-elbise'
  ]::text[]),false)
  AND coalesce(p_size = ANY(ARRAY['32','34','36','38','40','42','44']::text[]),false)
$$;
REVOKE ALL ON FUNCTION public.nrs_is_made_to_order_dress_variant(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_is_made_to_order_dress_variant(text,text) TO service_role;

WITH target(id) AS (VALUES
  ('noir-crystal-collar-saten-elbise'),('burgundy-embroidered-kalem-elbise'),('11111222'),
  ('slate-cepli-dugmeli-maxi-gomlek-elbise'),('azure-geometrik-desenli-dugmeli-maxi-elbise'),
  ('noir-bros-detayli-kruvaze-uzun-elbise'),('noir-cicek-aplikeli-gipeli-maksi-siyah-elbise'),
  ('scarlet-dik-yaka-v-dekolteli-kirmizi-midi-elbise'),('elysian-asimetrik-yaka-drape-katmanli-kahve-midi-elbise'),
  ('scarlet-kruvaze-klapa-yaka-pileli-bordo-elbise'),('etoile-bros-detayli-uzun-siyah-ceket-elbise')
)
UPDATE public.products p SET fulfillment_mode='made_to_order'
FROM target t WHERE p.id=t.id;

WITH target(id) AS (VALUES
  ('noir-crystal-collar-saten-elbise'),('burgundy-embroidered-kalem-elbise'),('11111222'),
  ('slate-cepli-dugmeli-maxi-gomlek-elbise'),('azure-geometrik-desenli-dugmeli-maxi-elbise'),
  ('noir-bros-detayli-kruvaze-uzun-elbise'),('noir-cicek-aplikeli-gipeli-maksi-siyah-elbise'),
  ('scarlet-dik-yaka-v-dekolteli-kirmizi-midi-elbise'),('elysian-asimetrik-yaka-drape-katmanli-kahve-midi-elbise'),
  ('scarlet-kruvaze-klapa-yaka-pileli-bordo-elbise'),('etoile-bros-detayli-uzun-siyah-ceket-elbise')
)
UPDATE public.product_variants v SET is_active=false,updated_at=now()
FROM target t WHERE v.product_id=t.id AND (v.size IS NULL OR NOT (v.size=ANY(ARRAY['32','34','36','38','40','42','44']::text[])));

WITH target(id) AS (VALUES
  ('noir-crystal-collar-saten-elbise'),('burgundy-embroidered-kalem-elbise'),('11111222'),
  ('slate-cepli-dugmeli-maxi-gomlek-elbise'),('azure-geometrik-desenli-dugmeli-maxi-elbise'),
  ('noir-bros-detayli-kruvaze-uzun-elbise'),('noir-cicek-aplikeli-gipeli-maksi-siyah-elbise'),
  ('scarlet-dik-yaka-v-dekolteli-kirmizi-midi-elbise'),('elysian-asimetrik-yaka-drape-katmanli-kahve-midi-elbise'),
  ('scarlet-kruvaze-klapa-yaka-pileli-bordo-elbise'),('etoile-bros-detayli-uzun-siyah-ceket-elbise')
), sizes(size) AS (VALUES ('32'),('34'),('36'),('38'),('40'),('42'),('44'))
INSERT INTO public.product_variants(product_id,size,stock_quantity,is_active)
SELECT target.id,sizes.size,0,true FROM target CROSS JOIN sizes
ON CONFLICT (product_id,size) DO UPDATE SET is_active=true,updated_at=now();

DO $rpc$
DECLARE target regprocedure; definition text; updated text; expected_security boolean; matches integer; processed integer:=0;
  old_guard text; new_guard text; old_reservation text; new_reservation text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    to_regprocedure('public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'),
    to_regprocedure('public.nrs_create_manual_order(uuid,uuid,uuid,text,jsonb,jsonb,jsonb)')
  ]::regprocedure[] LOOP
    IF target IS NULL THEN CONTINUE; END IF;
    processed:=processed+1;
    SELECT pg_get_functiondef(target),p.prosecdef INTO definition,expected_security FROM pg_proc p WHERE p.oid=target;
    IF definition IS NULL THEN RAISE EXCEPTION 'Could not read order RPC definition: %',target; END IF;

    IF target='public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'::regprocedure THEN
      old_guard:='IF NOT FOUND OR variant.is_active IS DISTINCT FROM true OR variant.stock_quantity IS NULL OR variant.stock_quantity<quantity THEN RAISE EXCEPTION ''stock unavailable''; END IF;';
      new_guard:=E'IF NOT FOUND OR variant.is_active IS DISTINCT FROM true THEN RAISE EXCEPTION ''stock unavailable''; END IF;\n    IF product.fulfillment_mode=''made_to_order'' THEN\n      IF NOT public.nrs_is_made_to_order_dress_variant(product.id,variant.size) THEN RAISE EXCEPTION ''stock unavailable''; END IF;\n    ELSIF variant.stock_quantity IS NULL OR variant.stock_quantity<quantity THEN RAISE EXCEPTION ''stock unavailable''; END IF;';
      SELECT count(*) INTO matches FROM regexp_matches(definition,'IF NOT FOUND OR variant\.is_active IS DISTINCT FROM true OR variant\.stock_quantity IS NULL OR variant\.stock_quantity<quantity THEN RAISE EXCEPTION ''stock unavailable''; END IF;','g');
      IF matches<>1 THEN RAISE EXCEPTION 'Payment RPC stock guard differs from reviewed definition'; END IF;
      updated:=replace(definition,old_guard,new_guard);
      old_reservation:=E'INSERT INTO public.payment_stock_reservations(order_id,variant_id,quantity) VALUES(p_order_id,(item->>''variantId'')::uuid,(item->>''quantity'')::integer);\n    UPDATE public.product_variants SET stock_quantity=stock_quantity-(item->>''quantity'')::integer WHERE id=(item->>''variantId'')::uuid;';
      new_reservation:=E'IF product.fulfillment_mode IS DISTINCT FROM ''made_to_order'' THEN\n      INSERT INTO public.payment_stock_reservations(order_id,variant_id,quantity) VALUES(p_order_id,(item->>''variantId'')::uuid,(item->>''quantity'')::integer);\n      UPDATE public.product_variants SET stock_quantity=stock_quantity-(item->>''quantity'')::integer WHERE id=(item->>''variantId'')::uuid;\n    END IF;';
      SELECT count(*) INTO matches FROM regexp_matches(updated,'INSERT INTO public\.payment_stock_reservations\(order_id,variant_id,quantity\) VALUES\(p_order_id,\(item->>''variantId''\)::uuid,\(item->>''quantity''\)::integer\);','g');
      IF matches<>1 THEN RAISE EXCEPTION 'Payment RPC reservation point differs from reviewed definition'; END IF;
      updated:=replace(updated,old_reservation,new_reservation);
      IF updated=definition OR updated NOT LIKE '%made_to_order%' OR updated NOT LIKE '%nrs_is_made_to_order_dress_variant%' OR updated LIKE '%IF NOT FOUND OR variant.is_active IS DISTINCT FROM true OR variant.stock_quantity IS NULL OR variant.stock_quantity<quantity%' THEN
        RAISE EXCEPTION 'Payment RPC made-to-order update was incomplete';
      END IF;
    ELSE
      old_guard:='IF NOT FOUND OR variant.is_active IS DISTINCT FROM true OR variant.stock_quantity IS NULL OR variant.stock_quantity<qty THEN RAISE EXCEPTION ''variant unavailable''; END IF;';
      new_guard:=E'IF NOT FOUND OR variant.is_active IS DISTINCT FROM true THEN RAISE EXCEPTION ''variant unavailable''; END IF;\n    IF product.fulfillment_mode=''made_to_order'' THEN\n      IF NOT public.nrs_is_made_to_order_dress_variant(product.id,variant.size) THEN RAISE EXCEPTION ''variant unavailable''; END IF;\n    ELSIF variant.stock_quantity IS NULL OR variant.stock_quantity<qty THEN RAISE EXCEPTION ''variant unavailable''; END IF;';
      SELECT count(*) INTO matches FROM regexp_matches(definition,'IF NOT FOUND OR variant\.is_active IS DISTINCT FROM true OR variant\.stock_quantity IS NULL OR variant\.stock_quantity<qty THEN RAISE EXCEPTION ''variant unavailable''; END IF;','g');
      IF matches<>1 THEN RAISE EXCEPTION 'Manual RPC stock guard differs from reviewed definition'; END IF;
      updated:=replace(definition,old_guard,new_guard);
      IF updated=definition OR updated NOT LIKE '%nrs_is_made_to_order_dress_variant%' THEN RAISE EXCEPTION 'Manual RPC made-to-order update was incomplete'; END IF;
    END IF;
    EXECUTE updated;
    IF (SELECT p.prosecdef FROM pg_proc p WHERE p.oid=target) IS DISTINCT FROM expected_security THEN RAISE EXCEPTION 'Order RPC security mode changed: %',target; END IF;
  END LOOP;
  IF processed=0 THEN RAISE EXCEPTION 'No reviewed order RPC was found'; END IF;
END
$rpc$;

DO $verify$
DECLARE product_count integer; variant_count integer; open_count integer;
BEGIN
  SELECT count(*) INTO product_count FROM public.products WHERE fulfillment_mode='made_to_order'
    AND id=ANY(ARRAY['noir-crystal-collar-saten-elbise','burgundy-embroidered-kalem-elbise','11111222','slate-cepli-dugmeli-maxi-gomlek-elbise','azure-geometrik-desenli-dugmeli-maxi-elbise','noir-bros-detayli-kruvaze-uzun-elbise','noir-cicek-aplikeli-gipeli-maksi-siyah-elbise','scarlet-dik-yaka-v-dekolteli-kirmizi-midi-elbise','elysian-asimetrik-yaka-drape-katmanli-kahve-midi-elbise','scarlet-kruvaze-klapa-yaka-pileli-bordo-elbise','etoile-bros-detayli-uzun-siyah-ceket-elbise']::text[]);
  SELECT count(*) INTO variant_count FROM public.product_variants WHERE is_active AND public.nrs_is_made_to_order_dress_variant(product_id,size);
  SELECT count(*) INTO open_count FROM public.product_variants v JOIN public.products p ON p.id=v.product_id
    WHERE p.fulfillment_mode='made_to_order' AND v.is_active AND (v.stock_quantity<0 OR NOT public.nrs_is_made_to_order_dress_variant(v.product_id,v.size));
  IF product_count<>11 OR variant_count<>77 OR open_count<>0 THEN RAISE EXCEPTION 'Made-to-order catalogue verification failed: products %, numeric variants %, invalid active variants %',product_count,variant_count,open_count; END IF;
END
$verify$;

NOTIFY pgrst,'reload schema';
COMMIT;
