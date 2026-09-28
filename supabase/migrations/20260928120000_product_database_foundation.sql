-- NRS product database foundation.
-- Prepared for manual review only. This migration has NOT been applied.
-- Refuse to proceed if any target table already exists: inspect and adapt
-- instead of assuming that a missing PostgREST schema-cache entry means absent.
DO $$
BEGIN
  IF to_regclass('public.admin_users') IS NULL THEN
    RAISE EXCEPTION 'Required Phase 1 table public.admin_users is missing; review/apply its migration first.';
  END IF;

  IF to_regclass('public.categories') IS NOT NULL
     OR to_regclass('public.products') IS NOT NULL
     OR to_regclass('public.product_images') IS NOT NULL
     OR to_regclass('public.product_variants') IS NOT NULL THEN
    RAISE EXCEPTION 'A product foundation table already exists; inspect its schema and adapt this migration before applying.';
  END IF;
END;
$$;

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category_id uuid REFERENCES public.categories (id),
  description text,
  price_amount numeric(12, 2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TRY',
  compare_at_price numeric(12, 2),
  status text NOT NULL DEFAULT 'draft'
    CONSTRAINT products_status_check CHECK (status IN ('draft', 'active', 'archived')),
  in_stock boolean NOT NULL DEFAULT false,
  fabric text,
  care text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  size text,
  sku text UNIQUE,
  stock_quantity integer NOT NULL DEFAULT 0
    CONSTRAINT product_variants_stock_quantity_check CHECK (stock_quantity >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variants_product_size_key UNIQUE (product_id, size)
);

-- PostgreSQL UNIQUE permits multiple NULL values; treat the one unsized
-- variant as unique per product as well.
CREATE UNIQUE INDEX product_variants_one_null_size_per_product
  ON public.product_variants (product_id)
  WHERE size IS NULL;

CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'supabase',
  storage_key text,
  url text,
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_images_one_primary_per_product
  ON public.product_images (product_id)
  WHERE is_primary = true;

CREATE INDEX categories_active_sort_order_idx
  ON public.categories (sort_order, name)
  WHERE is_active = true;

CREATE INDEX products_active_category_idx
  ON public.products (category_id, name)
  WHERE status = 'active';

CREATE INDEX product_variants_product_active_idx
  ON public.product_variants (product_id, is_active);

CREATE INDEX product_images_product_sort_order_idx
  ON public.product_images (product_id, sort_order);

CREATE OR REPLACE FUNCTION public.nrs_set_product_catalog_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.nrs_set_product_catalog_updated_at();

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.nrs_set_product_catalog_updated_at();

CREATE TRIGGER product_variants_set_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.nrs_set_product_catalog_updated_at();

-- RLS-aware admin predicate. SECURITY DEFINER avoids recursively evaluating
-- admin_users RLS from product-table policies. The function can only report
-- whether the caller's own auth.uid() has an active admin record.
CREATE OR REPLACE FUNCTION public.nrs_is_active_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users AS au
    WHERE au.user_id = (SELECT auth.uid())
      AND au.role = 'admin'
      AND au.is_active = true
  );
$$;

REVOKE ALL ON FUNCTION public.nrs_is_active_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nrs_is_active_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.nrs_set_product_catalog_updated_at() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Public catalog reads are restricted to active categories/products. Related
-- images and variants are visible only when their parent product is active.
CREATE POLICY categories_public_read_active
  ON public.categories FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY products_public_read_active
  ON public.products FOR SELECT TO anon, authenticated
  USING (status = 'active');

CREATE POLICY product_images_public_read_active_products
  ON public.product_images FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products AS p
      WHERE p.id = product_images.product_id AND p.status = 'active'
    )
  );

CREATE POLICY product_variants_public_read_active_products
  ON public.product_variants FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products AS p
      WHERE p.id = product_variants.product_id AND p.status = 'active'
    )
  );

-- Admin policies are separate from public read policies. The admin predicate
-- is SECURITY DEFINER and does not recursively query admin_users as its caller.
CREATE POLICY categories_admin_all
  ON public.categories FOR ALL TO authenticated
  USING (public.nrs_is_active_admin())
  WITH CHECK (public.nrs_is_active_admin());

CREATE POLICY products_admin_all
  ON public.products FOR ALL TO authenticated
  USING (public.nrs_is_active_admin())
  WITH CHECK (public.nrs_is_active_admin());

CREATE POLICY product_variants_admin_all
  ON public.product_variants FOR ALL TO authenticated
  USING (public.nrs_is_active_admin())
  WITH CHECK (public.nrs_is_active_admin());

CREATE POLICY product_images_admin_all
  ON public.product_images FOR ALL TO authenticated
  USING (public.nrs_is_active_admin())
  WITH CHECK (public.nrs_is_active_admin());

-- Explicit grants keep database privileges aligned with the RLS policies.
REVOKE ALL PRIVILEGES ON TABLE
  public.categories,
  public.products,
  public.product_variants,
  public.product_images
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.categories,
  public.products,
  public.product_variants,
  public.product_images
TO anon, authenticated;

GRANT INSERT, UPDATE, DELETE ON TABLE
  public.categories,
  public.products,
  public.product_variants,
  public.product_images
TO authenticated;
