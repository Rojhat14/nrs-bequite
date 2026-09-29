# NRS Ürün Görsel Galerisi — Uygulama ve Test Raporu

## 1. Gerçek neden

Canlı `public.product_images` sorgusu `111111111` için **3 kayıt** döndürdü. Her kayıtta `url` ve `storage_key` mevcut; üç Storage public URL'sine yapılan salt-okunur `HEAD` isteklerinin tamamı **HTTP 200** döndü. Kaynak kodunda ürün detay galerisini iki görselle sınırlayan `limit(2)`, `slice(0, 2)` veya eşdeğer bir sınır yoktu. Storefront sorgusu bütün ürün görsellerini alıyordu.

Kullanıcı tarafındaki gerçek eksik, ürün detayında ana fotoğrafın daima ilk görsel olarak sabitlenmesi; sonraki görsellerin tıklanamayan, sabit thumbnail kutuları şeklinde gösterilmesiydi. Bu yüzden görsel seçimi ve galeride gezinme çalışmıyordu. Database veya Storage tarafında kayıt/URL eksilmesi bu ürün için gözlenmedi.

## 2. Yapılan değişiklikler

- `src/components/ProductDetail.tsx`
  - Aktif ana görsel state'i eklendi.
  - Önceki/sonraki okları, loop davranışı ve tıklanabilir bütün thumbnail'lar eklendi.
  - Thumbnail aktif durumu ana görselle eşzamanlı hale getirildi.
  - Galeri odağa alındığında sol/sağ klavye tuşları çalışıyor.
  - Mobil swipe için touch başlangıç/bitiş kontrolü eklendi.
  - Tek bir görsel hata verirse diğer thumbnail'lar kullanılmaya devam eder; hatalı görsel alanında nötr placeholder görünür.
  - Başlangıç ana görseli varsa `is_primary` kaydından seçilir.
- `src/lib/products.ts`
  - Görsel kayıtları `sort_order`, ardından `created_at` ve `id` ile deterministik sıralanıyor.
  - Supabase görsel sorgusu da aynı sıralama alanlarını kullanıyor.
- `NRS_PRODUCT_GALLERY_FIX_REPORT.md`
  - Bu rapor.

Admin upload/API akışına ve Supabase şemasına dokunulmadı. Yükleme kodu her seçili dosyayı ayrı Storage nesnesi ve `product_images` kaydı olarak işliyor; canlı üç kayıt bunu doğruladı.

## 3. Ürün ve render kontrolleri

Canlı veritabanı kontrolü, `111111111` için üç satır olduğunu ve sort sırasının `0, 1, 2` olduğunu doğruladı. URL/storage alanlarının varlığı ve Storage nesnelerinin erişilebilirliği de doğrulandı.

Production build yerel server'ında `/product/111111111` salt-okunur HTTP isteğiyle kontrol edildi:

- HTTP 200
- Ürün adı HTML çıktısında bulundu.
- Üç thumbnail butonu render edildi.
- Önceki/sonraki ok butonları render edildi.

Ok/thumbnail tıklaması ve gerçek telefon üzerinde swipe tarayıcı otomasyon aracı bulunmadığı için fiziksel tarayıcıda otomatik olarak tıklanmadı. State geçişi indeksleri modulo ile loop yapıyor; responsive thumbnail grid ve touch swipe kodu eklendi. Gerçek mobil cihaz kontrolü bu nedenle tamamlanmış sayılmıyor.

## 4. Doğrulama

- `npx tsc --noEmit --incremental false` — başarılı.
- `npm run build` — başarılı.
- İlk build denemesi sandbox'ın Google Fonts erişimi engeliyle durdu; ağ erişimiyle tekrar çalıştırıldığında tamamlandı.
- Son build çıktısında kalan uyarı yok.
- Migration, seed veya Supabase veri değişikliği yapılmadı.
