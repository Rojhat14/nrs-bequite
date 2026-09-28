-- Product image bucket and admin-only object management. Review/apply manually.
DO $$
BEGIN
  IF to_regprocedure('public.nrs_is_active_admin()') IS NULL THEN
    RAISE EXCEPTION 'Apply the admin and product foundation migrations first.';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'product-images') THEN
    RAISE EXCEPTION 'Bucket product-images already exists; inspect its visibility and limits before applying this migration.';
  END IF;
END;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880,
  ARRAY['image/webp', 'image/jpeg', 'image/png']::text[]
);

CREATE POLICY nrs_admin_product_images_storage_manage
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.nrs_is_active_admin()
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.nrs_is_active_admin()
  );
