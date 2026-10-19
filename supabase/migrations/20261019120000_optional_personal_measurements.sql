-- Personal body measurements supplement the selected catalog size; they are
-- not a checkout prerequisite. Keep item/size/stock/price/legal checks and the
-- numeric range/type validation for every measurement the customer supplies.
-- CREATE OR REPLACE preserves the reviewed function ACL and security mode.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';

DO $migration$
DECLARE
  target regprocedure;
  definition text;
  updated_definition text;
  matches integer;
  expected_security boolean;
  processed integer := 0;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    to_regprocedure('public.nrs_create_manual_order(uuid,uuid,uuid,text,jsonb,jsonb,jsonb)'),
    to_regprocedure('public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)')
  ]::regprocedure[] LOOP
    IF target IS NULL THEN CONTINUE; END IF;
    processed := processed + 1;
    SELECT pg_get_functiondef(target), p.prosecdef
      INTO definition, expected_security
      FROM pg_proc p WHERE p.oid = target;

    IF definition IS NULL THEN RAISE EXCEPTION 'Could not read order RPC definition'; END IF;
    SELECT count(*) INTO matches FROM regexp_matches(definition, 'RAISE EXCEPTION ''required measurements missing'';', 'g');
    IF matches <> 1 THEN RAISE EXCEPTION 'Unexpected mandatory-measurement check count for %', target; END IF;

    updated_definition := replace(definition,
      'RAISE EXCEPTION ''required measurements missing'';',
      'NULL;');
    updated_definition := replace(updated_definition,
      'NOT IN (''v1.1'',''v1.3'',''v1.4'')',
      'NOT IN (''v1.1'',''v1.3'',''v1.4'',''v1.5'')');
    updated_definition := replace(updated_definition,
      'IN (''v1.3'',''v1.4'')',
      'IN (''v1.3'',''v1.4'',''v1.5'')');
    updated_definition := replace(updated_definition,
      'jsonb_typeof(line->''measurements'') IS DISTINCT FROM ''object''',
      'jsonb_typeof(coalesce(line->''measurements'',''{}''::jsonb)) IS DISTINCT FROM ''object''');

    IF updated_definition = definition
      OR updated_definition NOT LIKE '%THEN NULL; END IF;%'
      OR updated_definition LIKE '%required measurements missing%'
      OR updated_definition NOT LIKE '%v1.5%'
      OR updated_definition NOT LIKE '%coalesce(line->''measurements'',''{}''::jsonb)%'
      THEN RAISE EXCEPTION 'Order RPC did not receive the expected optional-measurement update: %', target; END IF;

    EXECUTE updated_definition;
    IF (SELECT p.prosecdef FROM pg_proc p WHERE p.oid = target) IS DISTINCT FROM expected_security THEN
      RAISE EXCEPTION 'Order RPC security mode changed: %', target;
    END IF;
  END LOOP;
  IF processed = 0 THEN RAISE EXCEPTION 'No supported order RPC was found'; END IF;
END
$migration$;

COMMIT;
