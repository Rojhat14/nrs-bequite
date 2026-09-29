# NRS Storefront Supabase Entegrasyonu Raporu

## 1. Değiştirilen ve eklenen dosyalar

- `src/lib/products.ts` — storefront için server-side Supabase data access katmanı.
- `src/data/products.ts` — Supabase ürünleri için genişletilmiş tipler; mevcut ürün dizisi fallback olarak korundu.
- `src/app/page.tsx` ve `src/components/HomePageContent.tsx` — ana sayfa Supabase ürün listesini kullanıyor.
- `src/components/Collection.tsx`, `src/components/Hero.tsx`, `src/components/ProductShowcase.tsx` — mevcut ürün kartı/vitrin düzeni Supabase'den gelen ürünlerle çalışıyor.
- `src/app/category/[slug]/page.tsx` — kategori slug'ı ve ürünleri Supabase'den alıyor.
- `src/app/collections/page.tsx`, `src/app/collections/[slug]/page.tsx`, `src/components/CollectionListing.tsx` — aktif koleksiyon listesi ve koleksiyon ürünleri.
- `src/components/CategoryHero.tsx` — kategori hero animasyonlarını client component sınırında tutar; server page içindeki `motion.img` manifest hatasını önler.
- `src/app/product/[id]/page.tsx`, `src/components/ProductDetail.tsx`, `src/components/ProductCard.tsx` — slug/ID ile ürün detayları, görseller ve varyantlar.
- `src/app/layout.tsx`, `src/components/StorefrontShell.tsx`, `src/components/Navigation.tsx`, `src/context/StorefrontCatalogContext.tsx` — aktif kategori/koleksiyonların mevcut navigasyon tasarımında sunulması.

Bu rapor mevcut çalışma ağacındaki diğer değişiklikleri sahiplenmez; listede bu storefront entegrasyonu için dokunulan dosyalar bulunur.

## 2. Supabase'den gelen veriler

Server-side data layer aktif ürünleri (`status = active`), aktif kategorileri ve koleksiyonları okuyor. Ürünler için kategori adı, `product_collections` ilişkileri, aktif varyantlar ve `product_images` kayıtları da yükleniyor. Katalog sorguları `createSupabaseServerClient()` kullanıyor; service role anahtarı kullanılmıyor.

Kategori yolları Türkçe canonical slug'ları kullanıyor; eski İngilizce kategori alias'ları da mevcut route uyumluluğu için eşleniyor. Görsel URL'leri var olan `getProductImageUrl()` helper'ıyla üretiliyor. URL doğrudan `product_images.url` içinde bulunuyorsa korunuyor; storage kaydıysa mevcut Supabase Storage helper'ı kullanılıyor.

## 3. Route'lar

- Kategori: `/category/[slug]` (ör. `/category/elbiseler`, `/category/ust-giyim`, `/category/ceketler-blazerlar`, `/category/alt-giyim`, `/category/takimlar`).
- Koleksiyon dizini: `/collections`.
- Koleksiyon detayı: `/collections/[slug]` (yedi aktif slug: `yeni-gelenler`, `gunduz`, `gece`, `davet`, `imza`, `seckiler`, `indirim`). Ürün ilişkileri `product_collections` üzerinden bulunuyor ve yalnızca aktif ürünler gösteriliyor.
- Ürün detayı: mevcut `/product/[id]` route'u korundu; önce slug, ardından eski ürün ID'si aranıyor.

Kategori/koleksiyon başlıkları için dinamik metadata eklendi. Boş kategori ve koleksiyonlar mevcut görsel dile uygun kısa empty state gösteriyor.

## 4. Fallback ve sınırlar

`src/data/products.ts` kaldırılmadı; mevcut ID'ler ve storefront'un çalışması için Supabase sorgusu hata verdiğinde fallback olarak kullanılıyor. Supabase sorgusu başarılı ama boş ürün döndürürse eski ürünler yayına alınmış gibi gösterilmiyor. Ürün detayında veritabanında bulunmayan aktif ürün için not-found davranışı uygulanıyor.

Profil wishlist ekranı ve ödeme/checkout akışları bu değişikliğin kapsamı dışında bırakıldı. Database bağlantısı runtime'da gerçek Supabase projesi üzerinden ayrıca tarayıcıda doğrulanmadı.

## 5. Doğrulama

- `npx tsc --noEmit --incremental false` — başarılı.
- `npm run build` — başarılı; tüm App Router sayfaları üretildi.
- Kategori route'undaki Framer Motion bileşenleri server page'den `CategoryHero` client component'ine taşındı. Bu, React Client Manifest'teki `motion#img` hatasını giderir.
- Önceki build'de `src/components/ProductDetail.tsx` içindeki iki `<img>` için optimizasyon uyarısı görülmüştü; son build tamamlandı.

Bu çalışma sırasında migration, seed veya Supabase veri değişikliği çalıştırılmadı.
