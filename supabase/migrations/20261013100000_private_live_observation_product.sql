-- One fixed, account-gated live observation item. This row is never part of
-- the public catalog, feed, sitemap, images, variants, or collections.
BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS payment_test_only boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS products_public_read_active ON public.products;
CREATE POLICY products_public_read_active
  ON public.products FOR SELECT TO anon, authenticated
  USING (status = 'active' AND payment_test_only = false);

DROP POLICY IF EXISTS product_images_public_read_active_products ON public.product_images;
CREATE POLICY product_images_public_read_active_products
  ON public.product_images FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_images.product_id AND p.status = 'active' AND p.payment_test_only = false
  ));

DROP POLICY IF EXISTS product_variants_public_read_active_products ON public.product_variants;
CREATE POLICY product_variants_public_read_active_products
  ON public.product_variants FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_variants.product_id AND p.status = 'active' AND p.payment_test_only = false
  ));

INSERT INTO public.products (id, name, slug, description, price_amount, currency, status, in_stock, payment_test_only)
VALUES ('nrs-garanti-live-3try', 'Kontrollü Ödeme Gözlem Denemesi', 'controlled-payment-observation-3try',
  'Yalnızca sunucu tarafından izinli hesaba gösterilen 3 TL canlı gözlem ürünü.', 3.00, 'TRY', 'active', true, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  price_amount = EXCLUDED.price_amount,
  currency = EXCLUDED.currency,
  status = EXCLUDED.status,
  in_stock = EXCLUDED.in_stock,
  payment_test_only = true;

INSERT INTO public.product_variants (product_id, size, sku, stock_quantity, is_active)
VALUES ('nrs-garanti-live-3try', NULL, 'NRS-GARANTI-LIVE-OBS-3TRY', 1, true)
ON CONFLICT (product_id) WHERE size IS NULL DO UPDATE SET
  sku = EXCLUDED.sku,
  is_active = true;

COMMIT;
