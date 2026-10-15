-- Campaign totals remain separate from catalog prices. Only the existing
-- service-only quote/create RPCs are extended; grants and RLS are unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $campaign$
DECLARE definition text; updated text; old text; replacement text;
BEGIN
  SELECT pg_get_functiondef('public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'::regprocedure)
    INTO definition;
  IF definition IS NULL THEN RAISE EXCEPTION 'Payment order RPC is missing'; END IF;

  old := 'sale_minor bigint; shipping_minor bigint; quantity integer; count_items integer:=0;';
  replacement := 'sale_minor bigint; shipping_minor bigint; quantity integer; count_items integer:=0; base_minor bigint; unit_discount_minor bigint; campaign_active boolean:=false; campaign_rate integer:=0;';
  IF position(replacement IN definition)=0 THEN
    IF position(old IN definition)=0 THEN RAISE EXCEPTION 'Payment RPC declaration differs from reviewed source'; END IF;
    definition := replace(definition, old, replacement);
  END IF;

  old := 'snapshot:=p_legal->''order_summary'';';
  replacement := old || E'\n  IF snapshot ? ''campaign'' THEN\n    IF jsonb_typeof(snapshot->''campaign'') IS DISTINCT FROM ''object'' OR nullif(btrim(snapshot->''campaign''->>''id''),'''') IS NULL\n      OR nullif(btrim(snapshot->''campaign''->>''name''),'''') IS NULL OR jsonb_typeof(snapshot->''campaign''->''rateBasisPoints'') IS DISTINCT FROM ''number''\n      OR (snapshot->''campaign''->>''rateBasisPoints'')::numeric<>trunc((snapshot->''campaign''->>''rateBasisPoints'')::numeric) THEN RAISE EXCEPTION ''invalid campaign snapshot''; END IF;\n    campaign_rate:=(snapshot->''campaign''->>''rateBasisPoints'')::integer;\n    IF campaign_rate NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION ''invalid campaign rate''; END IF;\n    campaign_active:=true;\n  END IF;';
  IF position('campaign_active:=true' IN definition)=0 THEN
    IF position(old IN definition)=0 THEN RAISE EXCEPTION 'Payment RPC snapshot point differs from reviewed source'; END IF;
    definition := replace(definition, old, replacement);
  END IF;

  old := 'sale_minor:=round(product.price_amount*100)::bigint;';
  replacement := 'base_minor:=round(product.price_amount*100)::bigint; unit_discount_minor:=CASE WHEN campaign_active THEN round(base_minor*campaign_rate/10000.0)::bigint ELSE 0 END; sale_minor:=base_minor-unit_discount_minor;';
  IF position('base_minor-unit_discount_minor' IN definition)=0 THEN
    IF position(old IN definition)=0 THEN RAISE EXCEPTION 'Payment RPC price point differs from reviewed source'; END IF;
    definition := replace(definition, old, replacement);
  END IF;

  old := 'OR round((line->>''unitPrice'')::numeric*100)::bigint IS DISTINCT FROM sale_minor THEN RAISE EXCEPTION ''quote changed''; END IF;';
  replacement := E'OR round((line->>''unitPrice'')::numeric*100)::bigint IS DISTINCT FROM sale_minor\n      OR (campaign_active AND (round((line->>''normalUnitPrice'')::numeric*100)::bigint IS DISTINCT FROM base_minor\n        OR round((line->>''discountAmount'')::numeric*100)::bigint IS DISTINCT FROM unit_discount_minor*quantity)) THEN RAISE EXCEPTION ''quote changed''; END IF;';
  IF position('unit_discount_minor*quantity' IN definition)=0 THEN
    IF position(old IN definition)=0 THEN RAISE EXCEPTION 'Payment RPC line verification differs from reviewed source'; END IF;
    definition := replace(definition, old, replacement);
  END IF;

  old := 'subtotal_minor:=subtotal_minor+round(greatest(product.price_amount,coalesce(product.compare_at_price,product.price_amount))*100)::bigint*quantity;';
  replacement := 'subtotal_minor:=subtotal_minor+(CASE WHEN campaign_active THEN base_minor ELSE round(greatest(product.price_amount,coalesce(product.compare_at_price,product.price_amount))*100)::bigint END)*quantity;';
  IF position('CASE WHEN campaign_active THEN base_minor' IN definition)=0 THEN
    IF position(old IN definition)=0 THEN RAISE EXCEPTION 'Payment RPC subtotal point differs from reviewed source'; END IF;
    definition := replace(definition, old, replacement);
  END IF;

  old := 'OR round((snapshot->>''total'')::numeric*100)::bigint IS DISTINCT FROM total_minor+shipping_minor THEN RAISE EXCEPTION ''total mismatch''; END IF;';
  replacement := E'OR round((snapshot->>''total'')::numeric*100)::bigint IS DISTINCT FROM total_minor+shipping_minor\n    OR (campaign_active AND round((snapshot->''campaign''->>''discountAmount'')::numeric*100)::bigint IS DISTINCT FROM subtotal_minor-total_minor) THEN RAISE EXCEPTION ''total mismatch''; END IF;';
  IF position('snapshot->''campaign''->>''discountAmount''' IN definition)=0 THEN
    IF position(old IN definition)=0 THEN RAISE EXCEPTION 'Payment RPC total verification differs from reviewed source'; END IF;
    definition := replace(definition, old, replacement);
  END IF;
  EXECUTE definition;

  SELECT pg_get_functiondef('public.nrs_create_manual_order(uuid,uuid,uuid,text,jsonb,jsonb,jsonb)'::regprocedure)
    INTO definition;
  IF definition IS NULL THEN RAISE EXCEPTION 'Manual order RPC is missing'; END IF;
  old := 'total_minor bigint:=0; subtotal_minor bigint:=0; shipping_minor bigint;';
  replacement := 'total_minor bigint:=0; subtotal_minor bigint:=0; shipping_minor bigint; base_minor bigint; unit_discount_minor bigint; sale_minor bigint; campaign_active boolean:=false; campaign_rate integer:=0;';
  IF position('campaign_rate integer:=0' IN definition)=0 THEN
    IF position(old IN definition)=0 THEN RAISE EXCEPTION 'Manual order RPC declaration differs from reviewed source'; END IF;
    definition := replace(definition, old, replacement);
  END IF;
  old := 'snapshot:=p_legal->''order_summary'';';
  replacement := old || E'\n  IF snapshot ? ''campaign'' THEN\n    IF jsonb_typeof(snapshot->''campaign'') IS DISTINCT FROM ''object'' OR nullif(btrim(snapshot->''campaign''->>''id''),'''') IS NULL\n      OR nullif(btrim(snapshot->''campaign''->>''name''),'''') IS NULL OR jsonb_typeof(snapshot->''campaign''->''rateBasisPoints'') IS DISTINCT FROM ''number''\n      OR (snapshot->''campaign''->>''rateBasisPoints'')::numeric<>trunc((snapshot->''campaign''->>''rateBasisPoints'')::numeric) THEN RAISE EXCEPTION ''invalid campaign snapshot''; END IF;\n    campaign_rate:=(snapshot->''campaign''->>''rateBasisPoints'')::integer;\n    IF campaign_rate NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION ''invalid campaign rate''; END IF;\n    campaign_active:=true;\n  END IF;';
  IF position('campaign_active:=true' IN definition)=0 THEN
    IF position(old IN definition)=0 THEN RAISE EXCEPTION 'Manual order RPC snapshot point differs from reviewed source'; END IF;
    definition := replace(definition, old, replacement);
  END IF;
  old := 'IF line->>''productId'' IS DISTINCT FROM product.id';
  replacement := 'base_minor:=round(product.price_amount*100)::bigint; unit_discount_minor:=CASE WHEN campaign_active THEN round(base_minor*campaign_rate/10000.0)::bigint ELSE 0 END; sale_minor:=base_minor-unit_discount_minor;' || E'\n    ' || old;
  IF position('sale_minor:=base_minor-unit_discount_minor' IN definition)=0 THEN
    IF position(old IN definition)=0 THEN RAISE EXCEPTION 'Manual order RPC price verification differs from reviewed source'; END IF;
    definition := replace(definition, old, replacement);
  END IF;
  old := 'OR round((line->>''unitPrice'')::numeric*100)::bigint IS DISTINCT FROM round(product.price_amount*100)::bigint';
  replacement := E'OR round((line->>''unitPrice'')::numeric*100)::bigint IS DISTINCT FROM sale_minor\n      OR (campaign_active AND (round((line->>''normalUnitPrice'')::numeric*100)::bigint IS DISTINCT FROM base_minor\n        OR round((line->>''discountAmount'')::numeric*100)::bigint IS DISTINCT FROM unit_discount_minor*qty))';
  IF position('unit_discount_minor*qty' IN definition)=0 THEN
    IF position(old IN definition)=0 THEN RAISE EXCEPTION 'Manual order RPC line verification differs from reviewed source'; END IF;
    definition := replace(definition, old, replacement);
  END IF;
  old := 'total_minor:=total_minor+round(product.price_amount*100)::bigint*qty;';
  replacement := 'total_minor:=total_minor+sale_minor*qty;';
  IF position('total_minor:=total_minor+sale_minor*qty;' IN definition)=0 THEN
    IF position(old IN definition)=0 THEN RAISE EXCEPTION 'Manual order RPC total point differs from reviewed source'; END IF;
    definition := replace(definition, old, replacement);
  END IF;
  old := 'subtotal_minor:=subtotal_minor+round(greatest(product.price_amount,coalesce(product.compare_at_price,product.price_amount))*100)::bigint*qty;';
  replacement := 'subtotal_minor:=subtotal_minor+(CASE WHEN campaign_active THEN base_minor ELSE round(greatest(product.price_amount,coalesce(product.compare_at_price,product.price_amount))*100)::bigint END)*qty;';
  IF position('CASE WHEN campaign_active THEN base_minor' IN definition)=0 THEN
    IF position(old IN definition)=0 THEN RAISE EXCEPTION 'Manual order RPC subtotal point differs from reviewed source'; END IF;
    definition := replace(definition, old, replacement);
  END IF;
  old := 'OR round((snapshot->>''total'')::numeric*100)::bigint IS DISTINCT FROM total_minor+shipping_minor THEN RAISE EXCEPTION ''total mismatch''; END IF;';
  replacement := E'OR round((snapshot->>''total'')::numeric*100)::bigint IS DISTINCT FROM total_minor+shipping_minor\n    OR (campaign_active AND round((snapshot->''campaign''->>''discountAmount'')::numeric*100)::bigint IS DISTINCT FROM subtotal_minor-total_minor) THEN RAISE EXCEPTION ''total mismatch''; END IF;';
  IF position('snapshot->''campaign''->>''discountAmount''' IN definition)=0 THEN
    IF position(old IN definition)=0 THEN RAISE EXCEPTION 'Manual order RPC total verification differs from reviewed source'; END IF;
    definition := replace(definition, old, replacement);
  END IF;
  EXECUTE definition;
END
$campaign$;

NOTIFY pgrst,'reload schema';
COMMIT;
