# NRS Admin Panel Öncesi Güvenli İnceleme

Bu rapor mevcut kaynak kodunun salt okunur incelemesine dayanır. Supabase REST şema isteği mevcut `.env.local` ayarlarıyla `401` döndüğü için canlı veritabanı ve Auth yönetim bilgilerine erişilemedi. Bu nedenle tablo kolonları, gerçek kayıtlar ve RLS politikaları kesin olarak doğrulanamamıştır. Anahtar değerleri rapora alınmamıştır. Kod veya veritabanı değiştirilmemiştir.

## 1. Mevcut Supabase yapısı

- Paketlerde `@supabase/supabase-js` var; `@supabase/ssr` ne `package.json` ne de lockfile içinde tanımlı.
- `src/lib/supabase.ts`, `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` ile tek bir Supabase istemcisi oluşturuyor. Anahtar değerleri incelenmedi ve bu dosyada paylaşılmıyor.
- Aynı istemci hem tarayıcı bileşenlerinde hem de Next.js API route'larında kullanılıyor. Ayrı cookie tabanlı sunucu istemcisi görünmüyor.
- Auth, `AuthContext` içinde tarayıcı tarafında `getSession` ve `onAuthStateChange` ile takip ediliyor. Kayıt/giriş `AccountModal` içinde Supabase Auth ile yapılıyor; profil verisi `profiles` tablosundan okunup yazılıyor.
- Kaynak kodda migration/şema dosyası bulunmuyor. Uzak Supabase REST şema isteği `401` verdi. Canlı Auth kullanıcıları, Auth ayarları, tablo şemaları ve RLS politikaları bu erişimle doğrulanamadı.
- Kaynak kodda service-role anahtarı kullanımı bulunmadı. Bu, Supabase dashboard veya dağıtım ortamında böyle bir anahtar olmadığı anlamına gelmez; yerel/uzak ortamların tamamı doğrulanmış değildir.

## 2. Mevcut ürün yapısı

`src/data/products.ts` içinde TypeScript ile tanımlanmış dört sabit ürün var. Alanları `id`, `name`, `category`, `description`, `image`, isteğe bağlı `hoverImage`, string `price`, `inStock` ve `fabric`/`care` içeren `details` nesnesi.

Ürün ID'leri:

- `mavi-ceket-01`
- `kirmizi-saten-01`
- `bordo-ceket-01`
- `bordo-detail-01`

ID'ler string ve mevcut ürün tüketicileri bunları aynen kullanıyor. Ürünler ana sayfa, kategori, ürün detay, seçki, vitrin ve favori bileşenlerinde bu sabit diziden okunuyor. Ürün görselleri şu anda `/public/images/products/...` altında; ürün verisi veritabanından gelmiyor.

İstenen `products`, `product_images`, `product_variants`, `categories` ayrımı mevcut kaynakta henüz yok. Yeni görsel yapısında `provider` ve `storage_key` alanlarını korumak, başlangıçta Supabase Storage ve daha sonra CDN geçişi için uygun. Önerilen anahtar biçimi `product-images/{product-id}/{variant}.webp` (ör. `main.webp`, `front.webp`, `back.webp`, `detail.webp`). Yükleme sırasında WebP/AVIF üretimi veya dönüştürmesi düşünülmeli; tarayıcı ve Next.js görüntü optimizasyonu ile uyumluluk kontrolü yapılmalı.

## 3. Mevcut kullanıcı/favori/sipariş yapısı

- **Auth/profiles:** `AccountModal` kayıt sırasında `profiles` tablosuna profil verisi ekliyor. `AuthContext` kullanıcı profili okuyor; `ProfileHeader` kendi kullanıcısının ad, soyad ve telefon alanlarını güncelliyor. Gerçek kolonlar ve tablo politikaları veritabanından doğrulanamadı.
- **Favoriler:** Kod `favorites` değil `wishlist` adlı tabloyu kullanıyor. `ProductCard`, `ProductDetail` ve `WishlistGrid`, kullanıcı ve `product_id` ile okuma/ekleme/silme yapıyor. Favori ekranındaki ürünler hâlâ sabit `PRODUCTS` dizisinden bulunuyor.
- **Siparişler:** `OrderHistory`, `orders` tablosunu `user_id` ile filtreliyor ve ilişkili `order_items` kayıtlarını nested select ile istiyor. Ödeme oluşturma route'u `orders` ve `order_items` içine yazıyor. Kaynak kod, sipariş satırında `product_id: item.id` kullanıyor.
- **ID uyumu:** Uygulama içindeki favori ve sipariş kodu, `product_id` değerini ürünün string ID'si olarak gönderiyor. Bu nedenle uygulama katmanında değer biçimleri eşleşiyor. Ancak canlı `wishlist.product_id`/`order_items.product_id` kolon tipleri, foreign key hedefleri ve mevcut kayıtların içerikleri erişim nedeniyle doğrulanamadı. Gerçek ürün geçişinden önce salt okunur veri eşleştirmesi ve orphan ID kontrolü yapılmalı; şema geçişi bu sonuçlara göre tasarlanmalı.
- İlgili mevcut tabloların kolonları, kısıtları ve RLS kapsamı canlı veritabanından doğrulanamadığı için varsayım olarak sunulmuyor.

## 4. Tespit edilen güvenlik sorunları

1. **Ödeme tutarı istemciden kabul ediliyor:** `src/app/api/payment/create/route.ts`, `totalAmount` değerini sunucu tarafında ürün kataloğundan yeniden hesaplamıyor. İstemci isteği değiştirilerek tutar düşürülebilir.
2. **Ürün ve adet doğrulaması yok:** İstek gövdesindeki `items`, ürün ID'leri, miktarlar, fiyatlar ve toplamın birbiriyle tutarlılığı sunucu tarafında doğrulanmıyor. Sipariş satırı fiyatları da istemci verisinden türetiliyor.
3. **Kimlik doğrulama/yetkilendirme görünmüyor:** Ödeme oluşturma route'u oturumu doğrulamıyor. `checkoutMode === 'account'` iken `customer.userId` istemciden alınıyor; başka bir kullanıcının ID'si gönderilebilir. Route'un yazma erişiminin RLS ile engellenip engellenmediği bilinmiyor.
4. **Ödeme callback'i sahte başarıya açık:** `src/app/api/payment/callback/route.ts`, imza/hash, sağlayıcı kimliği, tutar, para birimi, sipariş durumu veya tekrar oynatma denetimi yapmadan `status: 'success'` geldiyse siparişi `paid` yapıyor. Bu endpoint'in RLS ile yazma erişimi de doğrulanamadı.
5. **PayTR entegrasyonu simülasyon:** Ödeme oluşturma route'u gerçek sağlayıcı token'ı üretmek yerine yerel `/checkout/verify` URL'si döndürüyor. Gerçek ödeme onayıyla sipariş durumu arasındaki güven zinciri mevcut kodda yok.
6. **Kişisel veri loglanıyor:** Ödeme route'u müşteri nesnesini console'a yazıyor; bu nesne ad, e-posta, telefon ve adres içeriyor olabilir. Hata mesajı da doğrudan API yanıtına aktarılıyor.
7. **İşlem bütünlüğü:** Önce pending sipariş, sonra sipariş satırları ayrı sorgularla yazılıyor. İkinci adım başarısız olursa eksik sipariş kaydı kalabilir; transaction/RPC görünmüyor.
8. **Admin koruması henüz yok:** Kaynakta admin rolü, server-side admin guard veya admin RLS modeli görünmüyor. Auth/profil kontrolü tek başına admin yetkisi sağlamaz.
9. **RLS bilinmiyor:** Canlı politikalara erişilemedi; bu yüzden hangi tabloların herkese açık okuma/yazmaya izin verdiği hakkında güvenli bir olumlu/olumsuz sonuç çıkarılamıyor. Admin geliştirmesine başlamadan önce gerçek politikalar SQL Editor veya güvenli yönetim erişimiyle incelenmeli.

## 5. Admin paneli öncesi değiştirilmesi veya korunması gereken noktalar

- **Korunacak veri:** `profiles`, `wishlist`, `orders`, `order_items`, Auth kullanıcıları ve çalışan storefront davranışı için hiçbir kayıt/tablo silinmemeli veya yeniden oluşturulmamalı. Önce yalnızca şema/politika envanteri ve ID eşleşme raporu alınmalı; migration'lar eklemeli ve geri alınabilir olmalı.
- **Ürün geçişi:** Mevcut dört string ID ve kullanılan kategori değerleri (`Elbiseler`, `Üst Giyim`, `Alt Giyim`, `Bedding`, `Aksesuar`) korunmalı veya açık bir eşleme tablosuyla taşınmalı. Favori ve sipariş referansları doğrulanmadan ID türü/formatı değiştirilmemeli. Storefront bileşenleri sabit `PRODUCTS` dizisinden veritabanına bir defada geçirilmemeli; geçiş uyumluluğu planlanmalı.
- **Admin rolü:** Admin yetkisi kullanıcı tarafından düzenlenebilir `profiles` alanına konmamalı ve kayıt ekranından atanamamalı. Yetki yalnızca güvenilir yönetim işlemiyle verilmeli; server-side oturum doğrulaması ve her ilgili tabloda RLS kontrolü birlikte uygulanmalı. İstemci sadece public anon key kullanmalı; service-role anahtarı yalnızca gerekiyorsa sunucu ortamında tutulmalı, client bundle'a hiçbir şekilde girmemeli.
- **Sunucu istemcisi:** `@supabase/ssr` kurulu değil. Admin sayfaları ve yazma işlemleri için cookie oturumunu doğrulayan server client, admin authorization kontrolü ve uygun RLS politikaları tasarlanmalı. Middleware tek başına güvenlik sınırı sayılmamalı.
- **Admin route/layout çakışması:** `src/app/layout.tsx` bütün route'lara `Navigation`, `Footer`, `Newsletter` ve `CartDrawer` ekliyor. Bazı mevcut sayfalar ayrıca `Navigation` render ediyor; dolayısıyla çifte gezinme riski zaten var. Admin için ayrı `src/app/admin/layout.tsx` görünümü planlanmalı ve root layout'taki müşteri mağazası öğelerinin admin ekranlarına nasıl uygulanacağı belirlenmeli.
- **Ödeme güvenliği:** Admin sipariş yönetimine geçmeden önce ödeme callback'i gerçek sağlayıcı imza doğrulamasına bağlanmalı; tutar ürün/variant verisinden sunucuda hesaplanmalı; müşteri ve ürün girdileri doğrulanmalı; sipariş yazımı atomik hale getirilmeli; PII logları ve hata yanıtları azaltılmalı. Şu anki ödeme akışına bağlı sipariş/favori verileri korunmalı.
- **Görsel depolama:** Başlangıçta Supabase Storage kullanılabilir. Storage nesne yolu `product-images/{product-id}/{image-name}.webp` biçiminde tutulabilir; veritabanında URL, `provider`, `storage_key`, alt metin, sıralama ve ana görsel alanları olmalı. Provider soyutlaması Cloudinary/R2/CDN geçişini desteklemeli. Görsel yükleme yetkisi admin rolüyle sınırlandırılmalı; herkese açık ürün görseli okuma yaklaşımı ayrıca seçilmeli.

