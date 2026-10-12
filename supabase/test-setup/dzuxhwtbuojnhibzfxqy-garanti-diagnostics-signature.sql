-- TEST ONLY. Safe shape/validation evidence; no values, hashes or secrets.
BEGIN;
DO $$ BEGIN
 IF current_setting('app.nrs_test_project_ref',true) IS DISTINCT FROM 'dzuxhwtbuojnhibzfxqy' OR to_regclass('public.garanti_test_return_diagnostics') IS NULL THEN RAISE EXCEPTION 'Isolated Garanti TEST project required'; END IF;
END $$;
ALTER TABLE public.garanti_test_return_diagnostics ADD COLUMN IF NOT EXISTS return_signature_evidence jsonb;
DO $$ DECLARE c record; a smallint; BEGIN
 SELECT attnum INTO a FROM pg_attribute WHERE attrelid='public.garanti_test_return_diagnostics'::regclass AND attname='return_signature_evidence';
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.garanti_test_return_diagnostics'::regclass AND contype='c' AND conkey=ARRAY[a] LOOP
  EXECUTE format('ALTER TABLE public.garanti_test_return_diagnostics DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
ALTER TABLE public.garanti_test_return_diagnostics ADD CONSTRAINT garanti_test_return_signature_evidence_shape CHECK(return_signature_evidence IS NULL OR (jsonb_typeof(return_signature_evidence)='object' AND return_signature_evidence - ARRAY['result','algorithm','encoding','store_key_transform','hash_format','form_charset','hashparams_order','documented_order','missing_fields','empty_fields','hashparamsval_matches_rebuilt','hash_shape']::text[]='{}'::jsonb));
NOTIFY pgrst,'reload schema';
COMMIT;
