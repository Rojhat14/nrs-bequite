#!/usr/bin/env python3
"""Compare Supabase query output to every authored product translation without printing content."""
import glob
import hashlib
import json
import sys
import unicodedata


def source_hash(source):
    fields = [unicodedata.normalize("NFC", source.get(key) or "") for key in ("name", "description", "fabric", "care")]
    encoded = json.dumps(fields, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def source_checksum(rows):
    chunks = []
    for row in sorted(rows, key=lambda item: item["id"]):
        fields = [row.get(key) or "" for key in ("id", "name", "description", "fabric", "care")]
        chunks.append("".join(f"{len(value.encode('utf-8'))}:{value}" for value in fields))
    return hashlib.md5(" ".join(chunks).encode("utf-8")).hexdigest()


snapshot = json.load(open(".product-source-query.json", encoding="utf-8"))
products = {row["id"]: row for row in snapshot["rows"] if row.get("status") == "active" and row.get("payment_test_only") is False}
translations = {}
for path in glob.glob("src/data/product-translations/batch-*.json"):
    translations.update(json.load(open(path, encoding="utf-8")))

result = json.load(sys.stdin)
rows = result.get("rows", [])
source_checksums = {row.get("catalog_checksum") for row in rows}
source_counts = {row.get("catalog_count") for row in rows}
if source_checksums != {source_checksum(list(products.values()))} or source_counts != {79}:
    print("FAIL: current active product source differs from the translation snapshot.", file=sys.stderr)
    raise SystemExit(1)

seen = set()
issues = []
for row in rows:
    key = (row["entity_id"], row["locale"])
    if key in seen:
        issues.append("duplicate database product/locale pair")
    seen.add(key)
    source = products.get(row["entity_id"])
    expected = translations.get(row["entity_id"], {}).get(row["locale"])
    if not source or not expected:
        issues.append("unexpected or inactive product translation")
        continue
    if row["source_hash"] != source_hash(source):
        issues.append("stale or mismatched source hash")
    if row["payload"] != expected:
        issues.append("stored payload differs from authored translation")

for locale in ("en", "ar"):
    locale_rows = [row for row in rows if row["locale"] == locale]
    if len(locale_rows) != 79 or len({row["entity_id"] for row in locale_rows}) != 79:
        issues.append(f"{locale} is not exactly 79 unique product rows")
if len(rows) != 158 or len(seen) != 158:
    issues.append("database did not return exactly 158 unique product/locale pairs")
if issues:
    print("FAIL:", "; ".join(sorted(set(issues))), file=sys.stderr)
    raise SystemExit(1)

with open(".product-translation-readback.json", "w", encoding="utf-8") as stream:
    json.dump(rows, stream, ensure_ascii=False, separators=(",", ":"))

print("PASS: database readback exactly matches all 158 authored translations and source hashes.")
print("PASS: EN 79/79, AR 79/79; unique product/locale pairs 158/158; active non-test product source 79/79 unchanged.")
