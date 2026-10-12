-- TEST ONLY. Extends diagnostics; never changes orders/payments or RPCs.
BEGIN;
DO $$ BEGIN
  IF current_setting('app.nrs_test_project_ref',true) IS DISTINCT FROM 'dzuxhwtbuojnhibzfxqy'
    OR NOT EXISTS (SELECT FROM public.products WHERE id='garanti-test-accessory') THEN
    RAISE EXCEPTION 'Isolated Garanti TEST project required';
  END IF;
END $$;
ALTER TABLE public.garanti_test_return_diagnostics
  ADD COLUMN IF NOT EXISTS validation_stage text NOT NULL DEFAULT 'legacy'
    CHECK (validation_stage IN ('legacy','received','content_type','size','charset','percent_encoding','text_encoding','field_name','duplicate_field','field_size','parse_rejected','order_reference_invalid','payment_lookup_failed','return_verified','signature_rejected','return_mismatch','order_lookup_failed')),
  ADD COLUMN IF NOT EXISTS query_stage text NOT NULL DEFAULT 'not_queried'
    CHECK (query_stage IN ('not_queried','matched','mismatch','unavailable')),
  ADD COLUMN IF NOT EXISTS query_evidence jsonb
    CHECK (query_evidence IS NULL OR (
      jsonb_typeof(query_evidence)='object'
      AND query_evidence - ARRAY['http','mode_evidence','identity_match','amount_match','auth_match','response_code','reason_code','result_code','status','charge_type','auth_code_present','bank_reference_present']::text[]='{}'::jsonb
      AND query_evidence ?& ARRAY['http','mode_evidence','identity_match','amount_match','auth_match','response_code','reason_code','result_code','status','charge_type','auth_code_present','bank_reference_present']::text[]
      AND (query_evidence->>'http') ~ '^[1-5][0-9]{2}$'
      AND (query_evidence->>'mode_evidence') IN ('response','test_endpoint_and_request','conflict')
      AND jsonb_typeof(query_evidence->'identity_match')='boolean'
      AND jsonb_typeof(query_evidence->'amount_match')='boolean'
      AND jsonb_typeof(query_evidence->'auth_match') IN ('boolean','null')
      AND jsonb_typeof(query_evidence->'auth_code_present')='boolean'
      AND jsonb_typeof(query_evidence->'bank_reference_present')='boolean'
      AND (query_evidence->>'response_code' IS NULL OR (query_evidence->>'response_code') ~ '^[0-9]{0,4}$')
      AND (query_evidence->>'reason_code' IS NULL OR (query_evidence->>'reason_code') ~ '^[0-9]{0,4}$')
      AND (query_evidence->>'result_code' IS NULL OR (query_evidence->>'result_code') ~ '^[0-9]{0,4}$')
      AND (query_evidence->>'status' IS NULL OR (query_evidence->>'status') IN ('APPROVED','DECLINED','CANCELLED'))
      AND (query_evidence->>'charge_type' IS NULL OR (query_evidence->>'charge_type') IN ('S','P'))
    ));
NOTIFY pgrst,'reload schema';
COMMIT;
