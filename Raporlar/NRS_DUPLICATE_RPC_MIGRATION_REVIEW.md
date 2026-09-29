# NRS Duplicate RPC Migration — Uygulama Öncesi İnceleme

## Sonuç

Migration dosyası depodaki ürün/kategori/koleksiyon şemasıyla ve önceki salt okunur canlı kolon kontrolleriyle uyumlu. RPC henüz canlı Supabase şema önbelleğinde görünmüyor (`PGRST202`); bu migration bu nedenle SQL Editor’da uygulanmalıdır. Migration bu inceleme sırasında çalıştırılmadı ve kod değiştirilmedi.

## Schema uyumu

Önceki salt okunur canlı REST sorguları aşağıdaki alanları doğruladı:

- `products.id` ve `product_variants.product_id`: TEXT
- `product_variants.id`, `product_images.id`, `categories.id`, `product_collections.collection_id`: UUID
- `products.category_id`: UUID
- `product_variants`: `size`, `sku`, `stock_quantity`, `is_active`, `created_at`, `updated_at`
- `product_images`: `provider`, `storage_key`, `url`, `alt_text`, `sort_order`, `is_primary`, `created_at`
- `product_collections`: `product_id`, `collection_id`, `created_at`
- `collections`: `id`, `is_active` ve mevcut tanımda kullanılan sıralama/açıklama alanları

RPC’nin INSERT kolonları bu şemayla eşleşiyor. Migration `stock` yerine doğru kolon olan `stock_quantity` kullanıyor. Ürün ID’si mevcut create akışıyla uyumlu biçimde benzersiz TEXT slug olarak üretiliyor. Variant ve image ID’leri `gen_random_uuid()` ile oluşturuluyor.

Canlı tablo kolonları REST üzerinden doğrulandı. Constraint ve policy metadata’sının tamamı anon REST ile okunamadığından bunlar kaynak migration’larla karşılaştırıldı: products slug unique; variant SKU unique, `(product_id, size)` unique ve stok `>= 0`; image’larda ürün başına tek primary partial unique index; product/variant/image admin policy’leri `nrs_is_active_admin()` kullanıyor. Product-collection admin policy’si ilgili migration’da aynı helper ile tanımlı.

## RPC ve güvenlik

- İmzalı fonksiyon: `public.nrs_duplicate_product(p_source_product_id text)` — **PASS**
- Dil/dönüş: `plpgsql`, `jsonb`
- `search_path = ''` ayarlı.
- Fonksiyon `SECURITY DEFINER` değildir; PostgreSQL varsayılanı olan **SECURITY INVOKER** ile çalışır. Böylece çağıranın RLS kuralları yürürlükte kalır.
- `auth.uid()` ve `public.nrs_is_active_admin()` kontrolü zorunlu.
- `PUBLIC` ve `anon` için execute yetkisi kaldırılıyor; `authenticated` rolüne veriliyor.
- Mevcut `requireAdmin()` server action kontrolü de korunuyor.

Admin authorization: **PASS**

## Kopyalama ve transaction davranışı

RPC tek çağrıda ürün, varyant, görsel ve koleksiyon ilişkilerini oluşturuyor. Herhangi bir SQL hatası aşama adı ve SQL hata alanlarıyla yeniden fırlatılıyor; RPC başarısız olursa PostgreSQL çağrı transaction’ı geri alır. Kaynak ürün satırı `FOR UPDATE` ile okunur, ancak kaynak üründe UPDATE/DELETE yapılmaz.

- Ürün: düzenlenebilir mevcut kolonlar kopyalanır; `id` ve `slug` yeni/benzersizdir; `status = 'draft'`; tarih alanları kopyalanmaz.
- Variant: yeni UUID ve yeni product ID; `size`, `stock_quantity`, `is_active` korunur. `sku` NULL değilse benzersiz bir `-COPY-<uuid>` ekiyle yeniden üretilir.
- Görsel: yeni UUID ve yeni product ID; `provider`, `storage_key`, `url`, `alt_text`, `sort_order`, `is_primary` korunur. Storage dosyası fiziksel olarak kopyalanmaz.
- Koleksiyon: yeni product ID ve mevcut collection UUID’leri kullanılır.

Sonuçlar:

- Atomic transaction: **PASS**
- Variant duplication: **PASS**
- Image duplication: **PASS**
- Collection duplication: **PASS**
- Draft status: **PASS**
- Orijinal ürünü değiştirmeme: **PASS** (RPC işlemlerinde kaynak için yalnızca SELECT/row lock yapılır)

## Migration sırası

Dosya adlarına göre beklenen sıra:

1. `20260928000000_admin_users.sql`
2. `20260928120000_product_database_foundation.sql`
3. `20260928130000_admin_panel_access.sql`
4. `20260928140000_product_image_storage.sql`
5. `20260928150000_collections_product_collections.sql`
6. `20260928170000_duplicate_product_rpc.sql`

Migration başındaki guard `nrs_is_active_admin()`, products, variants, images ve product_collections tablolarının mevcut olmasını zorunlu kılar. `product_collections.collection_id` foreign key’i collections tablosunun kurulu olmasını da gerektirir.

## Test durumu

- Migration schema uyumu: **PASS**
- RPC signature: **PASS** (dosyadaki bildirim; canlıda henüz bulunmuyor)
- Admin authorization: **PASS**
- Atomic transaction: **PASS**
- Variant duplication: **PASS**
- Image duplication: **PASS**
- Collection duplication: **PASS**
- Draft status: **PASS**
- TypeScript: **PASS** (son kod değişikliği sonrası `npx tsc --noEmit --incremental false`)
- Build: **PASS** (son kod değişikliği sonrası `npm run build`)

Fonksiyon canlıda henüz bulunmadığı için gerçek duplicate akışı bu incelemede çalıştırılmadı. Önceki canlı RPC sorgusu `PGRST202` verdi. Gerçek ürün verisi oluşturulmadı.

## Uygulama

Migration SQL Editor’da çalıştırılmaya hazırdır:

`supabase/migrations/20260928170000_duplicate_product_rpc.sql`

Bu incelemede migration **uygulanmadı**. Uygulama sonrasında RPC canlı şema önbelleğinde görünmeli; gerekirse PostgREST schema cache yenilenmelidir.
