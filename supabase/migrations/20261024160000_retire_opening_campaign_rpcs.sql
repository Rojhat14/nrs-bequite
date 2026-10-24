-- Retire the opening campaign at the trusted order-creation boundary.
-- This migration changes function definitions only: it does not update product
-- prices, existing orders, payment records, stock, grants, or RLS policies.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $retire_campaign$
DECLARE
  routine_oid oid;
  definition text;
  original_hash text;
  routine_name text;
  snapshot_marker text := 'snapshot:=p_legal->''order_summary'';';
  guard_marker text := 'IF snapshot ? ''campaign'' THEN RAISE EXCEPTION ''opening campaign disabled''; END IF;';
  old_subtotal text;
  new_subtotal text;
  plain_manual_subtotal text := 'subtotal_minor:=subtotal_minor+round(greatest(product.price_amount,coalesce(product.compare_at_price,product.price_amount))*100)::bigint*qty;';
  normal_manual_subtotal text := 'subtotal_minor:=subtotal_minor+round(product.price_amount*100)::bigint*qty;';
BEGIN
  FOREACH routine_oid IN ARRAY ARRAY[
    'public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'::regprocedure::oid,
    'public.nrs_create_manual_order(uuid,uuid,uuid,text,jsonb,jsonb,jsonb)'::regprocedure::oid
  ] LOOP
    SELECT pg_get_functiondef(p.oid), md5(pg_get_functiondef(p.oid)), p.oid::regprocedure::text
      INTO definition, original_hash, routine_name
      FROM pg_proc p WHERE p.oid = routine_oid;
    IF definition IS NULL THEN RAISE EXCEPTION 'Reviewed order RPC is missing'; END IF;

    IF position(guard_marker IN definition) > 0 THEN
      -- Idempotent only for the already-retired definition.
      IF position('greatest(product.price_amount,coalesce(product.compare_at_price,product.price_amount))' IN definition) > 0 THEN
        RAISE EXCEPTION 'Retired RPC still contains compare-at subtotal fallback';
      END IF;
      CONTINUE;
    END IF;
    IF position('campaign_active:=true' IN definition) = 0
      AND position('greatest(product.price_amount,coalesce(product.compare_at_price,product.price_amount))' IN definition) = 0 THEN
      CONTINUE;
    END IF;

    IF routine_name = 'nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)' THEN
      IF original_hash <> '77767e3d3df9006d6c5884464004d21a' THEN
        RAISE EXCEPTION 'Payment RPC differs from the reviewed Production/TEST definition';
      END IF;
      old_subtotal := 'subtotal_minor:=subtotal_minor+(CASE WHEN campaign_active THEN base_minor ELSE round(greatest(product.price_amount,coalesce(product.compare_at_price,product.price_amount))*100)::bigint END)*quantity;';
      new_subtotal := 'subtotal_minor:=subtotal_minor+round(product.price_amount*100)::bigint*quantity;';
    ELSIF routine_name = 'nrs_create_manual_order(uuid,uuid,uuid,text,jsonb,jsonb,jsonb)' THEN
      IF original_hash NOT IN ('3b05372f7067b32e873f3af4b011bca9', 'abea3e33997ccaefddcba5dc2a84d055') THEN
        RAISE EXCEPTION 'Manual order RPC differs from the reviewed Production/TEST definition';
      END IF;
      old_subtotal := 'subtotal_minor:=subtotal_minor+(CASE WHEN campaign_active THEN base_minor ELSE round(greatest(product.price_amount,coalesce(product.compare_at_price,product.price_amount))*100)::bigint END)*qty;';
      new_subtotal := 'subtotal_minor:=subtotal_minor+round(product.price_amount*100)::bigint*qty;';
    ELSE
      RAISE EXCEPTION 'Unexpected order RPC in retirement set';
    END IF;

    IF position('campaign_active:=true' IN definition) > 0 THEN
      IF length(definition)-length(replace(definition, snapshot_marker, '')) <> length(snapshot_marker) THEN
        RAISE EXCEPTION 'Order RPC snapshot anchor is missing or ambiguous';
      END IF;
      definition := replace(definition, snapshot_marker,
        snapshot_marker || E'\n  ' || guard_marker);
    END IF;

    IF routine_name = 'nrs_create_manual_order(uuid,uuid,uuid,text,jsonb,jsonb,jsonb)'
      AND position('campaign_active:=true' IN definition) = 0
      AND position(plain_manual_subtotal IN definition) > 0 THEN
      IF length(definition)-length(replace(definition, plain_manual_subtotal, '')) <> length(plain_manual_subtotal) THEN
        RAISE EXCEPTION 'Manual order RPC compare-at subtotal anchor is ambiguous';
      END IF;
      definition := replace(definition, plain_manual_subtotal, normal_manual_subtotal);
    ELSIF position(old_subtotal IN definition) > 0 THEN
      IF length(definition)-length(replace(definition, old_subtotal, '')) <> length(old_subtotal) THEN
        RAISE EXCEPTION 'Order RPC compare-at subtotal anchor is ambiguous';
      END IF;
      definition := replace(definition, old_subtotal, new_subtotal);
    ELSIF position('greatest(product.price_amount,coalesce(product.compare_at_price,product.price_amount))' IN definition) > 0 THEN
      RAISE EXCEPTION 'Order RPC compare-at subtotal differs from reviewed source';
    END IF;

    IF position('campaign_active:=true' IN definition) > 0 AND position(guard_marker IN definition) = 0 THEN
      RAISE EXCEPTION 'Campaign rejection guard was not installed';
    END IF;
    IF position('greatest(product.price_amount,coalesce(product.compare_at_price,product.price_amount))' IN definition) > 0 THEN
      RAISE EXCEPTION 'Compare-at subtotal fallback remains enabled';
    END IF;
    EXECUTE definition;
  END LOOP;
END
$retire_campaign$;

NOTIFY pgrst, 'reload schema';
COMMIT;
