-- Atomic, admin-only duplication of a product and its catalog relationships.
-- Apply after the admin, product, image and product-collection migrations.
DO $$
BEGIN
  IF to_regprocedure('public.nrs_is_active_admin()') IS NULL
     OR to_regclass('public.products') IS NULL
     OR to_regclass('public.product_variants') IS NULL
     OR to_regclass('public.product_images') IS NULL
     OR to_regclass('public.product_collections') IS NULL THEN
    RAISE EXCEPTION 'Admin and product catalog migrations must be applied before duplicate-product RPC.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.nrs_duplicate_product(p_source_product_id text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_source public.products%ROWTYPE;
  v_base_slug text;
  v_new_slug text;
  v_new_id text;
  v_suffix integer := 1;
  v_stage text := 'authorization';
  v_completed text[] := ARRAY[]::text[];
  v_error_code text;
  v_error_message text;
  v_error_detail text;
  v_error_hint text;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.nrs_is_active_admin() THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Active admin authorization required.';
  END IF;

  SELECT * INTO v_source
  FROM public.products
  WHERE id = p_source_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Source product not found.';
  END IF;

  v_base_slug := regexp_replace(lower(v_source.slug), '[^a-z0-9-]', '', 'g');
  v_base_slug := regexp_replace(v_base_slug, '-+', '-', 'g');
  v_base_slug := trim(both '-' from left(v_base_slug, 80));
  IF v_base_slug = '' THEN
    v_base_slug := 'product';
  END IF;

  v_new_slug := v_base_slug || '-kopya';
  WHILE EXISTS (
    SELECT 1 FROM public.products AS p
    WHERE p.id = v_new_slug OR p.slug = v_new_slug
  ) LOOP
    v_suffix := v_suffix + 1;
    v_new_slug := left(v_base_slug, 90 - length('-kopya-' || v_suffix::text)) || '-kopya-' || v_suffix::text;
  END LOOP;
  -- The current admin create form uses the slug as the initial TEXT product ID.
  v_new_id := v_new_slug;

  v_stage := 'products';
  INSERT INTO public.products (
    id, name, slug, category_id, description, price_amount, currency,
    compare_at_price, status, in_stock, fabric, care
  ) VALUES (
    v_new_id,
    left(v_source.name, 172) || ' KOPYASI',
    v_new_slug,
    v_source.category_id,
    v_source.description,
    v_source.price_amount,
    v_source.currency,
    v_source.compare_at_price,
    'draft',
    v_source.in_stock,
    v_source.fabric,
    v_source.care
  );
  v_completed := array_append(v_completed, 'products');

  v_stage := 'variants';
  INSERT INTO public.product_variants (
    id, product_id, size, sku, stock_quantity, is_active
  )
  SELECT
    gen_random_uuid(),
    v_new_id,
    variant.size,
    CASE WHEN variant.sku IS NULL THEN NULL
      ELSE variant.sku || '-COPY-' || replace(gen_random_uuid()::text, '-', '')
    END,
    variant.stock_quantity,
    variant.is_active
  FROM public.product_variants AS variant
  WHERE variant.product_id = p_source_product_id;
  v_completed := array_append(v_completed, 'variants');

  v_stage := 'images';
  INSERT INTO public.product_images (
    id, product_id, provider, storage_key, url, alt_text, sort_order, is_primary
  )
  SELECT
    gen_random_uuid(),
    v_new_id,
    image.provider,
    image.storage_key,
    image.url,
    image.alt_text,
    image.sort_order,
    image.is_primary
  FROM public.product_images AS image
  WHERE image.product_id = p_source_product_id;
  v_completed := array_append(v_completed, 'images');

  v_stage := 'collections';
  INSERT INTO public.product_collections (product_id, collection_id)
  SELECT v_new_id, relation.collection_id
  FROM public.product_collections AS relation
  WHERE relation.product_id = p_source_product_id;
  v_completed := array_append(v_completed, 'collections');

  RETURN jsonb_build_object(
    'id', v_new_id,
    'slug', v_new_slug,
    'stages', to_jsonb(v_completed)
  );
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS
    v_error_code = RETURNED_SQLSTATE,
    v_error_message = MESSAGE_TEXT,
    v_error_detail = PG_EXCEPTION_DETAIL,
    v_error_hint = PG_EXCEPTION_HINT;
  RAISE LOG '[DUPLICATE PRODUCT] %: ERROR code=% message=% details=% hint=% completed=%',
    v_stage,
    v_error_code,
    v_error_message,
    coalesce(v_error_detail, ''),
    coalesce(v_error_hint, ''),
    array_to_string(v_completed, ',');
  RAISE EXCEPTION USING
    ERRCODE = v_error_code,
    MESSAGE = format('[DUPLICATE PRODUCT] %s: ERROR: %s', v_stage, v_error_message),
    DETAIL = format('Original details: %s. Completed stages: %s.', coalesce(v_error_detail, 'none'), array_to_string(v_completed, ', ')),
    HINT = v_error_hint;
END;
$$;

REVOKE ALL ON FUNCTION public.nrs_duplicate_product(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nrs_duplicate_product(text) TO authenticated;
