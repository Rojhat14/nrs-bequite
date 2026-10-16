#!/usr/bin/env python3
"""Build an idempotent product-translation upsert from the authored batches and catalog snapshot."""
import glob
import hashlib
import json
import os
import sys
import unicodedata


source_path = sys.argv[1] if len(sys.argv) > 1 else ".product-source-query.json"
source_rows = json.load(open(source_path, encoding="utf-8"))["rows"]
sources = {row["id"]: row for row in source_rows if row.get("status") == "active" and row.get("payment_test_only") is False}
translations = {}
for path in sorted(glob.glob("src/data/product-translations/batch-*.json")):
    translations.update(json.load(open(path, encoding="utf-8")))
if set(sources) != set(translations) or len(sources) != 79:
    raise SystemExit("Refusing to build seed: catalog/batch product IDs do not match exactly 79 products.")

records = []
for product_id in sorted(sources):
    source = sources[product_id]
    source_fields = [unicodedata.normalize("NFC", source.get(key) or "") for key in ("name", "description", "fabric", "care")]
    source_hash = hashlib.sha256(json.dumps(source_fields, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()
    for locale in ("en", "ar"):
        payload = translations[product_id][locale]
        records.append({
            "entity_id": product_id,
            "locale": locale,
            "source_hash": source_hash,
            "payload": payload,
        })

json_rows = json.dumps(records, ensure_ascii=False, separators=(",", ":"))
sql = f"""-- Idempotent product translations for the currently verified 79 active catalog products.
-- Generated from src/data/product-translations/batch-*.json; hashes follow productSourceHash().
BEGIN;
INSERT INTO public.storefront_translations (entity_type, entity_id, locale, source_hash, payload, updated_at)
SELECT 'product', incoming.entity_id, incoming.locale, incoming.source_hash, incoming.payload, now()
FROM jsonb_to_recordset($product_translation_rows${json_rows}$product_translation_rows$::jsonb)
  AS incoming(entity_id text, locale text, source_hash text, payload jsonb)
ON CONFLICT (entity_type, entity_id, locale) DO UPDATE SET
  source_hash = EXCLUDED.source_hash,
  payload = EXCLUDED.payload,
  updated_at = now()
WHERE public.storefront_translations.source_hash IS DISTINCT FROM EXCLUDED.source_hash
   OR nullif(btrim(public.storefront_translations.payload->>'name'), '') IS NULL
   OR nullif(btrim(public.storefront_translations.payload->>'description'), '') IS NULL
   OR public.storefront_translations.payload->>'fabric' IS NULL
   OR (EXCLUDED.payload->>'fabric' <> '' AND nullif(btrim(public.storefront_translations.payload->>'fabric'), '') IS NULL)
   OR public.storefront_translations.payload->>'care' IS NULL
   OR (EXCLUDED.payload->>'care' <> '' AND nullif(btrim(public.storefront_translations.payload->>'care'), '') IS NULL);
COMMIT;
"""
output = sys.argv[2] if len(sys.argv) > 2 else "supabase/seeds/product-translations.sql"
os.makedirs(os.path.dirname(output), exist_ok=True)
with open(output, "w", encoding="utf-8") as stream:
    stream.write(sql)
print(f"Wrote repeatable upsert for {len(records)} product/locale rows to {output}")
