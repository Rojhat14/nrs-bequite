-- Optional, manually reviewed seed for the four existing src/data/products.ts
-- products. This file is NOT a migration and has NOT been executed.
-- Existing category route slugs remain canonical: dresses, tops, blazers,
-- bottoms, suits, sale. Turkish aliases (such as ust-giyim) should resolve to
-- these canonical slugs in a future storefront route change; do not duplicate
-- categories just to represent aliases.
BEGIN;

INSERT INTO public.categories (name, slug, description, sort_order, is_active)
VALUES
  ('Elbiseler', 'dresses', 'Elbise koleksiyonu.', 10, true),
  ('Üst Giyim', 'tops', 'Üst giyim koleksiyonu.', 20, true),
  ('Ceketler & Blazerlar', 'blazers', 'Ceket ve blazer koleksiyonu.', 30, true),
  ('Alt Giyim', 'bottoms', 'Alt giyim koleksiyonu.', 40, true),
  ('Takımlar', 'suits', 'Takım koleksiyonu.', 50, true),
  ('İndirim', 'sale', 'İndirimli ürünler.', 60, true),
  ('Bedding', 'bedding', 'Ev tekstili koleksiyonu.', 70, true),
  ('Aksesuar', 'accessories', 'Aksesuar koleksiyonu.', 80, true)
ON CONFLICT (slug) DO NOTHING;

-- Currency symbols/thousands separators are normalized to numeric TRY values.
-- All current products use the existing Turkish category "Üst Giyim", mapped
-- to the canonical storefront slug "tops". Existing text IDs are preserved.
INSERT INTO public.products (
  id, name, slug, category_id, description, price_amount, currency, status,
  in_stock, fabric, care
)
SELECT
  src.id,
  src.name,
  src.id,
  c.id,
  src.description,
  src.price_amount,
  'TRY',
  'active',
  src.in_stock,
  src.fabric,
  src.care
FROM (
  VALUES
    ('mavi-ceket-01', 'Mavi Işıltılı Blazer', 'Modern terziliğin zarif bir yorumu olan Mavi Işıltılı Blazer, yapılandırılmış silueti ve ışığı yakalayan dokusuyla dikkat çeker. Günlük şıklığın bir parçası olarak kullanılabileceği gibi, özel akşam görünümlerine de sofistike bir dokunuş kazandırır. Zamansız kesimi sayesinde sezonun ötesine geçen bir gardırop parçası olarak tasarlanmıştır.', 8200.00::numeric(12,2), true, 'Premium Yün Karışımı', 'Kuru Temizleme'),
    ('kirmizi-saten-01', 'Kızıl Saten Siluet', 'Işığı yüksek moda bir parıltıyla yansıtan, akışkan ve güçlü bir kadınsılık ifadesi. Modern zarafetin en cesur hali olan Kızıl Saten Siluet, her detayında lüksü hissettirir.', 5400.00::numeric(12,2), true, 'Saf Mulberry İpek Saten', 'Soğuk Elde Yıkama'),
    ('bordo-ceket-01', 'Bordo Yapılandırılmış Blazer', 'Güç ve zarafetin iddialı bir dışa vurumu. Derin bordo tonu, hassas terzilik detayları ve ışıltılı bitişiyle modern kadının gardırobunda zamansız bir imza parça.', 8500.00::numeric(12,2), true, 'Premium Yün Karışımı', 'Kuru Temizleme'),
    ('bordo-detail-01', 'Bordo Detay Parça', 'Lüksün sanatla buluştuğu noktada, bordo koleksiyonun karmaşık detaylarına odaklanan özel bir tasarım. Rafine çizgileriyle modern bir duruş sergiler.', 7900.00::numeric(12,2), true, 'Premium Yün', 'Kuru Temizleme')
) AS src(id, name, description, price_amount, in_stock, fabric, care)
JOIN public.categories AS c ON c.slug = 'tops'
ON CONFLICT (id) DO NOTHING;

-- These legacy /public paths remain URLs; no upload or Storage mutation occurs.
-- "next-public" describes the current source. The future Supabase bucket is
-- named "product-images"; storage_key is bucket-relative, e.g.
-- "{id}/main.webp", producing the full bucket/key path
-- "product-images/{id}/main.webp".
INSERT INTO public.product_images (
  product_id, provider, storage_key, url, alt_text, sort_order, is_primary
)
SELECT
  src.product_id, 'next-public', NULL, src.url, src.alt_text, src.sort_order, src.is_primary
FROM (
  VALUES
    ('mavi-ceket-01', '/images/products/tops/mavi-ceket.png', 'Mavi Işıltılı Blazer', 0, true),
    ('mavi-ceket-01', '/images/products/tops/mavi-ceket-2.png', 'Mavi Işıltılı Blazer — alternatif görünüm', 1, false),
    ('kirmizi-saten-01', '/images/products/tops/kirmizi-saten.png', 'Kızıl Saten Siluet', 0, true),
    ('bordo-ceket-01', '/images/products/tops/bordo-ceket.png', 'Bordo Yapılandırılmış Blazer', 0, true),
    ('bordo-detail-01', '/images/products/tops/ceket-kare.png', 'Bordo Detay Parça', 0, true)
) AS src(product_id, url, alt_text, sort_order, is_primary)
WHERE EXISTS (SELECT 1 FROM public.products AS p WHERE p.id = src.product_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.product_images AS existing
    WHERE existing.product_id = src.product_id
      AND existing.provider = 'next-public'
      AND existing.url = src.url
  )
  AND (
    src.is_primary = false
    OR NOT EXISTS (
      SELECT 1 FROM public.product_images AS existing_primary
      WHERE existing_primary.product_id = src.product_id
        AND existing_primary.is_primary = true
    )
  );

-- products.ts has only a boolean inStock field: it contains no sizes, SKUs,
-- or quantities. Do not invent variant stock records; seed variants only after
-- those inventory values are explicitly supplied.

COMMIT;
