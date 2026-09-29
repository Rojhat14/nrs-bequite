# NRS Admin Panel — IMPLEMENTATION PLAN

Bu plan mevcut kod ve sağlanan Supabase bilgileri incelenerek hazırlandı. Plan hazırlanırken uygulama kodu, migration, tablo, policy veya Supabase verisi değiştirilmedi.

## A) Mevcut mimari analizi

- Proje Next.js 14 App Router, TypeScript, Tailwind CSS, Framer Motion ve `@supabase/supabase-js` kullanıyor.
- `@supabase/ssr` ve `middleware.ts` bulunmuyor. Supabase client, `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` ile oluşturuluyor; Auth işlemleri tarayıcı tarafındaki `AuthContext` ve `AccountModal` üzerinden yürüyor.
- `AuthContext` oturumu `getSession()` ile alıp `profiles` tablosunu `id = user.id` koşuluyla okuyor. Kayıt akışı Auth kullanıcısı oluşturduktan sonra `profiles.id` alanına aynı Auth user ID’sini yazıyor.
- Sepet Zustand ile `nrs-cart-storage` anahtarı altında yerel olarak saklanıyor. Sepet satırlarında `id`, `title`, `price` string, `quantity`, isteğe bağlı `size` ve `image` bulunuyor. Bu kalıcı veriyi silmek veya sıfırlamak ürün geçişinin parçası olmamalı.
- Global `src/app/layout.tsx`, tüm route’lara Navigation, Footer, Newsletter ve CartDrawer ekliyor. Birçok sayfa ayrıca kendi Navigation bileşenini de eklediği için çift gezinme riski mevcut. Admin için root düzeninde storefront kabuğu sınırı oluşturulmalı.
- Checkout verify/success sayfalarının dosya adlarının sonunda literal backtick karakteri görünüyor. API’nin yönlendirdiği `/checkout/verify` route’unun gerçek çalışırlığı uygulama aşamasında ele alınmalı; bu dosyalar incelenmeden silinmemeli veya yeniden adlandırılmamalı.
- Çalışma ağacında önceki düzenlemeler ve rapor dosyaları bulunuyor. Uygulama aşamasında bunların üzerine yazılmamalı.

## B) Mevcut Supabase uyumluluk analizi

Sağlanan şema ve policy bilgileri mevcut kodla karşılaştırıldı. Anon key ile satır döndürmeyen `limit(0)` SELECT kontrolleri:

- `profiles`, `wishlist`, `orders`, `order_items`: HTTP 200.
- `orders` içinden `order_items(*)` ilişkili sorgusu: HTTP 200.
- `products`, `categories`, `product_images`, `product_variants`: REST’te `PGRST205`; public schema cache’inde görünmüyor. Bu, tabloların kesinlikle bulunmadığını tek başına kanıtlamaz. Tablo oluşturma kararı öncesinde Supabase Dashboard üzerinden doğrulanmalı.
- Kontroller sıfır satır döndürdü. Kolon tipleri veya policy tanımları anon REST üzerinden yeniden okunamadı.

Mevcut `orders` ve `order_items` yapısı, uygulamanın kullandığı string `product_id` biçimiyle uyumlu. Ürün tablosu eklenecekse `products.id` de `text` olmalı ve mevcut ID’ler korunmalı:

- `mavi-ceket-01`
- `kirmizi-saten-01`
- `bordo-ceket-01`
- `bordo-detail-01`

Mevcut kategori kullanımı tek bir ad kümesinden oluşmuyor. Navigasyonda `dresses`, `tops`, `blazers`, `bottoms`, `suits`, `sale` gibi route slug’ları; ürün tipinde `Elbiseler`, `Üst Giyim`, `Alt Giyim`, `Bedding`, `Aksesuar` adları var. Kategori geçişi slug ve etiketleri eşlemeli, mevcut URL’leri korumalı.

## C) Güvenlik riskleri

### `order_items` policies

Verilen iki policy de `public`, `ALL`, `USING true`. PostgreSQL’de permissive policy’ler aynı komutta OR ile birleşir; iki geniş policy varken yeni bir dar permissive policy eski erişimi kısıtlamaz. Restrictive policy’ler AND ile ek kısıt uygular; tablo grant’leri ayrıca kontrol edilmelidir. `ALL` policy’sinde `WITH CHECK` belirtilmediyse `USING` ifadesi INSERT/UPDATE kontrolünde de kullanılır. Bu koşullarla `true`, policy kapsamındaki rollere satır düzeyinde geniş erişim sağlayabilir; gerçek yazma yetkisi ayrıca SQL grant’lerine bağlıdır. [PostgreSQL policy davranışı](https://www.postgresql.org/docs/17/sql-createpolicy.html), [Supabase RLS ve grants](https://supabase.com/docs/guides/database/postgres/row-level-security).

### Ödeme API’leri

- `payment/create`, istemciden gelen `totalAmount`, ürün fiyatı, ürün ID’leri, adet ve `customer.userId` değerlerine güveniyor; fiyatı veritabanından yeniden hesaplamıyor.
- API, hesaplı siparişte kullanıcı ID’sini istek gövdesinden alıyor. İstek için server-side oturum doğrulaması görünmüyor.
- `orders` ve `order_items` ayrı sorgularla oluşturuluyor; ikinci sorgu başarısız olursa eksik sipariş kalabilir.
- Müşteri nesnesi console’a yazdırılıyor ve ham hata mesajı API yanıtına aktarılıyor.
- Callback, sağlayıcı imzası veya ödeme tutarını doğrulamadan gövdedeki `status: success` ile siparişi `paid` yapıyor. Mevcut kod gerçek PayTR entegrasyonu değil, simülasyon.
- DB’deki `guest_order_token`, mevcut API tarafından üretilmiyor veya doğrulama akışında kullanılmıyor. `user_id` nullable olduğu için guest checkout korunmalı ve token erişimi ayrıca tasarlanmalı.

### Admin erişimi ve SSR

Kaynak kodda admin rolü veya server-side admin guard bulunmuyor. Client-side kontrol tek başına yeterli olmayacak. Supabase SSR oturumları cookie tabanlı; mevcut tarayıcı Auth akışı ise `supabase-js` varsayılan oturum depolamasını kullanıyor. İkisini birleştirmek mevcut kullanıcı oturumlarını etkileyebileceği için admin SSR geçişi kontrollü yapılmalı. [Supabase SSR rehberi](https://supabase.com/docs/guides/auth/server-side).

## D) Database migration planı

1. **Migration öncesi salt-okunur envanter:** Dashboard’da mevcut tablo grant’lerini, policy ifadelerini ve Storage bucket’larını doğrula. `orders` policy ifadeleri sağlanan bilgilerde yok; etkileri çıkarılmadan bunlara dokunulmamalı.
2. **Yeni katalog tabloları:** Dashboard’da gerçekten bulunmadıkları doğrulanırsa additive migration ile `categories`, `products`, `product_images`, `product_variants` ekle.
3. **Mevcut tabloları koru:** `profiles`, `wishlist`, `orders`, `order_items` silinmesin veya yeniden oluşturulmasın. Ürün migration’ında mevcut order/favorite `product_id` kolonlarına FK ekleme; mevcut tüm ID’ler ve orphan ilişkiler doğrulandıktan sonra ayrıca değerlendir.
4. **Admin rolü:** `admin_users(user_id, role, is_active, created_at)` ekle. Normal kullanıcıların INSERT/UPDATE/DELETE yetkisi olmasın. İlk admin güvenilir bir yönetim işlemiyle atanmalı; signup akışına admin rolü eklenmemeli.
5. **Admin helper:** `is_active_admin()` benzeri DB fonksiyonu `admin_users` kontrolünü recursion oluşturmadan yapmalı; `search_path` sabitlenmeli ve fonksiyon güvenli şekilde sınırlandırılmalı.
6. **Order-item policy geçişi:** Önce checkout’un güvenli server/RPC akışı hazır hale getirilmeli. Sonra mevcut policy’lerin yerine geçecek sınırlayıcı kurallar ayrı, incelenebilir migration’larla planlanmalı. Eski geniş policy’leri kaldırma/değiştirme adımı açıkça belgelenmeli ve onay alınmadan çalıştırılmamalı.
7. **Diğer tablolar:** `site_settings` ve `admin_audit_logs` sonraki aşamada additive olarak eklenebilir. Audit kaydı actor, action, entity, timestamp ve hassas olmayan değişiklik özetini tutmalı.

## E) Admin authorization planı

- Admin login mevcut Supabase Auth kullanıcılarıyla çalışmalı; yeni kullanıcı/şifre sistemi açılmamalı.
- Login sunucu tarafında cookie tabanlı Supabase SSR session üretmeli. Korunan admin sayfaları, Server Actions ve admin API işlemleri kullanıcıyı sunucuda doğrulayıp `admin_users.is_active` ve rolünü denetlemeli. Middleware yönlendirme/token yenilemeye yardımcı olabilir, tek güvenlik katmanı olamaz.
- Mevcut storefront `AuthContext` başlangıçta korunmalı. Admin SSR için ayrı server/browser client yardımcıları eklenmeli; mevcut oturumları cookie’ye taşımadan önce uyumluluk planı yapılmalı. Geçiş mevcut kullanıcıları sessizce oturumdan düşürmemeli. [Supabase SSR client rehberi](https://supabase.com/docs/guides/auth/server-side).
- Admin ürün ve sipariş işlemleri mümkün olduğunca doğrulanmış kullanıcının JWT’siyle çalışıp RLS’e dayanmalı. `service_role` ortak client modülüne veya browser bundle’a girmemeli. Auth kullanıcılarının tamamını yönetmek gibi özel gereksinimler çıkarsa server-only ayrıcalıklı kullanım ayrıca tasarlanmalı.
- Route düzeni: `/admin/login` korumasız login; `/admin` ve diğer admin sayfaları korunan admin layout/sidebar. Normal kullanıcı admin sayfalarına ve API’lerine sunucuda reddedilmeli.

## F) Product migration planı

- `products.id`, mevcut string ID’leri koruyan `text primary key` olmalı. Fiyat `numeric`, para birimi `TRY`; mevcut `₺8,200` gibi string fiyatlar sayısal değere çevrilmeli.
- Kategori kayıtları mevcut ad ve slug’ları eşlemeli. Dört mevcut ürünün kategorisi `Üst Giyim`; diğer navigasyon slug’larının şu anda gerçek ürüne karşılık geldiği varsayılmamalı.
- Stokta varyant tablosu tek otorite olmalı. Bedenli ürünlerde her beden bir varyant/SKU; bedensiz ürünlerde tek varsayılan varyant tutulabilir. `products.in_stock` gerekiyorsa varyant stoklarından türetilmeli; birbiriyle yarışan stok kaynakları oluşturulmamalı.
- `product_images`: `provider`, `storage_key`, `url`, `alt_text`, `sort_order`, `is_primary`. Başlangıçta Supabase Storage ve `product-images/{product-id}/{variant}.webp`. Storefront görselleri public olacaksa public bucket indirmesinin herkese açık olduğu hesaba katılmalı; upload/update/delete admin RLS ile sınırlandırılmalı. [Supabase Storage erişim politikaları](https://supabase.com/docs/guides/storage/security/access-control).
- Görseller upload öncesinde WebP’ye optimize edilmeli; ileride AVIF/CDN dönüşümü provider katmanından eklenmeli. Mevcut `public/images/products` dosyaları backfill kaynağı olabilir ve migration sırasında silinmemeli.
- İlk seed dört ürünü aynı ID’lerle eklemeli. Storefront için DB satırlarını mevcut Product UI modeline çeviren adapter kullanılmalı; geçiş tamamlanmadan `PRODUCTS` kaldırılmamalı.
- Ürün arşivleme varsayılan silme davranışı olmalı. Sipariş geçmişinin `product_id` ve `price_at_purchase` snapshot’ları korunmalı. Ürünü referans eden kategori de önce yeniden atanmalı veya pasifleştirilmeli.

## G) Dosya bazlı uygulama planı

### Temel bağlantı ve layout

- `package.json`: `@supabase/ssr` ekleme planı.
- `src/lib/supabase.ts`: storefront kullanımını ilk aşamada koru; admin SSR için ayrı browser/server helper’ları ekle.
- `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`: cookie oturumlu server ve browser client’ları.
- `src/lib/admin-auth.ts`: server-side admin doğrulaması.
- `src/middleware.ts`: admin route’larında cookie/session yenileme ve yardımcı yönlendirme.
- `src/app/layout.tsx`: global storefront Navigation/Footer/Newsletter/CartDrawer’ı admin route’larından ayıracak StorefrontShell sınırı; storefront görünümü korunmalı.
- `src/app/admin/layout.tsx`: admin shell/sidebar. Login’i guard’dan ayırmak için route group kullan.

### Admin ekranları

- `src/app/admin/(auth)/login/page.tsx`
- `src/app/admin/(protected)/layout.tsx`
- `src/app/admin/(protected)/page.tsx`
- `products/page.tsx`, `products/new/page.tsx`, `products/[id]/edit/page.tsx`
- `categories/page.tsx`, `inventory/page.tsx`
- `orders/page.tsx`, `orders/[id]/page.tsx`
- `users/page.tsx`, `favorites/page.tsx`, `settings/page.tsx`
- `src/components/admin/*`: Sidebar, tablolar, ürün formu, görsel sıralama/yükleme ve durum bileşenleri.
- `src/app/api/admin/*` veya Server Actions: doğrulama, admin kontrolü, DB işlemleri ve audit kaydı.

### Ürün ve storefront

- `supabase/migrations/*`: yalnız additive katalog/admin tabloları ve ayrı incelenebilir policy geçişleri.
- `src/data/products.ts`: önce ortak domain tipleri ve mapper; DB geçişi tamamlanmadan statik listeyi kaldırma.
- `src/app/page.tsx`, `src/components/Collection.tsx`, `ProductShowcase.tsx`, `Selected.tsx`: ana sayfa/vitrin verisini DB’ye taşı.
- `src/app/category/[slug]/page.tsx`, `src/app/product/[id]/page.tsx`: kategori/ürün sorguları ve slug alias’larını koru.
- `src/app/profile/components/WishlistGrid.tsx`: wishlist’teki `product_id` değerlerini DB ürünlerine eşle.
- `src/components/ProductCard.tsx`, `ProductDetail.tsx`: ürün ID ve favori akışını koru; fiyat için sunucudaki katalog verisini otorite kabul et.
- `src/components/SelectedPieces.tsx`: şu anda başka bir dosyadan kullanımı görünmüyor ve ayrı statik ürün dizisi içeriyor. Canlı ürün kaynağına geçiş ve kullanım durumu netleşmeden silme.
- `next.config.mjs`: Supabase Storage ve seçilecek CDN host’ları için Next Image izinlerini planla.

### Checkout ve siparişler

- `src/store/useCart.ts`, `src/components/CartDrawer.tsx`: `nrs-cart-storage` formatını ve ürün ID’lerini koru; client fiyat/toplamını ödeme otoritesi sayma. TRY gösterimini tutarlı hale getir.
- `src/app/checkout/page.tsx`: sunucuya ürün/varyant ID’si ve adet gönder; client `totalAmount` ve `price` değerlerini otorite kabul etme.
- `src/app/api/payment/create/route.ts`: oturumu doğrula; ürün, fiyat, stok ve toplamı DB’den hesapla; order+items+stok işlemini atomik RPC/transaction akışına taşı. Guest checkout için `user_id` nullable kalmalı ve `guest_order_token` güvenli üretilmeli.
- `src/app/api/payment/callback/route.ts`: gerçek sağlayıcı yoksa simülasyonu açıkça koru; gerçek entegrasyonda imza/tutar/para birimi/order eşlemesini server-side doğrula ve idempotent durum geçişi yap. Callback body’sindeki `status` tek başına yeterli olmamalı.
- `src/app/profile/components/OrderHistory.tsx`: kullanıcı filtresini koru; nested relation `limit(0)` ile kabul edildi, fakat kolonlar ileride açıkça belirtilmeli.
- Sipariş durumları mevcut değerler incelenmeden enum’a zorlanmamalı. `pending`, `payment_pending`, `paid` mevcut kodda kullanılıyor; diğer değerler geriye uyumlu geçişle eklenmeli.

## Uygulama sırası

1. Mevcut `orders` policy ifadeleri, SQL grants, Storage bucket/policies ve metadata için Dashboard envanteri.
2. Admin rolü + SSR tabanlı server-side authorization temeli; mevcut AuthContext’e dokunmadan admin login akışı.
3. Admin route shell’i ve `/admin` dashboard iskeleti.
4. Katalog tabloları ve dört ürünü ID koruyarak backfill etme.
5. Ürün public read/admin write RLS ve Storage upload erişimleri.
6. Storefront’u kademeli olarak DB ürünlerine geçir; cart/wishlist/profile davranışını koru.
7. Sipariş oluşturma güvenli server akışını hazırla; ardından `order_items` geniş policy’leri için kontrollü replacement migration planla.
8. Sipariş, kullanıcı, favori, ayar ve audit ekranları.

**Henüz uygulama veya migration adımı başlatılmadı.** RLS policy/grant değişiklikleri, mevcut tanımlar ve replacement davranışı ayrı ayrı gösterilmeden uygulanmamalı.
