-- Catalogue clean-up found while reviewing why shoppers keep asking about sizes:
-- * jumpsuits were filed under Elbiseler (and one under Takımlar);
-- * three products carry wrong or misspelt names;
-- * three products show hand-typed size labels ("Xl", "X") next to XL-style
--   labels, and one product shows an unsized "Tek beden" row next to S–XL.
-- Product IDs, variant IDs and prices are unchanged, so carts, orders, the
-- Meta catalogue and pixel content_ids keep working.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';

-- 1. Jumpsuit category, placed next to the dresses.
INSERT INTO public.categories (name, slug, description, sort_order, is_active)
SELECT 'Tulumlar', 'tulumlar',
  'Tek parçada tamamlanan görünüm. Davetten günlüğe, saten ve ipeksi dokularda tulumlar.',
  COALESCE((SELECT sort_order FROM public.categories WHERE slug = 'elbiseler'), 0), true
WHERE NOT EXISTS (SELECT FROM public.categories WHERE slug = 'tulumlar');

UPDATE public.products
SET category_id = (SELECT id FROM public.categories WHERE slug = 'tulumlar')
WHERE (id ~ '(^|-)tulum(-|$)' OR slug ~ '(^|-)tulum(-|$)')
  AND category_id IS DISTINCT FROM (SELECT id FROM public.categories WHERE slug = 'tulumlar');

-- 2. Names.
UPDATE public.products SET name = 'Sovereign Saks Mavi Takım'
WHERE id = 'sovereign-saks-mavi-blazer-ceket' AND name = 'Sovereign Saks Mavi Takımlar';
UPDATE public.products SET name = 'Scarlet Şal Astar Kırmızı Takım'
WHERE id = 'scarlet-sal-astar-kirmizi-blazer-ceket' AND name = 'Scarlet Şal Astar Kırmızı Takim';
-- This product is the petrol-blue tie-neck blouse; it was copied from the
-- violet shirt jacket and kept its name.
UPDATE public.products SET name = 'Fular Yakalı Petrol Mavisi Bluz'
WHERE id = 'violet-dokulu-gomlek-ceket-kopya' AND name = 'Violet Dokulu Gömlek Ceket';

-- 3. Size labels: "Xl" and the lone "X" (shown next to S, M, L) are XL.
UPDATE public.product_variants v SET size = 'XL'
WHERE v.size IN ('Xl', 'xl', 'X')
  AND NOT EXISTS (SELECT FROM public.product_variants o WHERE o.product_id = v.product_id AND o.size = 'XL');

-- 4. Hide an unsized row when the product also has sized rows. Deactivated,
-- not deleted, because past orders may reference it.
UPDATE public.product_variants v SET is_active = false
WHERE v.size IS NULL AND v.is_active
  AND EXISTS (SELECT FROM public.product_variants o WHERE o.product_id = v.product_id AND o.size IS NOT NULL AND o.is_active);

COMMIT;
