-- Data only: preserve existing categories, products, schema and RLS.
-- Apply through the project's authorized database migration workflow.
INSERT INTO public.categories (name, slug, description, sort_order, is_active)
SELECT
  'Dış Giyim',
  'dis-giyim',
  'Dış giyim kategorisindeki NRS tasarımlarını keşfedin.',
  COALESCE(MAX(sort_order), -1) + 1,
  true
FROM public.categories
ON CONFLICT (slug) DO NOTHING;
