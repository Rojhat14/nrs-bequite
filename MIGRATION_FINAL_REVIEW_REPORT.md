# NRS Project — Migration Final Review

## A) Admin migration: PASS

Statik incelemede sözdizimi hatası veya normal authenticated kullanıcının kendisini admin yapmasını sağlayan bir yol görülmedi. `authenticated` rolü yalnızca kendi aktif admin kaydını okuyabiliyor; tabloya yazma yetkisi ve yazma policy’si yok.

Migration 2'nin `admin_users` bağımlılığı doğru sırada: Migration 1'den sonra çalışmalı. Migration 1, tablo zaten varsa yeniden çalıştırılmaya uygun değildir.

## B) Product migration: PASS

SQL yapısı, FK'ler, CHECK/UNIQUE constraint'leri, NULL bedenler için ek partial index ve primary image partial unique index'i tutarlı görünüyor. `updated_at` trigger'ları istenen üç tabloda tanımlı.

RLS/grant kombinasyonunda admin olmayan authenticated kullanıcılar yalnızca aktif kategori/ürünleri ve aktif ürünlerin görsel/varyantlarını okuyabilir. Yazma grant'i olsa da INSERT/UPDATE/DELETE için yalnızca admin policy'si bulunduğundan admin olmayan işlemler RLS tarafından reddedilir. Policy'lerin permissive OR birleşiminde bu kontrolleri aşan bir yol görülmedi. Anon rolüne yazma grant'i verilmemiş.

Migration, `admin_users` yoksa veya ürün tablolarından biri mevcutsa hata verip duracak şekilde tasarlanmış. Canlı şema kesin doğrulanamadığından bu koruma yerinde; ancak migration'ı uygulamadan önce tablolar ayrıca doğrulanmalıdır.

## C) Seed: PASS — küçük uyarıyla

Seed dört mevcut ID'yi aynen kullanıyor ve fiyatları doğru numeric değerlere çeviriyor: `8200`, `5400`, `8500`, `7900 TRY`. `Üst Giyim`, `tops` slug'ına eşleniyor; mevcut görsel yolları `url` alanında korunuyor.

Sıralı tekrar çalıştırmada kategoriler ve ürünler conflict kontrolleriyle atlanıyor; aynı görsel URL'leri de tekrar eklenmiyor. Eşzamanlı iki seed çalıştırması için tam idempotency garantisi yok; seed tek seferde, paralel çalıştırmadan uygulanmalı.

Seed beden, SKU veya adet üretmiyor. Mevcut `inStock` boolean değerini `products.in_stock` alanına kopyalıyor; bu, kaynakta bulunan eski bir bayrak, variant stoğu değil. Variant kayıtları eklenmediğinden ürün kullanılabilirliğini variant stoklarından türetmeden önce bu bayrak gözden geçirilmeli.

## D) Migration sırası

```text
Migration 1
20260928000000_admin_users.sql
        ↓
Migration 2
20260928120000_product_database_foundation.sql
        ↓
Seed
20260928_product_catalog_seed.sql
```

## E) Bulunan güvenlik sorunları

**CRITICAL düzeyde RLS açığı tespit edilmedi.** `nrs_is_active_admin()` için `SECURITY DEFINER`, boş `search_path`, `auth.uid()` kontrolü ve nitelikli tablo adı kullanılmış. `PUBLIC` ve `anon` execute yetkisi kapalı; `authenticated` için gereken execute grant'i mevcut. Admin kontrolü `admin_users` tablosuna dayanıyor.

## F) Syntax/logic notları

Statik incelemede belirgin PostgreSQL syntax hatası görülmedi; SQL çalıştırılıp doğrulanmadı. İki migration da mevcut tablo/policy'lerle birlikte tekrar çalıştırılacak şekilde idempotent değil; ürün migration'ı hedef tablo bulursa özellikle durur. Seed sıralı tekrar çalıştırmaya uygundur.

Mevcut kategori URL alias'ları seed'de canonical slug'larla korunuyor. Türkçe alias'ların veritabanı ürün sorgularında da çalışması, storefront geçişinde alias eşlemesinin sürdürülmesine bağlıdır.

## G) Supabase'e uygulamadan önce

- Canlı tabloların varlığını Supabase şema metadata'sından doğrulayın; REST `PGRST205` tek başına yokluk kanıtı değildir.
- Migration 1'in uygulanmış olduğunu ve `admin_users` tablosunun beklenen kolon/policy yapısında bulunduğunu doğrulayın.
- Ürün tabloları mevcutsa Migration 2'yi olduğu gibi çalıştırmayın; önce mevcut şemaya göre uyarlayın.
- Seed'i tek seferde çalıştırın; `in_stock` bayrağını variant envanteriyle uzlaştırmayı planlayın.

## İşlem durumu

Bu incelemede hiçbir dosya değiştirilmedi. Hiçbir migration, seed veya Supabase SQL mutation çalıştırılmadı.
