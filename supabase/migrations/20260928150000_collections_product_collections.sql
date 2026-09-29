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
