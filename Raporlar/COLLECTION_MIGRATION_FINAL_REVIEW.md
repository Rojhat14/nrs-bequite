# Koleksiyon RLS Migration Güvenlik İncelemesi

## İncelenen durum

- Repository'deki migration sırası: `20260928000000_admin_users.sql`, `20260928120000_product_database_foundation.sql`, `20260928130000_admin_panel_access.sql`, `20260928140000_product_image_storage.sql`, ardından hedef `20260928150000_collections_product_collections.sql`.
- Repository'de `collections` veya `product_collections` tablolarını önceden oluşturan başka bir migration yok. `supabase/seeds/20260928_product_catalog_seed.sql` ürün/kategori/görsel ekler; koleksiyon örnek kayıtlarını içermez.
- Canlı Supabase migration ledger'ına veya katalog metadata'sına bu incelemede erişilmedi. Tabloların ve belirtilen yedi koleksiyon kaydının canlı ortamda mevcut olduğu kullanıcı beyanı olarak alındı; bağımsız doğrulanmadı.

## Güvenlik sonucu

- Hedef migration artık tablo oluşturma/silme, FK ekleme/silme, seed, INSERT, UPDATE veya DELETE yapmıyor.
- Başlangıçta `collections`, `product_collections`, `products`, `nrs_is_active_admin()` ve gereken kolonların varlığını doğruluyor.
- İki mevcut cascade FK'yi constraint adına bağlı olmadan doğruluyor. Bir FK eksik veya `ON DELETE CASCADE` değilse migration hata verip duruyor; mevcut FK'yi değiştirmiyor.
- RLS'yi etkinleştirip eksik public aktif-okuma ve admin policy'lerini ekliyor. Ek restrictive policy'ler mevcut permissive policy'lerin OR birleşmesiyle anon veya admin olmayan authenticated kullanıcıya yazma/ekstra okuma izni açılmasını engelliyor.
- Policy eklemeleri isim kontrolüyle tekrar çalıştırmaya uygun; var olan koleksiyon satırlarına dokunmuyor. Grants yalnızca gereken SELECT ve authenticated CRUD izinlerini ekliyor.

## Sonuçlar

1. **Migration güvenli mi?** Dosya düzeyinde tablo/veri/FK bakımından additive ve korumacı hale getirildi. Canlı şema ve policy'ler okunamadığı için gerçek Supabase durumu hakkında mutlak güvenlik onayı verilemez.
2. **Değiştirilen bölüm:** Önceki `CREATE TABLE IF NOT EXISTS` blokları, FK ekleyen blok ve yalnızca permissive policy'lere dayalı bölüm kaldırılarak tablo/kolon/FK ön kontrolü ve idempotent RLS tamamlama bölümleri kondu. FK'ler artık eklenmiyor veya yeniden oluşturulmuyor.
3. **SQL Editor'da çalıştırılabilir mi?** Evet, beklenen tablolar/kolonlar, admin helper ve iki cascade FK mevcutsa çalışacak şekilde hazırlandı. Ön kontrollerden biri tutmazsa güvenli biçimde exception ile durur. Canlı policy ve migration ledger'ı ayrıca kontrol edilmeden uygulamayın; mevcut yedi koleksiyon kaydını bu SQL değiştirmez.

## Doğrulama

- `npx tsc --noEmit --incremental false`: başarılı (çıkış kodu 0).
- Migration Supabase'e uygulanmadı; canlı veritabanına sorgu veya mutation yapılmadı.
