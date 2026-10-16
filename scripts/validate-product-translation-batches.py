#!/usr/bin/env python3
"""Validate the authored EN/AR product translations against a fresh catalog snapshot."""
import glob
import json
import re
import sys
import unicodedata


def fail(message):
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


source_path = sys.argv[1] if len(sys.argv) > 1 else ".product-source-query.json"
rows = json.load(open(source_path, encoding="utf-8"))["rows"]
active = {row["id"]: row for row in rows if row.get("status") == "active" and row.get("payment_test_only") is False}
if len(active) != 79:
    fail(f"expected 79 active, non-test products; found {len(active)}")

translations = {}
batch_sizes = []
for path in sorted(glob.glob("src/data/product-translations/batch-*.json")):
    batch = json.load(open(path, encoding="utf-8"))
    batch_sizes.append((path, len(batch)))
    if not 10 <= len(batch) <= 15:
        fail(f"{path} has {len(batch)} products; batches must contain 10–15")
    for product_id, locales in batch.items():
        if product_id in translations:
            fail(f"duplicate product ID across batches: {product_id}")
        translations[product_id] = locales

if set(translations) != set(active):
    fail(f"catalog/batch ID mismatch; missing={sorted(set(active)-set(translations))}, extra={sorted(set(translations)-set(active))}")

preserved_names = {"Marco Miotti"}
for product_id, source in active.items():
    for locale in ("en", "ar"):
        payload = translations[product_id].get(locale)
        if not isinstance(payload, dict):
            fail(f"{product_id}/{locale} missing")
        if set(payload) != {"name", "description", "fabric", "care"}:
            fail(f"{product_id}/{locale} has missing or unexpected payload fields")
        for field in ("name", "description", "fabric", "care"):
            translated = payload[field]
            original = source.get(field) or ""
            if not isinstance(translated, str):
                fail(f"{product_id}/{locale}/{field} is not text")
            if original and not translated.strip():
                fail(f"{product_id}/{locale}/{field} is blank for a populated source")
            if not original and translated:
                fail(f"{product_id}/{locale}/{field} invents text where the source is empty")
            if original and translated.strip() == original.strip() and original not in preserved_names:
                fail(f"{product_id}/{locale}/{field} is an untranslated source copy")
        # Numeric measurements, dimensions, percentages and quantities must be retained.
        numbers = re.findall(r"\d+(?:[.,x×]\d+)*%?", source.get("description") or "")
        for number in numbers:
            if number not in payload["description"]:
                fail(f"{product_id}/{locale} omits source number {number!r}")
        # Ensure translated strings are NFC, matching product source-hash behavior.
        for field, value in payload.items():
            if value != unicodedata.normalize("NFC", value):
                fail(f"{product_id}/{locale}/{field} is not NFC-normalized")

print(f"PASS: {len(active)} products × 2 locales = {len(translations) * 2} translations")
print("Batches:", ", ".join(f"{path.rsplit('/',1)[-1]}={size}" for path, size in batch_sizes))
print("Every populated source field has a translated counterpart; empty source fields remain empty; numeric description tokens are preserved.")
