-- TEST ONLY: no raw POST or values; no payment/order mutations.
BEGIN;
DO $$ BEGIN
 IF current_setting('app.nrs_test_project_ref',true) IS DISTINCT FROM 'dzuxhwtbuojnhibzfxqy'
 OR NOT EXISTS(SELECT FROM public.products WHERE id='garanti-test-accessory') THEN
 RAISE EXCEPTION 'Isolated Garanti TEST project required'; END IF;
END $$;
ALTER TABLE public.garanti_test_return_diagnostics ADD COLUMN IF NOT EXISTS duplicate_fields jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(duplicate_fields)='array' AND jsonb_array_length(duplicate_fields)<=64);
NOTIFY pgrst,'reload schema';
COMMIT;
