# NRS Admin Ürün Koleksiyonu Entegrasyon Raporu

## Değişen dosyalar

- `src/components/admin/AdminProductForm.tsx`
- `src/app/admin/(protected)/actions.ts`
- `src/app/admin/(protected)/products/new/page.tsx`
- `src/app/admin/(protected)/products/[id]/page.tsx`
- `supabase/migrations/20260928150000_collections_product_collections.sql` (hazırlandı, çalıştırılmadı)

## Koleksiyon seçimi ve kayıt

- Formda aktif koleksiyonlar çoklu checkbox olarak gösteriliyor; düzenleme ekranında kayıtlı seçimler işaretli geliyor. Seçimler FormData'ya `collection_ids` adıyla gönderiliyor.
- `saveProduct()` mükerrer ID'leri teke indiriyor, UUID formatını doğruluyor ve seçilen tüm kayıtların aktif olduğunu tek sorguyla kontrol ediyor.
- Ürün INSERT/UPDATE işleminden sonra eski `product_collections` bağlantıları temizlenip yeni seçimler ekleniyor. Seçim boşsa eski bağlantılar temiz kalıyor.
- Server Action başında `requireAdmin()` çalışıyor. Ürün/collection erişimi SSR Supabase client ve RLS üzerinden yapılıyor.

## RLS ve migration

- Repository migration'larında `collections` veya `product_collections` tanımı/policy'si bulunmadı.
- Yeni migration `collections` ve `product_collections` tablolarını, iki `ON DELETE CASCADE` foreign key'ini ve public aktif-okuma/admin CRUD RLS policy'lerini hazırlar. Beklenmeyen önceden var olan policy görürse uygulamayı durdurup manuel inceleme ister.
- Supabase migration veya başka bir database mutation çalıştırılmadı. Migration öncesinde aktif koleksiyon satırlarının (ör. Gece/İmza/Gündüz/Davet) veritabanında mevcut olması gerekir; bu migration örnek koleksiyon verisi seed etmez.

## Kontroller

- `npx tsc --noEmit --incremental false`: başarılı.
- `npm run build`: başarılı.

## Manuel test

1. Migration'ı Supabase'e uygulayıp aktif koleksiyon kayıtlarının mevcut olduğunu doğrulayın.
2. Bir üründe Gece ve İmza'yı seçip kaydedin; `product_collections` tablosunda bu ürüne ait iki satırı kontrol edin.
3. Gece'yi kaldırıp Gündüz'ü seçerek kaydedin; bağlantıların İmza ve Gündüz olarak değiştiğini doğrulayın.
