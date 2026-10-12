
-- TEST ONLY: dzuxhwtbuojnhibzfxqy. Never apply to NRS Production.
-- Run once against an empty application schema; no orders/auth users are seeded.
BEGIN;
SET LOCAL nrs.test_project_ref = 'dzuxhwtbuojnhibzfxqy';
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF current_setting('nrs.test_project_ref',true) IS DISTINCT FROM 'dzuxhwtbuojnhibzfxqy' THEN RAISE EXCEPTION 'Wrong test project'; END IF;
 IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN('r','p')) THEN RAISE EXCEPTION 'Test bootstrap requires empty public schema; existing/live database refused'; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role' AND rolbypassrls)
  OR to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN RAISE EXCEPTION 'Supabase role/auth prerequisites missing'; END IF;
END $$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
-- Admin access registry. This migration is prepared but must be reviewed and
-- applied manually. It deliberately creates no administrator records.
CREATE TABLE public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Clients may only read their own active admin record. No client write grants
-- or write policies are provided; administrator provisioning is a trusted,
-- manual database operation.
REVOKE ALL PRIVILEGES ON TABLE public.admin_users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_users TO authenticated;

CREATE POLICY admin_users_read_own_active
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND role = 'admin'
    AND is_active = true
  );
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

CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 first_name text,last_name text,phone text,email text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.wishlist(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,product_id));
CREATE TABLE public.orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),
 total_amount numeric NOT NULL CHECK(total_amount>0),status text DEFAULT 'pending' NOT NULL
 CHECK(status IN('pending','payment_pending','paid','processing','shipped','delivered','cancelled','refunded')),
 customer_name text,customer_email text,customer_phone text,shipping_address text,shipping_city text,
 shipping_district text,shipping_postal_code text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.order_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.orders(id),
 product_id text NOT NULL REFERENCES public.products(id),quantity integer NOT NULL CHECK(quantity>0),price_at_purchase numeric NOT NULL CHECK(price_at_purchase>0));
CREATE TABLE public.collections(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,slug text NOT NULL UNIQUE,
 description text,image_url text,is_active boolean NOT NULL DEFAULT true,sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.product_collections(product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
 collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,PRIMARY KEY(product_id,collection_id));
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles,public.wishlist,public.orders,public.order_items,public.collections,public.product_collections FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.categories,public.products,public.product_variants,public.product_images,
 public.collections,public.product_collections,public.profiles,public.wishlist,public.orders,public.order_items TO service_role;
GRANT SELECT ON public.admin_users TO service_role;

-- Reuse reviewed migration: 20260928130000_admin_panel_access.sql
-- Additive admin read access for existing customer/order tables plus a narrow
-- server RPC for operational order status changes. Existing policies are kept.
DO $$
BEGIN
  IF to_regclass('public.admin_users') IS NULL
     OR to_regprocedure('public.nrs_is_active_admin()') IS NULL THEN
    RAISE EXCEPTION 'Apply the admin and product foundation migrations before this migration.';
  END IF;
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.wishlist') IS NULL
     OR to_regclass('public.orders') IS NULL
     OR to_regclass('public.order_items') IS NULL THEN
    RAISE EXCEPTION 'An expected existing NRS customer/order table is missing; inspect live schema before continuing.';
  END IF;
END;
$$;

-- These are permissive SELECT policies restricted to active admins. They do
-- not remove or rewrite existing customer policies and grant no write access.
CREATE POLICY nrs_admin_panel_profiles_read
  ON public.profiles FOR SELECT TO authenticated
  USING (public.nrs_is_active_admin());

CREATE POLICY nrs_admin_panel_wishlist_read
  ON public.wishlist FOR SELECT TO authenticated
  USING (public.nrs_is_active_admin());

CREATE POLICY nrs_admin_panel_orders_read
  ON public.orders FOR SELECT TO authenticated
  USING (public.nrs_is_active_admin());

CREATE POLICY nrs_admin_panel_order_items_read
  ON public.order_items FOR SELECT TO authenticated
  USING (public.nrs_is_active_admin());

-- Admins may update only operational status via this function. In particular,
-- 'paid' remains exclusively controlled by the payment callback/provider.
CREATE OR REPLACE FUNCTION public.nrs_admin_update_order_status(p_order_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_status text;
BEGIN
  IF NOT public.nrs_is_active_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('pending', 'payment_pending', 'processing', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported operational order status' USING ERRCODE = '22023';
  END IF;

  SELECT o.status INTO current_status
  FROM public.orders AS o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;

  -- This legacy schema stores payment and fulfillment state in one column.
  -- Do not overwrite a payment result or advance an unpaid order to fulfillment.
  IF current_status IN ('paid', 'refunded') THEN
    RAISE EXCEPTION 'payment state cannot be replaced by an operational status' USING ERRCODE = '22023';
  END IF;
  IF current_status IN ('pending', 'payment_pending') AND p_status <> 'cancelled' THEN
    RAISE EXCEPTION 'unpaid order cannot advance to fulfillment' USING ERRCODE = '22023';
  END IF;
  IF current_status = 'processing' AND p_status NOT IN ('shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported fulfillment transition' USING ERRCODE = '22023';
  END IF;
  IF current_status = 'shipped' AND p_status NOT IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported fulfillment transition' USING ERRCODE = '22023';
  END IF;
  IF current_status NOT IN ('pending', 'payment_pending', 'processing', 'shipped') THEN
    RAISE EXCEPTION 'current order status is not editable in admin' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET status = p_status
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.nrs_admin_update_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nrs_admin_update_order_status(uuid, text) TO authenticated;

-- Aggregate customer totals without exposing Auth Admin API or returning an
-- unbounded order/wishlist result to the browser.
CREATE OR REPLACE FUNCTION public.nrs_admin_user_summary(p_user_id uuid)
RETURNS TABLE(order_count bigint, total_order_amount numeric, favorite_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.nrs_is_active_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.orders AS o WHERE o.user_id = p_user_id),
    (SELECT coalesce(sum(o.total_amount), 0) FROM public.orders AS o WHERE o.user_id = p_user_id),
    (SELECT count(*) FROM public.wishlist AS w WHERE w.user_id = p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.nrs_admin_user_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nrs_admin_user_summary(uuid) TO authenticated;


-- Reuse reviewed migration: 20260928150000_collections_product_collections.sql
-- Complete RLS for the pre-existing NRS collection tables.
-- This migration does not create/drop tables, constraints, or data.
-- Safe to run more than once; policies are added only when absent.
DO $$
BEGIN
  IF to_regclass('public.collections') IS NULL
     OR to_regclass('public.product_collections') IS NULL
     OR to_regclass('public.products') IS NULL
     OR to_regprocedure('public.nrs_is_active_admin()') IS NULL THEN
    RAISE EXCEPTION 'Expected collection/product tables and nrs_is_active_admin() must exist before applying collection RLS.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.collections'::regclass AND attname = 'is_active' AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.product_collections'::regclass AND attname = 'product_id' AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.product_collections'::regclass AND attname = 'collection_id' AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = 'public.products'::regclass AND attname = 'status' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'Collection tables are present but do not have the columns required by collection RLS.';
  END IF;

  -- Validate the existing cascade relationships independent of their names.
  -- Existing constraints are never dropped or recreated by this migration.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS fk
    WHERE fk.conrelid = 'public.product_collections'::regclass
      AND fk.confrelid = 'public.products'::regclass
      AND fk.contype = 'f'
      AND fk.confdeltype = 'c'
      AND fk.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.product_collections'::regclass AND attname = 'product_id' AND NOT attisdropped)]::smallint[]
      AND fk.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.products'::regclass AND attname = 'id' AND NOT attisdropped)]::smallint[]
  ) THEN
    RAISE EXCEPTION 'Expected product_collections.product_id -> products.id ON DELETE CASCADE foreign key is missing; inspect schema before applying.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint AS fk
    WHERE fk.conrelid = 'public.product_collections'::regclass
      AND fk.confrelid = 'public.collections'::regclass
      AND fk.contype = 'f'
      AND fk.confdeltype = 'c'
      AND fk.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.product_collections'::regclass AND attname = 'collection_id' AND NOT attisdropped)]::smallint[]
      AND fk.confkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.collections'::regclass AND attname = 'id' AND NOT attisdropped)]::smallint[]
  ) THEN
    RAISE EXCEPTION 'Expected product_collections.collection_id -> collections.id ON DELETE CASCADE foreign key is missing; inspect schema before applying.';
  END IF;
END;
$$;

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Permissive policies provide the intended read/admin grants. The
  -- restrictive policies below also cap any older permissive policies, whose
  -- USING clauses would otherwise combine with these policies using OR.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'collections'
      AND policyname = 'collections_public_read_active'
  ) THEN
    CREATE POLICY collections_public_read_active
      ON public.collections FOR SELECT TO anon, authenticated
      USING (is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'collections'
      AND policyname = 'collections_admin_all'
  ) THEN
    CREATE POLICY collections_admin_all
      ON public.collections FOR ALL TO authenticated
      USING (public.nrs_is_active_admin())
      WITH CHECK (public.nrs_is_active_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_collections'
      AND policyname = 'product_collections_public_read_active'
  ) THEN
    CREATE POLICY product_collections_public_read_active
      ON public.product_collections FOR SELECT TO anon, authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.products AS p
          WHERE p.id = product_collections.product_id AND p.status = 'active'
        )
        AND EXISTS (
          SELECT 1 FROM public.collections AS c
          WHERE c.id = product_collections.collection_id AND c.is_active = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_collections'
      AND policyname = 'product_collections_admin_all'
  ) THEN
    CREATE POLICY product_collections_admin_all
      ON public.product_collections FOR ALL TO authenticated
      USING (public.nrs_is_active_admin())
      WITH CHECK (public.nrs_is_active_admin());
  END IF;

  -- SELECT gates let active public catalog reads through while allowing
  -- admins to read inactive rows. DML gates require active admin authorization
  -- even if an older permissive policy was broader.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'collections'
      AND policyname = 'nrs_collections_anon_select_guard'
  ) THEN
    CREATE POLICY nrs_collections_anon_select_guard
      ON public.collections AS RESTRICTIVE FOR SELECT TO anon
      USING (is_active = true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'collections'
      AND policyname = 'nrs_collections_authenticated_select_guard'
  ) THEN
    CREATE POLICY nrs_collections_authenticated_select_guard
      ON public.collections AS RESTRICTIVE FOR SELECT TO authenticated
      USING (public.nrs_is_active_admin() OR is_active = true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'collections'
      AND policyname = 'nrs_collections_authenticated_insert_guard'
  ) THEN
    CREATE POLICY nrs_collections_authenticated_insert_guard
      ON public.collections AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK (public.nrs_is_active_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'collections'
      AND policyname = 'nrs_collections_authenticated_update_guard'
  ) THEN
    CREATE POLICY nrs_collections_authenticated_update_guard
      ON public.collections AS RESTRICTIVE FOR UPDATE TO authenticated
      USING (public.nrs_is_active_admin())
      WITH CHECK (public.nrs_is_active_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'collections'
      AND policyname = 'nrs_collections_authenticated_delete_guard'
  ) THEN
    CREATE POLICY nrs_collections_authenticated_delete_guard
      ON public.collections AS RESTRICTIVE FOR DELETE TO authenticated
      USING (public.nrs_is_active_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'collections'
      AND policyname = 'nrs_collections_anon_insert_guard'
  ) THEN
    CREATE POLICY nrs_collections_anon_insert_guard
      ON public.collections AS RESTRICTIVE FOR INSERT TO anon
      WITH CHECK (false);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'collections'
      AND policyname = 'nrs_collections_anon_update_guard'
  ) THEN
    CREATE POLICY nrs_collections_anon_update_guard
      ON public.collections AS RESTRICTIVE FOR UPDATE TO anon
      USING (false)
      WITH CHECK (false);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'collections'
      AND policyname = 'nrs_collections_anon_delete_guard'
  ) THEN
    CREATE POLICY nrs_collections_anon_delete_guard
      ON public.collections AS RESTRICTIVE FOR DELETE TO anon
      USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_collections'
      AND policyname = 'nrs_product_collections_anon_select_guard'
  ) THEN
    CREATE POLICY nrs_product_collections_anon_select_guard
      ON public.product_collections AS RESTRICTIVE FOR SELECT TO anon
      USING (
        EXISTS (
          SELECT 1 FROM public.products AS p
          WHERE p.id = product_collections.product_id AND p.status = 'active'
        )
        AND EXISTS (
          SELECT 1 FROM public.collections AS c
          WHERE c.id = product_collections.collection_id AND c.is_active = true
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_collections'
      AND policyname = 'nrs_product_collections_authenticated_select_guard'
  ) THEN
    CREATE POLICY nrs_product_collections_authenticated_select_guard
      ON public.product_collections AS RESTRICTIVE FOR SELECT TO authenticated
      USING (
        public.nrs_is_active_admin()
        OR (
          EXISTS (
            SELECT 1 FROM public.products AS p
            WHERE p.id = product_collections.product_id AND p.status = 'active'
          )
          AND EXISTS (
            SELECT 1 FROM public.collections AS c
            WHERE c.id = product_collections.collection_id AND c.is_active = true
          )
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_collections'
      AND policyname = 'nrs_product_collections_authenticated_insert_guard'
  ) THEN
    CREATE POLICY nrs_product_collections_authenticated_insert_guard
      ON public.product_collections AS RESTRICTIVE FOR INSERT TO authenticated
      WITH CHECK (public.nrs_is_active_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_collections'
      AND policyname = 'nrs_product_collections_authenticated_update_guard'
  ) THEN
    CREATE POLICY nrs_product_collections_authenticated_update_guard
      ON public.product_collections AS RESTRICTIVE FOR UPDATE TO authenticated
      USING (public.nrs_is_active_admin())
      WITH CHECK (public.nrs_is_active_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_collections'
      AND policyname = 'nrs_product_collections_authenticated_delete_guard'
  ) THEN
    CREATE POLICY nrs_product_collections_authenticated_delete_guard
      ON public.product_collections AS RESTRICTIVE FOR DELETE TO authenticated
      USING (public.nrs_is_active_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_collections'
      AND policyname = 'nrs_product_collections_anon_insert_guard'
  ) THEN
    CREATE POLICY nrs_product_collections_anon_insert_guard
      ON public.product_collections AS RESTRICTIVE FOR INSERT TO anon
      WITH CHECK (false);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_collections'
      AND policyname = 'nrs_product_collections_anon_update_guard'
  ) THEN
    CREATE POLICY nrs_product_collections_anon_update_guard
      ON public.product_collections AS RESTRICTIVE FOR UPDATE TO anon
      USING (false)
      WITH CHECK (false);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'product_collections'
      AND policyname = 'nrs_product_collections_anon_delete_guard'
  ) THEN
    CREATE POLICY nrs_product_collections_anon_delete_guard
      ON public.product_collections AS RESTRICTIVE FOR DELETE TO anon
      USING (false);
  END IF;
END;
$$;

GRANT SELECT ON TABLE public.collections, public.product_collections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.collections, public.product_collections TO authenticated;


-- Reuse reviewed migration: 20261009120000_order_access_hardening.sql
-- LOCAL REVIEW ONLY: never apply automatically to production.
-- First customer-security stage: closes orders/items/profiles/wishlist together.
-- Run ONCE before payment/legal migrations and final reconciliation.
-- Reviewed legacy admin RPC is upgraded with an order-row lock; data is preserved.
-- Browser writes are unsupported: audited checkout writes via service-only RPC;
-- WhatsApp sends a request, admin status edits use the existing secured RPC.

SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE r record; t text; history text; already_applied boolean;
BEGIN
  IF to_regprocedure('public.nrs_is_active_admin()') IS NULL OR to_regprocedure('public.nrs_admin_update_order_status(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Existing active-admin authorization is required';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_proc WHERE oid='public.nrs_is_active_admin()'::regprocedure AND prosecdef AND prorettype='boolean'::regtype) THEN
    RAISE EXCEPTION 'Review existing admin predicate before proceeding';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('orders','id','uuid'),('orders','user_id','uuid'),('order_items','order_id','uuid')) AS required(t,c,typ) LOOP
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name=r.t AND column_name=r.c AND udt_name=r.typ) THEN
      RAISE EXCEPTION 'Schema mismatch: %.%',r.t,r.c;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.orders'::regclass AND contype='p' AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.orders'::regclass AND attname='id')])
    OR NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.order_items'::regclass AND confrelid='public.orders'::regclass AND contype='f' AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.order_items'::regclass AND attname='order_id')]) THEN
    RAISE EXCEPTION 'Review order primary key / item foreign key';
  END IF;
  IF EXISTS (SELECT FROM pg_policy WHERE polrelid='public.orders'::regclass AND polname='nrs_customer_order_read') THEN
    RAISE EXCEPTION 'Already hardened: inspect migration history rather than rerunning';
  END IF;
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
    AND table_name='orders' AND column_name='user_id' AND is_nullable='YES')
    OR NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
    AND table_name='orders' AND column_name='user_id' AND is_nullable='NO') THEN
    RAISE EXCEPTION 'STOP: preserve existing orders.user_id NOT NULL; no ownership conversion authorized';
  END IF;
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    EXECUTE 'SELECT string_agg(version::text,'','' ORDER BY version) FROM supabase_migrations.schema_migrations'
      INTO history;
    RAISE NOTICE 'Existing migration versions (not modified): %',coalesce(history,'<empty>');
    EXECUTE 'SELECT EXISTS (SELECT FROM supabase_migrations.schema_migrations WHERE version::text=''20261009120000'')' INTO already_applied;
    IF already_applied THEN
      RAISE EXCEPTION 'STOP: order-access migration already recorded; no replay or history repair authorized';
    END IF;
  ELSE
    RAISE NOTICE 'Migration history absent: no prior migration application inferred or replayed';
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication))
    OR EXISTS (SELECT FROM pg_auth_members m JOIN pg_roles role ON role.oid=m.member
      WHERE role.rolname IN ('anon','authenticated')) THEN
    RAISE EXCEPTION 'STOP: unexpected browser role capabilities/membership; no role changes authorized';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role' AND rolbypassrls)
    OR pg_has_role('service_role','anon','MEMBER')
    OR pg_has_role('service_role','authenticated','MEMBER')
    OR NOT has_schema_privilege('anon','public','USAGE')
    OR NOT has_schema_privilege('authenticated','public','USAGE')
    OR has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE') THEN
    RAISE EXCEPTION 'STOP: unexpected service_role or public-schema CREATE capability';
  END IF;
  FOR r IN SELECT c.relname,pg_get_userbyid(c.relowner) owner FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    AND c.relname IN ('orders','order_items','profiles','wishlist','admin_users') LOOP
    IF r.owner IN ('anon','authenticated','service_role') THEN
      RAISE EXCEPTION 'STOP: unexpected table owner on %',r.relname;
    END IF;
  END LOOP;
  -- Do not silently remove service_role capabilities inherited from PUBLIC.
  FOR r IN SELECT c.relname,a.privilege_type FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    WHERE n.nspname='public' AND c.relname IN ('orders','order_items','profiles','wishlist') AND a.grantee=0 LOOP
    IF NOT EXISTS (SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid=format('public.%I',r.relname)::regclass AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname='service_role')
      AND a.privilege_type=r.privilege_type) THEN
      RAISE EXCEPTION 'STOP: service_role may depend on PUBLIC %.% grant; no service grant change authorized',r.relname,r.privilege_type;
    END IF;
  END LOOP;
  FOR r IN SELECT c.relname,col.attname,a.privilege_type FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute col ON col.attrelid=c.oid AND col.attnum>0 AND NOT col.attisdropped
    CROSS JOIN LATERAL aclexplode(col.attacl) a WHERE n.nspname='public'
    AND c.relname IN ('orders','order_items','profiles','wishlist') AND a.grantee=0 LOOP
    IF NOT has_table_privilege('service_role','public.'||r.relname,r.privilege_type)
      AND NOT EXISTS (SELECT FROM pg_attribute col CROSS JOIN LATERAL aclexplode(col.attacl) a
        WHERE col.attrelid=format('public.%I',r.relname)::regclass AND col.attname=r.attname
        AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname='service_role') AND a.privilege_type=r.privilege_type) THEN
      RAISE EXCEPTION 'STOP: service_role may depend on PUBLIC column %.% grant',r.relname,r.attname;
    END IF;
  END LOOP;
  -- Check the column before pg_get_serial_sequence: an absent id must hit
  -- the explicit schema guard rather than raising an incidental catalog error.
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
    AND table_name='wishlist' AND column_name='id') THEN
    RAISE EXCEPTION 'STOP: Expected existing wishlist.id';
  END IF;
  t:=pg_get_serial_sequence('public.wishlist','id');
  IF t IS NOT NULL AND EXISTS (SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid=t::regclass AND a.grantee=0) THEN
    RAISE EXCEPTION 'STOP: unreviewed PUBLIC wishlist sequence grant; preserve service access';
  END IF;
  IF to_regclass('public.admin_users') IS NULL THEN RAISE EXCEPTION 'STOP: admin registry absent'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.admin_users'::regclass) THEN
    RAISE EXCEPTION 'STOP: admin registry RLS disabled; no admin changes authorized';
  END IF;
  FOR r IN SELECT attname,attnum FROM pg_attribute WHERE attrelid='public.admin_users'::regclass AND attnum>0 AND NOT attisdropped LOOP
    IF has_column_privilege('anon','public.admin_users',r.attname,'INSERT')
      OR has_column_privilege('anon','public.admin_users',r.attname,'UPDATE')
      OR has_column_privilege('authenticated','public.admin_users',r.attname,'INSERT')
      OR has_column_privilege('authenticated','public.admin_users',r.attname,'UPDATE') THEN
      RAISE EXCEPTION 'STOP: unexpected admin registry write permission on %',r.attname;
    END IF;
  END LOOP;
  IF has_table_privilege('anon','public.admin_users','DELETE,TRUNCATE,TRIGGER')
    OR has_table_privilege('authenticated','public.admin_users','DELETE,TRUNCATE,TRIGGER') THEN
    RAISE EXCEPTION 'STOP: unexpected admin registry destructive permission';
  END IF;
  -- Reviewed exact bodies: supplied live definition and repository legacy source.
  -- Neither whitespace normalization nor a name-only exemption is permitted.
  IF NOT EXISTS (SELECT FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
    WHERE p.oid=to_regprocedure('public.nrs_admin_update_order_status(uuid,text)')
      AND p.prosecdef AND p.prokind='f' AND p.prorettype='void'::regtype
      AND l.lanname='plpgsql' AND p.proconfig=ARRAY['search_path=""']::text[]
      AND pg_get_userbyid(p.proowner) NOT IN ('anon','authenticated','service_role')
      AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') IN ('f720fc61d713e618135b9646a4d31588bf8e1f87a2895240f642d1a97cbc1d7d','c1ece8f8401ea641f9e6b716df1eb69db8ce4fb8b7975c7c49a87cb13095bf9c'))
    OR has_function_privilege('anon','public.nrs_admin_update_order_status(uuid,text)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.nrs_admin_update_order_status(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'STOP: unreviewed legacy admin RPC definition/owner/ACL; preserve and review';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
    WHERE p.oid=to_regprocedure('public.nrs_is_active_admin()') AND p.prosecdef
      AND p.prokind='f' AND p.prorettype='boolean'::regtype AND l.lanname='sql'
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND pg_get_userbyid(p.proowner) NOT IN ('anon','authenticated','service_role')
      AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='b13925b08fe9c02ca430c6f941888aa9aee3f97466a2a37bb5a28140ded5ba80')
    OR has_function_privilege('anon','public.nrs_is_active_admin()','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.nrs_is_active_admin()','EXECUTE') THEN
    RAISE EXCEPTION 'STOP: unreviewed active-admin predicate definition/owner/ACL';
  END IF;
  -- Permissive policies combine with OR; leaving any old broad policy defeats
  -- new owner checks. Record metadata in deployment logs before replacing them.
  FOR r IN SELECT tablename,policyname,cmd,roles,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN ('orders','order_items') LOOP
    RAISE NOTICE 'Replacing policy %.% command=% roles=% USING=% CHECK=%',r.tablename,r.policyname,r.cmd,r.roles,r.qual,r.with_check;
    EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,r.tablename);
  END LOOP;
END $$;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orders,public.order_items FROM PUBLIC,anon,authenticated;
-- Column grants are independent of table grants and must also be removed.
DO $$ DECLARE t text; columns text; BEGIN
  FOREACH t IN ARRAY ARRAY['orders','order_items'] LOOP
    SELECT string_agg(quote_ident(attname),',') INTO columns FROM pg_attribute WHERE attrelid=format('public.%I',t)::regclass AND attnum>0 AND NOT attisdropped;
    EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.%I FROM PUBLIC,anon,authenticated',columns,columns,columns,columns,t);
  END LOOP;
END $$;
GRANT SELECT ON public.orders,public.order_items TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.orders,public.order_items TO service_role;
CREATE POLICY nrs_customer_order_read ON public.orders FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_active_admin_order_read ON public.orders FOR SELECT TO authenticated USING ((SELECT public.nrs_is_active_admin()));
CREATE POLICY nrs_customer_order_item_read ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.user_id=(SELECT auth.uid())));
CREATE POLICY nrs_active_admin_order_item_read ON public.order_items FOR SELECT TO authenticated USING ((SELECT public.nrs_is_active_admin()));
-- Serialize admin status edits with payment finalization; otherwise an old
-- pending read can overwrite a paid result after waiting for a row lock.
CREATE OR REPLACE FUNCTION public.nrs_admin_update_order_status(p_order_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_status text;
BEGIN
  IF public.nrs_is_active_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('pending', 'payment_pending', 'processing', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported operational order status' USING ERRCODE = '22023';
  END IF;

  SELECT o.status INTO current_status
  FROM public.orders AS o
  WHERE o.id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;

  IF current_status IS NULL OR current_status NOT IN
    ('pending','payment_pending','paid','processing','shipped','delivered','cancelled','refunded') THEN
    RAISE EXCEPTION 'unknown current order status; manual review required' USING ERRCODE='22023';
  END IF;

  -- This legacy schema stores payment and fulfillment state in one column.
  -- Do not overwrite a payment result or advance an unpaid order to fulfillment.
  IF current_status IN ('paid', 'refunded') THEN
    RAISE EXCEPTION 'payment state cannot be replaced by an operational status' USING ERRCODE = '22023';
  END IF;
  IF current_status IN ('pending', 'payment_pending') AND p_status <> 'cancelled' THEN
    RAISE EXCEPTION 'unpaid order cannot advance to fulfillment' USING ERRCODE = '22023';
  END IF;
  IF current_status = 'processing' AND p_status NOT IN ('shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported fulfillment transition' USING ERRCODE = '22023';
  END IF;
  IF current_status = 'shipped' AND p_status NOT IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported fulfillment transition' USING ERRCODE = '22023';
  END IF;
  IF current_status NOT IN ('pending', 'payment_pending', 'processing', 'shipped') THEN
    RAISE EXCEPTION 'current order status is not editable in admin' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET status = p_status
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.nrs_admin_update_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nrs_admin_update_order_status(uuid, text) TO authenticated;


-- Close all four customer-table ACL/RLS gaps in this first transaction.
DO $$
DECLARE r record; t text; cols text;
BEGIN
  IF NOT EXISTS (SELECT FROM pg_proc WHERE oid=to_regprocedure('public.nrs_is_active_admin()')
    AND prosecdef AND prorettype='boolean'::regtype) THEN
    RAISE EXCEPTION 'Review existing active-admin predicate first';
  END IF;
  -- This early stage requires the newly locked, reviewed order RPC;
  -- payment prerequisites remain in the unchanged final customer migration.
  IF NOT EXISTS (SELECT FROM pg_proc WHERE oid=to_regprocedure('public.nrs_admin_update_order_status(uuid,text)')
    AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='c10311b6c4f4647b3e09934d9807c73808b598e1b49cc7520d108f5a13d98ac5') THEN
    RAISE EXCEPTION 'STOP: early customer reconciliation requires reviewed locked order RPC';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('profiles','id','uuid'),('wishlist','user_id','uuid'),
    ('wishlist','product_id','text'),('orders','id','uuid'),('orders','user_id','uuid'),
    ('order_items','order_id','uuid')) required(t,c,typ) LOOP
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
      AND table_name=r.t AND column_name=r.c AND udt_name=r.typ AND domain_name IS NULL) THEN
      RAISE EXCEPTION 'Customer schema mismatch: %.%',r.t,r.c;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
    AND table_name='wishlist' AND column_name='id') THEN
    RAISE EXCEPTION 'Expected existing wishlist.id';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('first_name'),('last_name'),('phone'),('email')) required(c) LOOP
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
      AND table_name='profiles' AND column_name=r.c AND data_type IN ('text','character varying')
      AND domain_name IS NULL) THEN RAISE EXCEPTION 'Review profile field %',r.c; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.profiles'::regclass AND contype='p'
    AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attname='id')]) THEN
    RAISE EXCEPTION 'Expected profiles.id primary key for existing signup upsert';
  END IF;
  -- Do not invent defaults, change IDs, or repair existing legacy rows.
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
    AND table_name IN ('profiles','wishlist') AND is_nullable='NO' AND column_default IS NULL
    AND is_identity='NO' AND is_generated='NEVER' AND NOT (
      (table_name='profiles' AND column_name IN ('id','first_name','last_name','phone','email')) OR
      (table_name='wishlist' AND column_name IN ('user_id','product_id')))) THEN
    RAISE EXCEPTION 'Required customer column without default: review existing insert compatibility';
  END IF;
  FOREACH t IN ARRAY ARRAY['profiles','wishlist','orders','order_items'] LOOP
    -- Permissive policies OR together: remove old public ALL/true policies too.
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      RAISE NOTICE 'Replacing policy %.%',t,r.policyname;
      EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_attribute
      WHERE attrelid=format('public.%I',t)::regclass AND attnum>0 AND NOT attisdropped;
    EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.%I FROM PUBLIC,anon,authenticated',cols,cols,cols,cols,t);
  END LOOP;
  -- Serial wishlist IDs, when present, need USAGE for the existing insert.
  -- No arbitrary sequence grant, no sequence UPDATE, no ID/schema conversion.
  t:=pg_get_serial_sequence('public.wishlist','id');
  IF t IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO authenticated',t);
  END IF;
END $$;
GRANT SELECT ON public.profiles,public.wishlist TO authenticated;
GRANT SELECT ON public.orders,public.order_items TO authenticated;
GRANT INSERT (id,first_name,last_name,phone,email) ON public.profiles TO authenticated;
GRANT UPDATE (first_name,last_name,phone) ON public.profiles TO authenticated;
GRANT INSERT (user_id,product_id) ON public.wishlist TO authenticated;
GRANT DELETE ON public.wishlist TO authenticated;
CREATE POLICY nrs_customer_profile_read ON public.profiles FOR SELECT TO authenticated
  USING (id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_profile_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_profile_update ON public.profiles FOR UPDATE TO authenticated
  USING (id=(SELECT auth.uid())) WITH CHECK (id=(SELECT auth.uid()));
CREATE POLICY nrs_active_admin_profile_read ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));
CREATE POLICY nrs_customer_wishlist_read ON public.wishlist FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_wishlist_insert ON public.wishlist FOR INSERT TO authenticated
  WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_wishlist_delete ON public.wishlist FOR DELETE TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_active_admin_wishlist_read ON public.wishlist FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));
CREATE POLICY nrs_customer_order_read ON public.orders FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_active_admin_order_read ON public.orders FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));
CREATE POLICY nrs_customer_order_item_read ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.user_id=(SELECT auth.uid())));
CREATE POLICY nrs_active_admin_order_item_read ON public.order_items FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));

-- Metadata-only final checks execute BEFORE commit. Failure rolls back changes.
DO $verify$
DECLARE t text; r record; allowed boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders','order_items','profiles','wishlist'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN
      RAISE EXCEPTION 'STOP: RLS verification failed for %',t;
    END IF;
    IF has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_table_privilege('authenticated','public.'||t,'INSERT,UPDATE,TRUNCATE,REFERENCES,TRIGGER')
      OR NOT has_table_privilege('authenticated','public.'||t,'SELECT')
      OR (t<>'wishlist' AND has_table_privilege('authenticated','public.'||t,'DELETE'))
      OR (t='wishlist' AND NOT has_table_privilege('authenticated','public.'||t,'DELETE')) THEN
      RAISE EXCEPTION 'STOP: effective table ACL verification failed for %',t;
    END IF;
    FOR r IN SELECT a.attname,privilege.name FROM pg_attribute a
      CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) privilege(name)
      WHERE a.attrelid=format('public.%I',t)::regclass AND a.attnum>0 AND NOT a.attisdropped LOOP
      allowed:=r.name='SELECT' OR (r.name='INSERT' AND
        ((t='profiles' AND r.attname IN ('id','first_name','last_name','phone','email'))
         OR (t='wishlist' AND r.attname IN ('user_id','product_id'))))
        OR (r.name='UPDATE' AND t='profiles' AND r.attname IN ('first_name','last_name','phone'));
      IF has_column_privilege('anon','public.'||t,r.attname,r.name)
        OR has_column_privilege('authenticated','public.'||t,r.attname,r.name) IS DISTINCT FROM allowed THEN
        RAISE EXCEPTION 'STOP: effective column ACL verification failed for %.% %',t,r.attname,r.name;
      END IF;
    END LOOP;
  END LOOP;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='orders'
    AND column_name='user_id' AND is_nullable='NO') THEN RAISE EXCEPTION 'STOP: ownership nullability changed'; END IF;
  t:=pg_get_serial_sequence('public.wishlist','id');
  IF t IS NOT NULL AND (NOT has_sequence_privilege('authenticated',t,'USAGE')
    OR has_sequence_privilege('authenticated',t,'SELECT,UPDATE') OR has_sequence_privilege('anon',t,'USAGE,SELECT,UPDATE')) THEN
    RAISE EXCEPTION 'STOP: wishlist sequence verification failed';
  END IF;
  RAISE NOTICE 'Verified ACL/RLS metadata; COMMIT must complete without error. No customer data or RPC bodies changed.';
END $verify$;


-- Reuse reviewed migration: 20261008120000_order_legal_records.sql
-- PREPARED ONLY: inspect live schema/policies before applying. No existing table
-- or policy is altered. UUID is evidenced by the existing admin order RPC;
-- preflight aborts if actual schema differs. No IP/user-agent collection.

DO $$
BEGIN
  IF to_regclass('public.orders') IS NULL THEN
    RAISE EXCEPTION 'Expected existing public.orders is missing; inspect schema.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'id' AND udt_name = 'uuid')
    OR NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'user_id' AND udt_name = 'uuid') THEN
    RAISE EXCEPTION 'orders.id/user_id types differ; inspect live schema before applying.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name = 'orders' AND column_name IN ('contract_accepted', 'contract_version', 'pre_information_version', 'accepted_at')) THEN
    RAISE EXCEPTION 'Existing order legal fields detected; reuse/review them before creating duplicate storage.';
  END IF;
  IF to_regclass('public.order_legal_records') IS NOT NULL THEN
    RAISE EXCEPTION 'Legal record storage already exists; inspect and reuse it.';
  END IF;
END;
$$;

CREATE TABLE public.order_legal_records (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE RESTRICT,
  contract_accepted boolean NOT NULL CHECK (contract_accepted = true),
  contract_version text NOT NULL CHECK (length(trim(contract_version)) > 0),
  pre_information_version text NOT NULL CHECK (length(trim(pre_information_version)) > 0),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  document_hash text NOT NULL CHECK (document_hash ~ '^[0-9a-f]{64}$'),
  summary_hash text NOT NULL CHECK (summary_hash ~ '^[0-9a-f]{64}$'),
  order_summary jsonb NOT NULL CHECK (jsonb_typeof(order_summary) = 'object')
);

COMMENT ON TABLE public.order_legal_records IS
  'Immutable accepted document versions plus compact, server-verified order snapshot. Write atomically with the future order transaction; never accept client prices or timestamps.';

ALTER TABLE public.order_legal_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_legal_records FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_legal_records TO authenticated;
GRANT SELECT, INSERT ON public.order_legal_records TO service_role;

CREATE POLICY nrs_order_legal_records_owner_read
  ON public.order_legal_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders AS o
    WHERE o.id = order_legal_records.order_id AND o.user_id = (SELECT auth.uid())));

-- No client INSERT/UPDATE/DELETE policy. Accepted snapshots are not rewritten.
CREATE FUNCTION public.nrs_prevent_legal_record_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Accepted legal records cannot be updated or deleted.' USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public.nrs_prevent_legal_record_update() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER nrs_order_legal_records_immutable
  BEFORE UPDATE OR DELETE ON public.order_legal_records
  FOR EACH ROW EXECUTE FUNCTION public.nrs_prevent_legal_record_update();



-- Reuse reviewed migration: 20261008130000_payment_order_transactions.sql
-- PREPARED, NOT APPLIED. Inspect actual orders/order_items constraints/defaults
-- and existing policies before deployment. This does not alter existing tables
-- or policies. RPCs are service-role only; no browser can supply trusted totals.

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


-- Reuse reviewed migration: 20261009130000_payment_transaction_hardening.sql
-- LOCAL REVIEW ONLY; apply after both 20261008 payment/legal migrations.
-- No guest schema change: retain orders.user_id NOT NULL and existing FK action.
-- Existing legacy events keep merchant_id NULL; ambiguous legacy replays fail.

DO $$ DECLARE r record; state text; accepted boolean; status_column smallint; BEGIN
  IF to_regprocedure('public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)') IS NULL
    OR to_regprocedure('public.nrs_finalize_payment(jsonb,text)') IS NULL THEN RAISE EXCEPTION 'Payment RPC prerequisites missing'; END IF;
  FOR r IN SELECT * FROM (VALUES ('orders','id','uuid'),('orders','user_id','uuid'),('orders','status','text'),('orders','total_amount','numeric'),('order_items','product_id','text'),('products','id','text'),('products','price_amount','numeric'),('product_variants','id','uuid'),('product_variants','product_id','text'),('product_variants','stock_quantity','int4'),('payment_events','order_id','uuid'),('order_legal_records','order_id','uuid')) AS required(t,c,typ) LOOP
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name=r.t AND column_name=r.c AND udt_name=r.typ) THEN RAISE EXCEPTION 'Schema mismatch: %.%',r.t,r.c; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='user_id' AND is_nullable='NO') THEN RAISE EXCEPTION 'Review ownership schema: expected orders.user_id NOT NULL'; END IF;
  FOR r IN SELECT * FROM (VALUES ('orders','user_id','auth.users'),('order_legal_records','order_id','public.orders'),('payment_orders','order_id','public.orders'),('payment_stock_reservations','variant_id','public.product_variants')) AS required(t,c,target) LOOP
    IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid=format('public.%I',r.t)::regclass AND confrelid=r.target::regclass AND contype='f'
      AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=format('public.%I',r.t)::regclass AND attname=r.c)]
      AND confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=r.target::regclass AND attname='id')]) THEN RAISE EXCEPTION 'Foreign key mismatch: %.%',r.t,r.c; END IF;
  END LOOP;
  SELECT attnum INTO status_column FROM pg_attribute WHERE attrelid='public.orders'::regclass AND attname='status';
  FOR r IN SELECT conname,conkey,pg_get_expr(conbin,conrelid) AS expression FROM pg_constraint WHERE conrelid='public.orders'::regclass AND contype='c' AND status_column=ANY(conkey) LOOP
    IF r.conkey IS DISTINCT FROM ARRAY[status_column] THEN RAISE EXCEPTION 'Review composite status constraint %',r.conname; END IF;
    FOREACH state IN ARRAY ARRAY['payment_pending','paid','cancelled'] LOOP
      EXECUTE format('SELECT (%s) FROM jsonb_populate_record(NULL::public.orders,jsonb_build_object(''status'',$1))',r.expression) INTO accepted USING state;
      IF accepted IS DISTINCT FROM true THEN RAISE EXCEPTION 'Status % incompatible with constraint %',state,r.conname; END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='payment_events' AND column_name='merchant_id') THEN RAISE EXCEPTION 'Already hardened: inspect migration history'; END IF;
END $$;
ALTER TABLE public.payment_events ADD COLUMN merchant_id text CHECK (merchant_id IS NULL OR length(btrim(merchant_id))>0);
CREATE OR REPLACE FUNCTION public.nrs_create_payment_order(p_order_id uuid,p_user_id uuid,p_guest_hash text,p_key uuid,
  p_request_hash text,p_items jsonb,p_customer jsonb,p_legal jsonb,p_provider text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE previous public.payment_orders%ROWTYPE; item jsonb; product public.products%ROWTYPE;
  variant public.product_variants%ROWTYPE; snapshot jsonb; line jsonb; total_minor bigint:=0; subtotal_minor bigint:=0;
  sale_minor bigint; shipping_minor bigint; quantity integer; count_items integer:=0;
BEGIN
  IF p_user_id IS NULL OR p_guest_hash IS NOT NULL THEN RAISE EXCEPTION 'Authenticated checkout required'; END IF;
  IF p_key IS NULL OR p_order_id IS NULL OR p_request_hash IS NULL OR p_request_hash !~ '^[0-9a-f]{64}$'
    OR p_provider IS NULL OR btrim(p_provider)='' THEN RAISE EXCEPTION 'invalid payment request'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid items'; END IF;
  IF EXISTS (SELECT FROM jsonb_array_elements(p_items) x GROUP BY x->>'variantId' HAVING count(*)>1) THEN RAISE EXCEPTION 'duplicate variant'; END IF;
  -- Same-key concurrent requests serialize before checking/creating anything.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_key::text,0));
  SELECT * INTO previous FROM public.payment_orders WHERE idempotency_key=p_key FOR UPDATE;
  IF FOUND THEN
    IF previous.user_id IS DISTINCT FROM p_user_id OR previous.guest_hash IS DISTINCT FROM p_guest_hash OR previous.request_hash IS DISTINCT FROM p_request_hash OR previous.provider IS DISTINCT FROM p_provider THEN
      RAISE EXCEPTION 'idempotency ownership/content mismatch';
    END IF;
    RETURN jsonb_build_object('created',false,'order',jsonb_build_object('id',previous.order_id,'merchantReference',previous.merchant_reference,
      'amountMinor',previous.amount_minor,'currency',previous.currency,'state',previous.state,
      'legal',(SELECT to_jsonb(l) FROM public.order_legal_records l WHERE l.order_id=previous.order_id)));
  END IF;
  -- Serialize new attempts per owner as well as per key. A lost browser key or
  -- changed cart must not initiate a second payment while settlement is unknown.
  PERFORM pg_advisory_xact_lock(hashtextextended('payment-owner:'||p_user_id::text,0));
  IF EXISTS (SELECT FROM public.payment_orders WHERE user_id=p_user_id AND state IN ('initiating','pending')) THEN
    RAISE EXCEPTION 'Unresolved payment exists; reconcile before a new attempt';
  END IF;
  IF (p_legal->>'contract_accepted') IS DISTINCT FROM 'true' OR coalesce(p_legal->>'contract_version','') NOT IN ('v1.1','v1.3','v1.4')
    OR coalesce(p_legal->>'pre_information_version','') NOT IN ('v1.1','v1.3','v1.4')
    OR p_legal->>'contract_version' IS DISTINCT FROM p_legal->>'pre_information_version' OR (p_legal->>'order_id') IS DISTINCT FROM p_order_id::text THEN
    RAISE EXCEPTION 'invalid legal acceptance';
  END IF;
  snapshot:=p_legal->'order_summary';
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100
    OR jsonb_typeof(snapshot->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(snapshot->'items') IS DISTINCT FROM jsonb_array_length(p_items)
    OR snapshot->>'currency' IS DISTINCT FROM 'TRY' OR snapshot->>'shipping' IS NULL THEN RAISE EXCEPTION 'invalid summary'; END IF;
  -- Lock products/variants in consistent order. All stock mutations for these
  -- online orders happen inside this transaction; no separate decrement call.
  PERFORM 1 FROM public.products p WHERE p.id IN (SELECT x->>'productId' FROM jsonb_array_elements(p_items) x) ORDER BY p.id FOR UPDATE;
  PERFORM 1 FROM public.product_variants v WHERE v.id IN (SELECT (x->>'variantId')::uuid FROM jsonb_array_elements(p_items) x) ORDER BY v.id FOR UPDATE;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    quantity:=(item->>'quantity')::integer;
    IF quantity IS NULL OR quantity NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid quantity'; END IF;
    SELECT * INTO product FROM public.products WHERE id=item->>'productId';
    IF NOT FOUND OR product.status IS DISTINCT FROM 'active' OR product.currency IS DISTINCT FROM 'TRY' OR product.price_amount IS NULL OR product.price_amount<=0 THEN RAISE EXCEPTION 'product unavailable'; END IF;
    SELECT * INTO variant FROM public.product_variants WHERE id=(item->>'variantId')::uuid AND product_id=product.id;
    IF NOT FOUND OR variant.is_active IS DISTINCT FROM true OR variant.stock_quantity IS NULL OR variant.stock_quantity<quantity THEN RAISE EXCEPTION 'stock unavailable'; END IF;
    line:=snapshot->'items'->count_items;

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
    sale_minor:=round(product.price_amount*100)::bigint;
    IF line->>'productId' IS DISTINCT FROM product.id OR line->>'name' IS DISTINCT FROM product.name
      OR line->>'description' IS DISTINCT FROM coalesce(nullif(product.description,''),product.name)
      OR line->>'size' IS DISTINCT FROM nullif(variant.size,'') OR (line->>'quantity')::integer IS DISTINCT FROM quantity
      OR round((line->>'unitPrice')::numeric*100)::bigint IS DISTINCT FROM sale_minor THEN RAISE EXCEPTION 'quote changed'; END IF;
    total_minor:=total_minor+sale_minor*quantity;
    subtotal_minor:=subtotal_minor+round(greatest(product.price_amount,coalesce(product.compare_at_price,product.price_amount))*100)::bigint*quantity;
    count_items:=count_items+1;
  END LOOP;
  shipping_minor:=round((snapshot->>'shipping')::numeric*100)::bigint;
  IF shipping_minor IS NULL OR shipping_minor<0 OR round((snapshot->>'subtotal')::numeric*100)::bigint IS DISTINCT FROM subtotal_minor
    OR round((snapshot->>'discount')::numeric*100)::bigint IS DISTINCT FROM subtotal_minor-total_minor
    OR round((snapshot->>'total')::numeric*100)::bigint IS DISTINCT FROM total_minor+shipping_minor THEN RAISE EXCEPTION 'total mismatch'; END IF;
  IF snapshot->'buyer'->>'name' IS DISTINCT FROM (p_customer->>'firstName')||' '||(p_customer->>'lastName')
    OR snapshot->'buyer'->>'email' IS DISTINCT FROM p_customer->>'email'
    OR snapshot->'buyer'->>'phone' IS DISTINCT FROM p_customer->>'phone' THEN RAISE EXCEPTION 'buyer summary mismatch'; END IF;
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

CREATE OR REPLACE FUNCTION public.nrs_finalize_payment(p_payment jsonb,p_provider text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE payment public.payment_orders%ROWTYPE; event public.payment_events%ROWTYPE; reservation record; final_state text; order_status text;
BEGIN
  -- Only adapter-verified results reach this service-role-only RPC. This is
  -- structural/business validation, NOT a substitute for provider signatures.
  IF jsonb_typeof(p_payment) IS DISTINCT FROM 'object' OR p_provider IS NULL OR btrim(p_provider)=''
    OR EXISTS (SELECT FROM unnest(ARRAY['merchantId','merchantReference','transactionId','eventId','currency','status','threeDS']) field
      WHERE jsonb_typeof(p_payment->field) IS DISTINCT FROM 'string' OR btrim(p_payment->>field)='')
    OR jsonb_typeof(p_payment->'amountMinor') IS DISTINCT FROM 'number'
    OR (p_payment->>'amountMinor') !~ '^[0-9]+$'
    OR (p_payment->>'amountMinor')::numeric<=0
    OR p_payment->>'status' NOT IN ('paid','failed','pending')
    OR p_payment->>'threeDS' NOT IN ('authenticated','not_required','failed')
    OR (p_payment->>'status'='paid' AND p_payment->>'threeDS' NOT IN ('authenticated','not_required')) THEN
    RAISE EXCEPTION 'unverified payment';
  END IF;
  SELECT * INTO payment FROM public.payment_orders WHERE merchant_reference=(p_payment->>'merchantReference')::uuid FOR UPDATE;
  IF NOT FOUND OR payment.provider IS DISTINCT FROM p_provider OR payment.amount_minor IS DISTINCT FROM (p_payment->>'amountMinor')::bigint
    OR payment.currency IS DISTINCT FROM p_payment->>'currency' THEN RAISE EXCEPTION 'verified result mismatch'; END IF;
  SELECT * INTO event FROM public.payment_events WHERE provider=p_provider AND event_id=p_payment->>'eventId';
  IF FOUND THEN
    IF event.order_id IS DISTINCT FROM payment.order_id OR event.transaction_id IS DISTINCT FROM p_payment->>'transactionId'
      OR event.state IS DISTINCT FROM p_payment->>'status' OR event.amount_minor IS DISTINCT FROM payment.amount_minor OR event.currency IS DISTINCT FROM payment.currency
      OR event.three_ds IS DISTINCT FROM p_payment->>'threeDS' OR event.merchant_id IS DISTINCT FROM p_payment->>'merchantId' THEN RAISE EXCEPTION 'event replay mismatch'; END IF;
    RETURN;
  END IF;
  final_state:=p_payment->>'status';
  IF final_state NOT IN ('paid','failed','pending') OR (final_state='paid' AND p_payment->>'threeDS' NOT IN ('authenticated','not_required')) THEN RAISE EXCEPTION 'unverified payment'; END IF;
  IF payment.state IN ('paid','failed') AND payment.state<>final_state THEN RAISE EXCEPTION 'terminal state conflict; reconcile with provider'; END IF;
  IF payment.transaction_id IS NOT NULL AND payment.transaction_id IS DISTINCT FROM p_payment->>'transactionId' THEN RAISE EXCEPTION 'transaction mismatch'; END IF;
  SELECT status INTO order_status FROM public.orders WHERE id=payment.order_id FOR UPDATE;
  IF order_status IS NULL OR (final_state='paid' AND payment.state<>'paid' AND order_status NOT IN ('payment_pending','paid')) THEN RAISE EXCEPTION 'order state conflict; reconcile'; END IF;
  INSERT INTO public.payment_events(provider,event_id,order_id,transaction_id,amount_minor,currency,state,three_ds,merchant_id)
    VALUES(p_provider,p_payment->>'eventId',payment.order_id,p_payment->>'transactionId',payment.amount_minor,payment.currency,final_state,p_payment->>'threeDS',p_payment->>'merchantId');
  IF payment.state NOT IN ('paid','failed') THEN
    UPDATE public.payment_orders SET state=final_state,transaction_id=p_payment->>'transactionId',updated_at=now() WHERE order_id=payment.order_id;
    IF final_state='paid' THEN UPDATE public.orders SET status='paid' WHERE id=payment.order_id; END IF;
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


CREATE OR REPLACE FUNCTION public.nrs_admin_update_order_status(p_order_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_status text;
  payment_state text;
  has_payment boolean;
BEGIN
  IF public.nrs_is_active_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('pending', 'payment_pending', 'processing', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported operational order status' USING ERRCODE = '22023';
  END IF;

  -- Match finalize lock order: payment first, then order. A callback either
  -- commits before this read or waits; no stale read can cancel settlement.
  SELECT p.state INTO payment_state FROM public.payment_orders p
  WHERE p.order_id=p_order_id FOR UPDATE;
  has_payment:=FOUND;

  SELECT o.status INTO current_status
  FROM public.orders AS o
  WHERE o.id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;

  IF current_status IS NULL OR current_status NOT IN
    ('pending','payment_pending','paid','processing','shipped','delivered','cancelled','refunded') THEN
    RAISE EXCEPTION 'unknown current order status; manual review required' USING ERRCODE='22023';
  END IF;
  IF has_payment AND (payment_state IS NULL OR payment_state NOT IN ('paid','failed')) THEN
    RAISE EXCEPTION 'Unresolved online payment; reconcile before operational changes' USING ERRCODE='22023';
  END IF;

  -- This legacy schema stores payment and fulfillment state in one column.
  -- Do not overwrite a payment result or advance an unpaid order to fulfillment.
  IF current_status='paid' AND p_status='processing' AND EXISTS (
    SELECT FROM public.payment_orders WHERE order_id=p_order_id AND state='paid'
  ) THEN
    -- Payment remains paid in payment_orders; orders.status may track fulfillment.
    UPDATE public.orders SET status='processing' WHERE id=p_order_id;
    RETURN;
  END IF;
  IF p_status='cancelled' AND current_status IN ('processing','shipped') AND EXISTS (
    SELECT FROM public.payment_orders WHERE order_id=p_order_id AND state='paid'
  ) THEN RAISE EXCEPTION 'Verified payment requires bank refund workflow, not manual cancellation' USING ERRCODE='22023'; END IF;
  IF current_status IN ('paid', 'refunded') THEN
    RAISE EXCEPTION 'payment state cannot be replaced by an operational status' USING ERRCODE = '22023';
  END IF;
  IF current_status IN ('pending', 'payment_pending') AND p_status <> 'cancelled' THEN
    RAISE EXCEPTION 'unpaid order cannot advance to fulfillment' USING ERRCODE = '22023';
  END IF;
  IF current_status = 'processing' AND p_status NOT IN ('shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported fulfillment transition' USING ERRCODE = '22023';
  END IF;
  IF current_status = 'shipped' AND p_status NOT IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported fulfillment transition' USING ERRCODE = '22023';
  END IF;
  IF current_status NOT IN ('pending', 'payment_pending', 'processing', 'shipped') THEN
    RAISE EXCEPTION 'current order status is not editable in admin' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET status = p_status
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.nrs_admin_update_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nrs_admin_update_order_status(uuid, text) TO authenticated;


-- Narrow active-admin metadata view. Never expose guest hashes or redirect tokens.
CREATE FUNCTION public.nrs_admin_payment_summary(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT public.nrs_is_active_admin() THEN RAISE EXCEPTION 'not authorized' USING ERRCODE='42501'; END IF;
  RETURN (SELECT jsonb_build_object('state',state,'provider',provider,'transactionId',transaction_id,
    'amountMinor',amount_minor,'currency',currency) FROM public.payment_orders WHERE order_id=p_order_id);
END $$;
REVOKE ALL ON FUNCTION public.nrs_admin_payment_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.nrs_admin_payment_summary(uuid) TO authenticated;

-- CREATE OR REPLACE retains prior ACLs; explicitly reassert service-only execution.
REVOKE ALL ON FUNCTION public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text),public.nrs_finalize_payment(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text),public.nrs_finalize_payment(jsonb,text) TO service_role;


-- Reuse reviewed migration: 20261009140000_final_security_review_fixes.sql
-- Corrective migration: F-01/F-02/F-03 from final security review.
-- Run ONLY after 20261009120000 and 20261009130000. No legacy rows repaired.
-- No live application authorized. Keep both payment flags false until staging.

DO $$
DECLARE r record; state text; accepted boolean; status_column smallint; invalid_count bigint;
BEGIN
  IF to_regprocedure('public.nrs_is_active_admin()') IS NULL
    OR to_regprocedure('public.nrs_admin_update_order_status(uuid,text)') IS NULL
    OR to_regprocedure('public.nrs_finalize_payment(jsonb,text)') IS NULL
    OR NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
      AND table_name='payment_events' AND column_name='merchant_id' AND udt_name='text') THEN
    RAISE EXCEPTION 'Final security fix prerequisites missing: apply preceding hardening migrations first';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('orders','id','uuid'),('orders','user_id','uuid'),
    ('orders','status','text'),('payment_orders','order_id','uuid'),('payment_orders','state','text')) required(t,c,typ) LOOP
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
      AND table_name=r.t AND column_name=r.c AND udt_name=r.typ AND domain_name IS NULL) THEN
      RAISE EXCEPTION 'Schema mismatch: %.%; enum/domain status requires explicit review',r.t,r.c;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='orders'
    AND column_name='user_id' AND is_nullable='NO') THEN RAISE EXCEPTION 'Expected orders.user_id NOT NULL'; END IF;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.payment_orders'::regclass AND contype='p'
    AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.payment_orders'::regclass AND attname='order_id')])
    OR NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.payment_orders'::regclass AND contype='f'
      AND confrelid='public.orders'::regclass
      AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.payment_orders'::regclass AND attname='order_id')]
      AND confkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.orders'::regclass AND attname='id')]) THEN
    RAISE EXCEPTION 'Expected one payment per order and matching order FK';
  END IF;
  -- Validate every state written by create/finalize/admin, not only settlement.
  -- Composite status constraints cannot be evaluated without real row context.
  SELECT attnum INTO status_column FROM pg_attribute WHERE attrelid='public.orders'::regclass AND attname='status';
  FOR r IN SELECT conname,conkey,pg_get_expr(conbin,conrelid) expression FROM pg_constraint
    WHERE conrelid='public.orders'::regclass AND contype='c' AND status_column=ANY(conkey) LOOP
    IF r.conkey IS DISTINCT FROM ARRAY[status_column] THEN RAISE EXCEPTION 'Review composite status constraint %',r.conname; END IF;
    FOREACH state IN ARRAY ARRAY['pending','payment_pending','paid','processing','shipped','delivered','cancelled'] LOOP
      EXECUTE format('SELECT (%s) FROM jsonb_populate_record(NULL::public.orders,jsonb_build_object(''status'',$1))',r.expression)
        INTO accepted USING state;
      IF accepted IS DISTINCT FROM true THEN RAISE EXCEPTION 'Status % incompatible with constraint %',state,r.conname; END IF;
    END LOOP;
  END LOOP;
  -- Report counts only. Never guess the payment/fulfillment state of legacy rows.
  SELECT count(*) INTO invalid_count FROM public.orders WHERE status IS NULL OR status NOT IN
    ('pending','payment_pending','paid','processing','shipped','delivered','cancelled','refunded');
  RAISE NOTICE 'Legacy NULL/unknown statuses requiring manual review: %',invalid_count;
  IF EXISTS (SELECT FROM public.orders o JOIN public.payment_orders p ON p.order_id=o.id
    WHERE p.state IN ('initiating','pending') AND o.status IS DISTINCT FROM 'payment_pending') THEN
    RAISE EXCEPTION 'Existing unresolved payment/order conflict; authenticated provider reconciliation and manual review required';
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.nrs_admin_update_order_status(p_order_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_status text;
  payment_state text;
  has_payment boolean;
BEGIN
  IF public.nrs_is_active_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('pending', 'payment_pending', 'processing', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported operational order status' USING ERRCODE = '22023';
  END IF;

  -- Match finalize lock order: payment first, then order. A callback either
  -- commits before this read or waits; no stale read can cancel settlement.
  SELECT p.state INTO payment_state FROM public.payment_orders p
  WHERE p.order_id=p_order_id FOR UPDATE;
  has_payment:=FOUND;

  SELECT o.status INTO current_status
  FROM public.orders AS o
  WHERE o.id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;

  IF current_status IS NULL OR current_status NOT IN
    ('pending','payment_pending','paid','processing','shipped','delivered','cancelled','refunded') THEN
    RAISE EXCEPTION 'unknown current order status; manual review required' USING ERRCODE='22023';
  END IF;
  IF has_payment AND (payment_state IS NULL OR payment_state NOT IN ('paid','failed')) THEN
    RAISE EXCEPTION 'Unresolved online payment; reconcile before operational changes' USING ERRCODE='22023';
  END IF;

  -- This legacy schema stores payment and fulfillment state in one column.
  -- Do not overwrite a payment result or advance an unpaid order to fulfillment.
  IF current_status='paid' AND p_status='processing' AND EXISTS (
    SELECT FROM public.payment_orders WHERE order_id=p_order_id AND state='paid'
  ) THEN
    -- Payment remains paid in payment_orders; orders.status may track fulfillment.
    UPDATE public.orders SET status='processing' WHERE id=p_order_id;
    RETURN;
  END IF;
  IF p_status='cancelled' AND current_status IN ('processing','shipped') AND EXISTS (
    SELECT FROM public.payment_orders WHERE order_id=p_order_id AND state='paid'
  ) THEN RAISE EXCEPTION 'Verified payment requires bank refund workflow, not manual cancellation' USING ERRCODE='22023'; END IF;
  IF current_status IN ('paid', 'refunded') THEN
    RAISE EXCEPTION 'payment state cannot be replaced by an operational status' USING ERRCODE = '22023';
  END IF;
  IF current_status IN ('pending', 'payment_pending') AND p_status <> 'cancelled' THEN
    RAISE EXCEPTION 'unpaid order cannot advance to fulfillment' USING ERRCODE = '22023';
  END IF;
  IF current_status = 'processing' AND p_status NOT IN ('shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported fulfillment transition' USING ERRCODE = '22023';
  END IF;
  IF current_status = 'shipped' AND p_status NOT IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported fulfillment transition' USING ERRCODE = '22023';
  END IF;
  IF current_status NOT IN ('pending', 'payment_pending', 'processing', 'shipped') THEN
    RAISE EXCEPTION 'current order status is not editable in admin' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET status = p_status
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.nrs_admin_update_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nrs_admin_update_order_status(uuid, text) TO authenticated;




-- Reuse reviewed migration: 20261009150000_customer_access_hardening.sql
-- LOCAL REVIEW ONLY. Snapshot live policies/ACLs and verify migration history
-- before authorized staging/production application. No customer data changes.
-- Apply after 20261009140000. Reentrant final ACL/RLS reconciliation for all
-- four customer tables; retains the latest payment/admin race-safe RPC bodies.

DO $$
DECLARE r record; t text; cols text;
BEGIN
  IF NOT EXISTS (SELECT FROM pg_proc WHERE oid=to_regprocedure('public.nrs_is_active_admin()')
    AND prosecdef AND prorettype='boolean'::regtype) THEN
    RAISE EXCEPTION 'Review existing active-admin predicate first';
  END IF;
  IF to_regprocedure('public.nrs_admin_update_order_status(uuid,text)') IS NULL
    OR to_regprocedure('public.nrs_finalize_payment(jsonb,text)') IS NULL THEN
    RAISE EXCEPTION 'Apply preceding order/payment hardening first';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('profiles','id','uuid'),('wishlist','user_id','uuid'),
    ('wishlist','product_id','text'),('orders','id','uuid'),('orders','user_id','uuid'),
    ('order_items','order_id','uuid')) required(t,c,typ) LOOP
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
      AND table_name=r.t AND column_name=r.c AND udt_name=r.typ AND domain_name IS NULL) THEN
      RAISE EXCEPTION 'Customer schema mismatch: %.%',r.t,r.c;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
    AND table_name='wishlist' AND column_name='id') THEN
    RAISE EXCEPTION 'Expected existing wishlist.id';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('first_name'),('last_name'),('phone'),('email')) required(c) LOOP
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
      AND table_name='profiles' AND column_name=r.c AND data_type IN ('text','character varying')
      AND domain_name IS NULL) THEN RAISE EXCEPTION 'Review profile field %',r.c; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.profiles'::regclass AND contype='p'
    AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attname='id')]) THEN
    RAISE EXCEPTION 'Expected profiles.id primary key for existing signup upsert';
  END IF;
  -- Do not invent defaults, change IDs, or repair existing legacy rows.
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
    AND table_name IN ('profiles','wishlist') AND is_nullable='NO' AND column_default IS NULL
    AND is_identity='NO' AND is_generated='NEVER' AND NOT (
      (table_name='profiles' AND column_name IN ('id','first_name','last_name','phone','email')) OR
      (table_name='wishlist' AND column_name IN ('user_id','product_id')))) THEN
    RAISE EXCEPTION 'Required customer column without default: review existing insert compatibility';
  END IF;
  FOREACH t IN ARRAY ARRAY['profiles','wishlist','orders','order_items'] LOOP
    -- Permissive policies OR together: remove old public ALL/true policies too.
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      RAISE NOTICE 'Replacing policy %.%',t,r.policyname;
      EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_attribute
      WHERE attrelid=format('public.%I',t)::regclass AND attnum>0 AND NOT attisdropped;
    EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.%I FROM PUBLIC,anon,authenticated',cols,cols,cols,cols,t);
  END LOOP;
  -- Serial wishlist IDs, when present, need USAGE for the existing insert.
  -- No arbitrary sequence grant, no sequence UPDATE, no ID/schema conversion.
  t:=pg_get_serial_sequence('public.wishlist','id');
  IF t IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO authenticated',t);
  END IF;
END $$;
GRANT SELECT ON public.profiles,public.wishlist TO authenticated;
GRANT SELECT ON public.orders,public.order_items TO authenticated;
GRANT INSERT (id,first_name,last_name,phone,email) ON public.profiles TO authenticated;
GRANT UPDATE (first_name,last_name,phone) ON public.profiles TO authenticated;
GRANT INSERT (user_id,product_id) ON public.wishlist TO authenticated;
GRANT DELETE ON public.wishlist TO authenticated;
CREATE POLICY nrs_customer_profile_read ON public.profiles FOR SELECT TO authenticated
  USING (id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_profile_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_profile_update ON public.profiles FOR UPDATE TO authenticated
  USING (id=(SELECT auth.uid())) WITH CHECK (id=(SELECT auth.uid()));
CREATE POLICY nrs_active_admin_profile_read ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));
CREATE POLICY nrs_customer_wishlist_read ON public.wishlist FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_wishlist_insert ON public.wishlist FOR INSERT TO authenticated
  WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_wishlist_delete ON public.wishlist FOR DELETE TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_active_admin_wishlist_read ON public.wishlist FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));
CREATE POLICY nrs_customer_order_read ON public.orders FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_active_admin_order_read ON public.orders FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));
CREATE POLICY nrs_customer_order_item_read ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.user_id=(SELECT auth.uid())));
CREATE POLICY nrs_active_admin_order_item_read ON public.order_items FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));


-- Reuse reviewed migration: 20261010130000_manual_order_details.sql
-- Apply only AFTER the reviewed security migration chain and SECURITY_APPLY.
-- An unpaid request does not reserve stock or confirm manufacture/delivery.

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

SET LOCAL search_path=public,pg_catalog;
INSERT INTO public.categories(id,name,slug,description) VALUES
 ('90000000-0000-4000-8000-000000000001','Garanti TEST','garanti-test','Yalnızca izole banka testleri için sentetik ürünler');
INSERT INTO public.products(id,name,slug,category_id,description,price_amount,currency,status,in_stock) VALUES
 ('garanti-test-accessory','Garanti TEST Aksesuar','garanti-test-aksesuar','90000000-0000-4000-8000-000000000001','Sentetik test ürünü; gerçek satış değildir.',1.00,'TRY','active',true),
 ('garanti-test-dress','Garanti TEST Elbise','garanti-test-elbise','90000000-0000-4000-8000-000000000001','Sentetik ölçülü test ürünü; gerçek satış değildir.',2.00,'TRY','active',true);
INSERT INTO public.product_variants(id,product_id,size,stock_quantity,is_active) VALUES
 ('90000000-0000-4000-8000-000000000011','garanti-test-accessory',NULL,20,true),
 ('90000000-0000-4000-8000-000000000012','garanti-test-dress','M',20,true);
-- Assert minimum permissions explicitly: automatic table exposure is not used.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['categories','products','product_images','product_variants','collections','product_collections',
  'profiles','wishlist','orders','order_items','admin_users','order_legal_records','payment_orders','payment_events','payment_stock_reservations'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||t)) THEN RAISE EXCEPTION 'RLS absent: %',t; END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['orders','order_items','profiles','wishlist','admin_users','order_legal_records','payment_orders','payment_events','payment_stock_reservations'] LOOP
  IF has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Anonymous private-table grant: %',t; END IF;
 END LOOP;
 IF has_function_privilege('anon','public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)','EXECUTE')
  OR has_function_privilege('authenticated','public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)','EXECUTE')
  OR has_function_privilege('authenticated','public.nrs_finalize_payment(jsonb,text)','EXECUTE') THEN RAISE EXCEPTION 'Browser payment RPC grant'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
