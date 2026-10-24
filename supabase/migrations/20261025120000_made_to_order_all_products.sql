-- Every catalogue product is made to order: stock counts no longer limit
-- sales. The order RPCs already skip the stock check and stock reservation for
-- fulfillment_mode='made_to_order' (20261019130000), so this widens that mode
-- to every sale-open product instead of rewriting the reviewed RPCs again.
-- The eleven numeric-size dresses keep their 32-44 size restriction. Payment
-- test products stay in stock mode so the controlled Garanti slots are
-- unchanged.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
  IF to_regprocedure('public.nrs_is_made_to_order_dress_variant(text,text)') IS NULL
    OR NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.products'::regclass AND conname='products_fulfillment_mode_check') THEN
    RAISE EXCEPTION 'Made-to-order foundation (20261019130000) is missing';
  END IF;
  IF to_regprocedure('public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)') IS NOT NULL
    AND pg_get_functiondef('public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'::regprocedure) NOT LIKE '%IF product.fulfillment_mode IS DISTINCT FROM ''made_to_order'' THEN%' THEN
    RAISE EXCEPTION 'Payment RPC does not skip reservations for made-to-order products';
  END IF;
END
$preflight$;

CREATE OR REPLACE FUNCTION public.nrs_is_made_to_order_dress_variant(p_product_id text,p_size text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT FROM public.products p
    WHERE p.id = p_product_id AND p.fulfillment_mode = 'made_to_order'
      AND p.payment_test_only IS DISTINCT FROM true
  )
  AND (
    NOT coalesce(p_product_id = ANY(ARRAY[
      'noir-crystal-collar-saten-elbise','burgundy-embroidered-kalem-elbise','11111222',
      'slate-cepli-dugmeli-maxi-gomlek-elbise','azure-geometrik-desenli-dugmeli-maxi-elbise',
      'noir-bros-detayli-kruvaze-uzun-elbise','noir-cicek-aplikeli-gipeli-maksi-siyah-elbise',
      'scarlet-dik-yaka-v-dekolteli-kirmizi-midi-elbise','elysian-asimetrik-yaka-drape-katmanli-kahve-midi-elbise',
      'scarlet-kruvaze-klapa-yaka-pileli-bordo-elbise','etoile-bros-detayli-uzun-siyah-ceket-elbise'
    ]::text[]),false)
    OR coalesce(p_size = ANY(ARRAY['32','34','36','38','40','42','44']::text[]),false)
  )
$$;
REVOKE ALL ON FUNCTION public.nrs_is_made_to_order_dress_variant(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_is_made_to_order_dress_variant(text,text) TO service_role;

-- New products (admin form, duplicate RPC) are made to order by default.
ALTER TABLE public.products ALTER COLUMN fulfillment_mode SET DEFAULT 'made_to_order';
UPDATE public.products SET fulfillment_mode='made_to_order', in_stock=true
WHERE payment_test_only IS DISTINCT FROM true
  AND (fulfillment_mode IS DISTINCT FROM 'made_to_order' OR in_stock IS DISTINCT FROM true);

DO $verify$
DECLARE remaining integer;
BEGIN
  SELECT count(*) INTO remaining FROM public.products
  WHERE payment_test_only IS DISTINCT FROM true AND (fulfillment_mode<>'made_to_order' OR NOT in_stock);
  IF remaining<>0 THEN RAISE EXCEPTION 'Made-to-order catalogue update incomplete: % product(s)',remaining; END IF;
END
$verify$;

NOTIFY pgrst,'reload schema';
COMMIT;
