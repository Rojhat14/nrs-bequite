# NRS Product Database Foundation — Phase 2 Report

## 1. Product-related tables found

Repository review found no existing migration that creates `categories`, `products`, `product_images`, or `product_variants`. The only existing migration is the Phase 1 `admin_users` migration.

The read-only Supabase JS REST checks returned HTTP 404 / `PGRST205` for all four requested table names. This response alone does not prove that the tables do not exist in the live database. No Supabase CLI, direct Postgres client/configuration, or accessible schema metadata source was available, so the live table inventory remains **unconfirmed**. The new migration includes a preflight guard that stops if any target table already exists, instead of silently reusing or replacing it.

## 2. New migration file

`supabase/migrations/20260928120000_product_database_foundation.sql`

This file is prepared for review only. It requires `public.admin_users` to exist first and aborts if any of the four product tables already exists. It has not been executed.

## 3. Tables and columns

### `public.categories`

`id uuid`, `name text`, `slug text`, `description text`, `sort_order integer`, `is_active boolean`, `created_at timestamptz`, `updated_at timestamptz`.

### `public.products`

`id text`, `name text`, `slug text`, `category_id uuid`, `description text`, `price_amount numeric(12,2)`, `currency text`, `compare_at_price numeric(12,2)`, `status text`, `in_stock boolean`, `fabric text`, `care text`, `created_at timestamptz`, `updated_at timestamptz`.

`status` is constrained to `draft`, `active`, or `archived`. No `stock_quantity` column is added to products.

### `public.product_variants`

`id uuid`, `product_id text`, `size text`, `sku text`, `stock_quantity integer`, `is_active boolean`, `created_at timestamptz`, `updated_at timestamptz`.

### `public.product_images`

`id uuid`, `product_id text`, `provider text`, `storage_key text`, `url text`, `alt_text text`, `sort_order integer`, `is_primary boolean`, `created_at timestamptz`.

## 4. PK/FK/UNIQUE/INDEX structure

- Primary keys: category UUID, product TEXT ID, variant UUID, image UUID.
- Products reference categories by nullable `category_id`.
- Variants and images reference `products.id` with `ON DELETE CASCADE`.
- `categories.slug`, `products.slug`, and nullable `product_variants.sku` are unique.
- Variants have `UNIQUE (product_id, size)` and a partial unique index on `product_id WHERE size IS NULL`. The latter closes PostgreSQL's default allowance for multiple NULLs in a unique constraint.
- Variant `stock_quantity` has a nonnegative check.
- Images have a partial unique index on `product_id WHERE is_primary = true`, allowing at most one primary image per product.
- Supporting indexes cover active category ordering, active product/category lookup, product variants, and product image ordering.

## 5. Updated-at behavior

A single `nrs_set_product_catalog_updated_at()` trigger function updates `updated_at` on updates to categories, products, and variants. No trigger is added to product images because that table has no `updated_at` column.

## 6. RLS and admin policy design

RLS is enabled on all four tables. Anonymous and authenticated users can read active categories and active products; product images and variants are readable only when their parent product is active. Authenticated active admins receive CRUD policies.

Admin checks call `public.nrs_is_active_admin()`, a `SECURITY DEFINER`, `STABLE` function with an empty `search_path` and fully qualified object names. It checks the caller's `auth.uid()` against `admin_users`, avoiding a recursive policy read. Function execution is revoked from `PUBLIC` and `anon`, and granted to `authenticated`. Explicit table grants permit public reads and authenticated writes, with RLS remaining the row-level authorization boundary.

The Phase 1 `admin_users` migration must have been applied before this migration. No admin row is created here.

## 7. Four existing product mappings

Seed SQL is separate from the schema migration at `supabase/seeds/20260928_product_catalog_seed.sql`.

| Existing ID | Category mapping | Price (`TRY`) | Current images |
|---|---|---:|---|
| `mavi-ceket-01` | `Üst Giyim` → canonical slug `tops` | 8200.00 | `mavi-ceket.png` primary; `mavi-ceket-2.png` secondary |
| `kirmizi-saten-01` | `Üst Giyim` → `tops` | 5400.00 | `kirmizi-saten.png` primary |
| `bordo-ceket-01` | `Üst Giyim` → `tops` | 8500.00 | `bordo-ceket.png` primary |
| `bordo-detail-01` | `Üst Giyim` → `tops` | 7900.00 | `ceket-kare.png` primary |

The seed includes canonical category slugs `dresses`, `tops`, `blazers`, `bottoms`, `suits`, and `sale`, plus the existing `bedding` and `accessories` categories. Turkish route aliases such as `ust-giyim` continue to resolve to the canonical category in the existing route mapping; no URL or storefront route was changed. Current image paths are preserved as `url` values using provider `next-public`; no Storage upload is performed.

The current products source has only a boolean `inStock` value and has no sizes, SKUs, or quantities. Seed SQL preserves the current boolean but creates **no variant rows** and does not invent stock quantities. Explicit variant inventory must be supplied before variant stock is seeded and before availability is derived from variants.

## 8. Product IDs, wishlist, and orders

Product IDs remain TEXT and the seed uses the exact four existing IDs. No foreign key is added from `wishlist.product_id` or `order_items.product_id` to the new products table. Those tables, their existing data, and their policies were not changed.

## 9. Storefront/admin code changes

No storefront product pages, category pages, `src/data/products.ts`, cart code, payment APIs, wishlist logic, or order logic were changed. The `/admin/products` placeholder description now indicates that the database foundation is ready for the next phase; no CRUD UI was added.

## 10. Migration/database change status

- Product migration executed: **No**.
- Seed executed: **No**.
- Supabase SQL mutation or Storage upload performed: **No**.
- Existing profiles, users, wishlist, orders, order items, and cart data changed: **No**.

## 11. Build

`npm run build`: **Passed**. Next.js production build compiled, completed type validation, generated pages, and included the existing admin routes.

## 12. Remaining risks and prerequisites

- Live existence of the target tables could not be conclusively confirmed from available metadata access. Review the live schema before applying the migration; its preflight guard is intended to abort safely if a target table exists.
- Apply the Phase 1 `admin_users` migration before the product foundation migration.
- Review the separate seed SQL before manually running it. It is idempotent for category/product keys and avoids duplicate source image URLs, but it is intentionally not automatic.
- Before catalog cutover, reconcile the legacy `inStock` flags with explicit size/SKU/quantity data and derive availability from variants.
