DO $$
BEGIN
  IF to_regclass('public.products') IS NULL
     OR to_regclass('public.categories') IS NULL
     OR to_regclass('public.collections') IS NULL
     OR to_regprocedure('public.nrs_is_active_admin()') IS NULL THEN
    RAISE EXCEPTION 'Storefront translation migration requires the current product/catalog schema and active-admin helper.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.storefront_translations (
  entity_type text NOT NULL CHECK (entity_type IN ('product','category','collection','page','legal')),
  entity_id text NOT NULL CHECK (length(entity_id) BETWEEN 1 AND 200),
  locale text NOT NULL CHECK (locale IN ('en','ar')),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (entity_type, entity_id, locale)
);

CREATE INDEX IF NOT EXISTS storefront_translations_locale_entity_idx
  ON public.storefront_translations (locale, entity_type, entity_id);

ALTER TABLE public.storefront_translations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.storefront_translations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.storefront_translations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.storefront_translations TO authenticated;
GRANT ALL ON public.storefront_translations TO service_role;

DROP POLICY IF EXISTS storefront_translation_public_read ON public.storefront_translations;
CREATE POLICY storefront_translation_public_read ON public.storefront_translations
  FOR SELECT TO anon, authenticated
  USING (
    (entity_type = 'product' AND EXISTS (
      SELECT 1 FROM public.products p WHERE p.id = entity_id AND p.status = 'active' AND p.payment_test_only IS FALSE
    )) OR
    (entity_type = 'category' AND EXISTS (
      SELECT 1 FROM public.categories c WHERE c.id::text = entity_id AND c.is_active IS TRUE
    )) OR
    (entity_type = 'collection' AND EXISTS (
      SELECT 1 FROM public.collections c WHERE c.id::text = entity_id AND c.is_active IS TRUE
    )) OR
    entity_type IN ('page','legal')
  );

DROP POLICY IF EXISTS storefront_translation_admin_read ON public.storefront_translations;
CREATE POLICY storefront_translation_admin_read ON public.storefront_translations
  FOR SELECT TO authenticated USING ((SELECT public.nrs_is_active_admin()));

DROP POLICY IF EXISTS storefront_translation_admin_write ON public.storefront_translations;
CREATE POLICY storefront_translation_admin_write ON public.storefront_translations
  FOR ALL TO authenticated
  USING ((SELECT public.nrs_is_active_admin()))
  WITH CHECK ((SELECT public.nrs_is_active_admin()));
