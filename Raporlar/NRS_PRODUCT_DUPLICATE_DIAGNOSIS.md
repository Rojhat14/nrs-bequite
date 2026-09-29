# NRS Ürün Kopyalama Hatası — Teşhis Raporu

## ROOT CAUSE

Canlı Supabase REST üzerinden duplicate RPC çağrısı şu hatayı döndürdü:

- **HTTP:** 404
- **Code:** `PGRST202`
- **Message:** `Could not find the function public.nrs_duplicate_product(p_source_product_id) in the schema cache`
- **Details:** PostgREST şema önbelleğinde `public.nrs_duplicate_product` fonksiyonu ve `p_source_product_id` parametre imzası bulunamadı.
- **Hint:** `public.nrs_admin_update_order_status` fonksiyonunu önerdi.

Duplicate action yalnızca bu RPC’yi çağırıyor. Fonksiyon şema önbelleğinde bulunamadığı için istek PostgreSQL fonksiyonuna ve herhangi bir INSERT aşamasına ulaşmıyor. Bu, RLS reddi veya variant/image/collection constraint hatası değil. Daha önceki raporda migration’ın uygulanmadığı belirtilmişti; mevcut canlı hata bu bilgiyle tutarlıdır. Fonksiyon uygulanmışsa alternatif olasılık PostgREST şema önbelleğinin henüz yenilenmemiş olmasıdır.

## FAILED STEP

Hata RPC çözümleme aşamasında oluşuyor. `products`, `product_variants`, `product_images` ve `product_collections` yazma aşamalarından hiçbiri başlamıyor.

## CANLI ŞEMA KONTROLÜ

Salt okunur sorgular altı tablonun tamamından HTTP 200 aldı ve aşağıdaki kolon adlarını doğruladı:

- **`products`:** `id`, `name`, `slug`, `category_id`, `description`, `price_amount`, `currency`, `compare_at_price`, `status`, `in_stock`, `fabric`, `care`, `created_at`, `updated_at`
- **`product_variants`:** `id`, `product_id`, `size`, `sku`, `stock_quantity`, `is_active`, `created_at`, `updated_at`
- **`product_images`:** `id`, `product_id`, `provider`, `storage_key`, `url`, `alt_text`, `sort_order`, `is_primary`, `created_at`
- **`product_collections`:** `product_id`, `collection_id`, `created_at`
- **`categories`:** `id`, `name`, `slug`, `description`, `sort_order`, `is_active`, `created_at`, `updated_at`
- **`collections`:** `id`, `name`, `slug`, `description`, `is_active`, `sort_order`, `created_at`, `updated_at`

Salt okunur tip sorguları ürün `id` ve `product_id` alanlarının TEXT olduğunu; variant/image ID’leri ile category/collection ID’lerinin UUID olduğunu doğruladı. Kod `stock` değil, mevcut şemadaki `stock_quantity` kolonunu kullanıyor.

Canlı constraint metadata’sı anon REST erişimiyle alınamadı. Depodaki migration’larda variant SKU’su ve `(product_id, size)` unique; görsel primary kaydı ürün başına partial unique olarak tanımlı. RPC bulunamadığı için bu constraint’lere canlı duplicate çağrısı sırasında erişilmedi.

## RLS

Tespit edilen `PGRST202`, RLS hatası değildir. RPC bulunamadığı için admin yetki kontrolüne veya tablolardaki INSERT policy’lerine ulaşılmıyor. RLS kapatılmadı, public INSERT policy eklenmedi ve admin authorization sistemi değiştirilmedi.

## YAPILAN KOD DEĞİŞİKLİKLERİ

- Server action geliştirme ortamında Supabase hata `code`, `message`, `details` ve `hint` değerlerini terminale yazdıracak şekilde güncellendi. Kullanıcıya gösterilen genel hata mesajı korundu.
- Duplicate RPC migration’ına `products`, `variants`, `images` ve `collections` aşama adları; hata alanları ve tamamlanmış aşamaları taşıyan hata yakalama eklendi.
- Başarılı RPC yanıtı tamamlanan aşamaları içeriyor; geliştirme server terminalinde her biri `PASS` olarak loglanıyor.

## YARIM KAYITLAR

Mevcut duplicate action RPC bulunamadığı için başarısız çağrıda hiçbir INSERT gerçekleşmedi; bu çağrıdan kaynaklı yarım duplicate oluşmadı. `111111111` ürününe dokunulmadı. Anon REST draft kayıtları göstermediğinden bütün taslak ürünler ayrıca envanterlenemedi.

## TEST SONUÇLARI

- Product duplicate: **BLOCKED** — Canlı RPC bulunamadı.
- Variants: **BLOCKED** — Duplicate akışı INSERT aşamasına ulaşmadı.
- Images: **BLOCKED** — Duplicate akışı INSERT aşamasına ulaşmadı.
- Collections: **BLOCKED** — Duplicate akışı INSERT aşamasına ulaşmadı.
- Draft status: **Migration kodunda tanımlı; canlı akış testi yapılmadı.**
- Original isolation: **Canlı duplicate testi yapılmadı.**
- `npx tsc --noEmit --incremental false`: **PASS**
- `npm run build`: **PASS**
- `git diff --check`: **PASS**

## GEREKLİ SONRAKİ ADIM

`supabase/migrations/20260928170000_duplicate_product_rpc.sql` dosyasını Supabase SQL Editor’da, ön koşul olan admin, ürün, görsel ve koleksiyon migration’larından sonra uygulayın. Bu rapor hazırlanırken migration çalıştırılmadı ve Supabase verisi/şeması değiştirilmedi. Migration uygulandıktan sonra RPC tekrar test edilmeli; gerekirse PostgREST şema önbelleği yenilenmelidir. Ardından gerçek admin oturumuyla duplicate ve ürünler arası izolasyon testleri yapılabilir.
