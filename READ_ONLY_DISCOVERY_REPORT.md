# NRS READ-ONLY DISCOVERY REPORT

**Kapsam:** Kaynak kod okuması ve Supabase anon API ile salt-okunur GET / `SELECT ... LIMIT 0` kontrolleri. Hiçbir satır içeriği sorgulanmadı. Migration, tablo/policy değişikliği veya yazma işlemi yapılmadı. Secret/key değerleri rapora alınmadı.

**Metadata erişim sınırı:** Supabase REST/OpenAPI kök endpoint'i 401 dönüyor. Anon API üzerinden PostgreSQL katalogları (`pg_catalog`, `information_schema`, `pg_policies`, grants) okunamadı. Bu nedenle kolon tipleri/nullability, PK/FK/unique tanımları, gerçek policy ifadeleri ve rol bazında SQL grants yalnızca kullanıcı tarafından daha önce sağlanan metadata varsa o kapsamda raporlanabilir; kalan kısımlar doğrulanamadı.

## A) Database inventory

Anon Supabase JS client ile `select('*').limit(0)` sonuçları:

| Tablo | REST sonucu | Doğrulanabilen |
|---|---:|---|
| `public.profiles` | HTTP 200 | Tablo endpoint'i mevcut; sıfır satır döndü. Kolon/constraint/RLS metadata'sı okunamadı. |
| `public.wishlist` | HTTP 200 | Tablo endpoint'i mevcut; sıfır satır döndü. Kolon/constraint/RLS metadata'sı okunamadı. |
| `public.orders` | HTTP 200 | Tablo endpoint'i mevcut; sıfır satır döndü. Kolon/constraint/RLS metadata'sı okunamadı. |
| `public.order_items` | HTTP 200 | Tablo endpoint'i mevcut; sıfır satır döndü. Kolon/constraint/RLS metadata'sı okunamadı. |
| `public.products` | HTTP 404, `PGRST205` | `public` schema cache'inde görünmüyor; kesin olarak yok demek için Dashboard/katalog doğrulaması gerekir. |
| `public.categories` | HTTP 404, `PGRST205` | `public` schema cache'inde görünmüyor; kesin olarak yok demek için Dashboard/katalog doğrulaması gerekir. |
| `public.product_images` | HTTP 404, `PGRST205` | `public` schema cache'inde görünmüyor; kesin olarak yok demek için Dashboard/katalog doğrulaması gerekir. |
| `public.product_variants` | HTTP 404, `PGRST205` | `public` schema cache'inde görünmüyor; kesin olarak yok demek için Dashboard/katalog doğrulaması gerekir. |
| `public.admin_users` | HTTP 404, `PGRST205` | `public` schema cache'inde görünmüyor; kesin olarak yok demek için Dashboard/katalog doğrulaması gerekir. |
| `public.site_settings` | HTTP 404, `PGRST205` | `public` schema cache'inde görünmüyor; kesin olarak yok demek için Dashboard/katalog doğrulaması gerekir. |
| `public.admin_audit_logs` | HTTP 404, `PGRST205` | `public` schema cache'inde görünmüyor; kesin olarak yok demek için Dashboard/katalog doğrulaması gerekir. |

`orders` üzerinden `order_items(*)` nested SELECT isteği de `limit(0)` ile HTTP 200 verdi. PostgREST ilişkiyi çözümlüyor; bu çoğunlukla FK ilişkisidir ancak katalog metadata'sı olmadan FK constraint'i olarak kesinleştirilemez.

Kaynak kod ve REST testlerinden tüm public tabloların eksiksiz envanteri çıkarılamadı. `public.profiles`, `wishlist`, `orders`, `order_items` uygulama kodunda kullanılan tablolardır. Verilen `orders` şeması (`id uuid PK`, nullable `user_id`, `numeric total_amount`, `text status`, `guest_order_token uuid unique`, `payment_id text` ve adres/müşteri alanları) ve `order_items` şeması (`id uuid PK`, `order_id uuid NOT NULL`, `product_id text NOT NULL`, `quantity integer NOT NULL`, `price_at_purchase numeric NOT NULL`; `order_id -> orders.id`) önceki kullanıcı metadata'sıdır; bu alanlar bu anon API incelemesinde yeniden okunamadı.

## B) Orders policy + grants

Kullanıcı tarafından sağlanan mevcut policy adları: `orders_access_policy`, `orders_insert_policy`, `orders_policy`. `orders` için RLS'in aktif olduğu da kullanıcı tarafından sağlandı.

Bu incelemede anon REST üzerinden bu policy'lerin `roles`, `cmd`, `qual`, `with_check` alanları okunamadı. İsimlerden policy davranışı çıkarılmadı.

`profiles`, `wishlist`, `orders`, `order_items` için anon/public/authenticated rollerinin SELECT/INSERT/UPDATE/DELETE/TRUNCATE grants listesi PostgreSQL kataloglarından okunamadı. `limit(0)` SELECT'in HTTP 200 olması, test anındaki anon istek bağlamında SELECT sorgusunun kabul edildiğini gösterir; ayrı ayrı SQL rolleri için grant envanteri değildir. Hiçbir yazma işlemi denenmedi.

## C) Order_items policy + grants

Kullanıcı tarafından sağlanan mevcut bilgiler:

| Policy | Roles | Command | Qual (`USING`) | `WITH CHECK` |
|---|---|---|---|---|
| `order_items_access_policy` | `public` | `ALL` | `true` | Bu incelemede katalogdan okunamadı; önceki bilgilerde belirtilmemişti. |
| `order_items_policy` | `public` | `ALL` | `true` | Bu incelemede katalogdan okunamadı; önceki bilgilerde belirtilmemişti. |

Kullanıcı tarafından `order_items` RLS'inin aktif olduğu sağlandı. İki policy'nin güncel canlı ifadeleri anon API ile yeniden doğrulanamadı. SQL grants bu nedenle bilinmiyor.

PostgreSQL'de `ALL` policy için `WITH CHECK` belirtilmemişse `USING` ifadesi INSERT/UPDATE için check olarak kullanılır. `true` bu check için koşulsuz doğru olur. `public` kapsamı anon ve authenticated istemci rollerini etkileyebilir; gerçek işlem yetkisi ayrıca SQL grants'e bağlıdır. İki varsayılan permissive policy aynı anda geçerliyse OR ile birleşir; bu yüzden başka bir dar permissive policy tek başına geniş erişimi daraltmaz.

## D) Storage inventory

- `GET /storage/v1/bucket`, anon key ile HTTP 200 döndürdü ve boş bucket listesi verdi.
- Bu, anon endpoint'inden bucket görünmediğini doğrular. Anon görünürlüğü tüm proje bucket'larının kesinlikle bulunmadığını kanıtlamaz; Dashboard'da doğrulanmalı.
- `product-images` bucket'ı anon liste yanıtında görünmedi.
- Storage policy metadata'sı (`storage.objects` policy'leri) anon REST üzerinden okunamadı. Product image ile ilgili policy olup olmadığı doğrulanamadı.
- Hiçbir bucket oluşturulmadı, liste dışı objeler sorgulanmadı ve Storage değişikliği yapılmadı.

## E) Existing product architecture

`src/data/products.ts` içinde dört ürün hardcoded:

| ID | Kategori | Görsel yolu | Hover görseli |
|---|---|---|---|
| `mavi-ceket-01` | `Üst Giyim` | `/images/products/tops/mavi-ceket.png` | `/images/products/tops/mavi-ceket-2.png` |
| `kirmizi-saten-01` | `Üst Giyim` | `/images/products/tops/kirmizi-saten.png` | aynı görsel |
| `bordo-ceket-01` | `Üst Giyim` | `/images/products/tops/bordo-ceket.png` | aynı görsel |
| `bordo-detail-01` | `Üst Giyim` | `/images/products/tops/ceket-kare.png` | aynı görsel |

Ürün tipi `id`, `name`, `category`, `description`, `image`, `hoverImage?`, string `price`, `inStock`, `details.fabric`, `details.care` alanlarına sahip. Bütün bu mevcut ID'ler string.

Storefront ürün verisini şu noktalardan okuyor:

- `src/app/page.tsx` -> `Collection` bileşenine `PRODUCTS` veriyor.
- `src/components/ProductShowcase.tsx` -> Hero içindeki kayan vitrin için `PRODUCTS` kullanıyor.
- `src/components/Collection.tsx`, varsayılan olarak `PRODUCTS` alıyor.
- `src/app/category/[slug]/page.tsx` -> kategori filtrelemesini `PRODUCTS` üzerinden yapıyor.
- `src/app/product/[id]/page.tsx` -> ürün detayını ID ile `PRODUCTS` içinde arıyor.
- `src/components/Selected.tsx` -> ilk üç ürünü `PRODUCTS`'tan alıyor (bu component için başka bir kullanım bulunmadı).
- `src/app/profile/components/WishlistGrid.tsx` -> wishlist ID'lerini `PRODUCTS` kayıtlarıyla eşliyor.
- `src/components/SelectedPieces.tsx` ayrıca `piece-1`…`piece-4` ID'leri ile ayrı sabit örnek ürün listesi içeriyor; repo içinde bu component'in kullanımı bulunmadı.

Kategori URL alias'ları (`dresses`, `tops`, `blazers`, `bottoms`, `suits`, vb.) ile TypeScript ürün kategori etiketleri tam örtüşmüyor. Ürün geçişinde mevcut route alias'ları korunmalı.

## F) Authentication architecture

- `src/lib/supabase.ts` `@supabase/supabase-js` `createClient` ile tek client oluşturuyor; public URL ve anon key kullanıyor.
- `@supabase/ssr`, ayrı server client ve `middleware.ts` bulunmuyor.
- `src/context/AuthContext.tsx`, client tarafında `auth.getSession()` ve `onAuthStateChange()` kullanıyor; giriş yapan kullanıcı için `profiles` tablosunu `id` ile okuyor.
- `src/components/AccountModal.tsx`, `signInWithPassword` ve `signUp` kullanıyor. Signup sonrası `profiles` içine `id = data.user.id`, `first_name`, `last_name`, `phone`, `email` insert ediyor.
- `ProfileHeader`, `profiles` üzerinde kendi Auth ID'sine göre profil alanlarını güncelliyor.
- Admin rotası, admin rolü veya server-side authorization kodu bulunmadı.

## G) Payment/order flow

- `src/app/checkout/page.tsx` Zustand sepetinden `items` ve `totalAmount` alıyor. `/api/payment/create` isteğine `items`, `totalAmount`, `checkoutMode`, `customer.userId` ve müşteri/teslimat alanlarını gönderiyor.
- `src/app/api/payment/create/route.ts`, `orders` içine `user_id`, müşteri/adres alanları, `total_amount` ve `status: payment_pending` yazıyor. Guest modunda `user_id: null` gönderiyor.
- Route, `order_items` içine `order_id`, `product_id: item.id`, `quantity`, `price_at_purchase` yazıyor. İki insert ayrı sorgu; route fiyatı ve toplamı client payload'ından alıyor.
- Route `guest_order_token` veya `payment_id` alanlarını oluşturmuyor. Gerçek provider çağrısı yerine `/checkout/verify?orderId=...` simülasyon URL'si döndürüyor.
- `src/app/api/payment/callback/route.ts`, POST gövdesindeki `orderId` ve `status` alıyor; `status === 'success'` ise `orders.status` değerini `paid` yapıyor. Provider imzası/tutarı doğrulaması görünmüyor.
- `src/app/profile/components/OrderHistory.tsx`, `orders` tablosunu `user_id = user.id` ile filtreliyor ve `order_items(*)` nested select yapıyor.
- `WishlistGrid`, `ProductCard`, `ProductDetail` wishlist `SELECT`/`INSERT`/`DELETE` akışlarında `user_id` ve string `product_id` kullanıyor.

## H) Admin-related existing code

- `src/app` altında `/admin` route'u yok.
- Kaynak kodda admin rolü, admin authorization helper'ı, admin UI veya admin API route'u yok.
- `middleware.ts` yok.
- Root layout storefront Navigation/Footer/Newsletter/CartDrawer'ı bütün sayfalara ekliyor; bazı sayfalar kendi Navigation bileşenini de ekliyor. Admin için storefront dışı shell ayrımı gerekecek.

## I) Risks discovered

1. `order_items_access_policy` ve `order_items_policy` için sağlanan `public`, `ALL`, `qual=true` metadata'sı geniş erişim riski taşıyor. Yazma erişiminin gerçekten mümkün olup olmadığı grants bilgisine bağlı; grants okunamadı.
2. Orders policies'in adları biliniyor, fakat ifadeleri/rolleri/komutları doğrulanamadı. Sipariş erişim güvenliği hakkında tam sonuç için Dashboard metadata'sı gerekli.
3. Checkout client fiyatı, toplamı ve `customer.userId` değerini gönderiyor; API bunları yeniden doğrulamıyor. Callback client/provider tarafından gelen `status` alanıyla siparişi paid yapabiliyor.
4. Müşteri bilgileri ödeme create log'una yazılıyor; ham server hatası yanıtlanıyor.
5. Guest token şemada var, fakat create route üretmiyor/kullanmıyor. Guest erişim akışı net değil.
6. RLS policy'leri tablo grant'lerinin yerine geçmez; ikisi birlikte envanterlenmeli.
7. Yeni katalog tabloları anon REST schema cache'inde görünmüyor. Migration öncesi Dashboard'da gerçek tablo varlığı ve şema kontrol edilmeli.
8. Auth browser/local-storage biçiminden SSR cookie oturumuna geçiş mevcut kullanıcı oturumlarını etkileyebilir; kademeli uyumluluk planı gerekir.
9. `products.ts` dışındaki `SelectedPieces` örnek ürünleri ve kategori slug alias'ları ürün migration'ında gözden kaçırılmamalı.
10. Checkout verify/success route dosyalarının isimlerinde literal backtick bulunması route eşleşmesini etkileyebilir; dosya silmeden/taşımadan önce doğrulanmalı.
11. Çalışma ağacında önceden var olan değişiklikler korunmalı; bunlar bu discovery sırasında değiştirilmedi: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/CategoryMood.tsx`, `src/components/Hero.tsx`, `src/components/IntroAnimation.tsx`, `src/components/Navigation.tsx`. Ayrıca rapor dosyaları ve `src/components/IntroAnimation.tsx`` gibi backtick içeren bir dosya önceden mevcut.

## J) Exact implementation sequence

Bu sıra uygulama önerisidir; discovery sırasında hiçbir adım başlatılmadı.

1. **Metadata'yı yetkili read-only kaynaktan doğrula:** Supabase Dashboard/SQL Editor'dan public tablolar, tüm kolon tipleri/nullability, PK/FK/unique constraints, policy ifadeleri ve tablo grants envanterini al. `orders_*` policy'leri ve iki `order_items` policy'sini tam DDL ile kaydet. Storage bucket ve `storage.objects` policies kontrol et.
2. **Working tree'yi koru:** Mevcut diff/untracked dosyaları referans al; admin çalışması bunları ezmemeli. Checkout literal-backtick dosya adları için önce route etkisini doğrula.
3. **Admin kimlik doğrulama temelini kur:** `@supabase/ssr` server/browser client, cookie yenileme middleware'i ve server-side `requireAdmin` ekle. `admin_users` additive migration'ı hazırla; kullanıcı kendi rolünü yazamasın. İlk admin atamasını kontrollü, güvenilir yönetim işlemiyle yap.
4. **Admin UI route/layout ayrımı:** Root layout'taki storefront shell'i admin'den ayır. `/admin/login` korumasız, `/admin` ve diğer admin sayfaları server guard arkasında olsun. Admin CRUD işlemleri authenticated SSR client + RLS üzerinden çalışsın.
5. **Order items yazma yolunu güvenli hale getir:** Önce checkout için server-validated atomik order/RPC akışı tasarla: user ID session'dan, ürün/fiyat/stok DB'den, adet pozitif ve sınırlı, total server hesaplı. Guest siparişinde nullable `user_id` ve tahmin edilmesi zor `guest_order_token` akışını koru.
6. **Geniş policy geçişini ayrı ve kontrollü yap:** Tam policy/grant envanteri ve replacement ifadeleri onaylandıktan sonra order_items erişimini güvenli hale getir. Gerekirse önce mevcut permissive policy'leri daraltan restrictive guard/replacement yaklaşımını staging'de doğrula; eski policy'leri körlemesine silme. Doğrudan anon/authenticated order_items yazma grant'lerini ancak checkout'un güvenli akışı devrede olduktan sonra değerlendir.
7. **Katalog migration'ı:** Dashboard doğrulaması tabloların olmadığını teyit ederse additive `categories`, `products`, `product_images`, `product_variants` tablolarını ekle. `products.id` text kalsın. Dört mevcut ID ile kategori/fiyat/ürün verisini seed et. Mevcut wishlist/order item `product_id` kayıtlarını incelemeden FK ekleme.
8. **Storage:** `product-images` bucket'ı gerçekten yoksa oluşturmayı ayrı adımda planla. Görsel objeleri mevcut local dosyalardan WebP optimize ederek yükle; DB'de provider/storage_key/url tut. Public download ve admin-only upload/update/delete policy'lerini açıkça ayır.
9. **Storefront veri adaptörü:** Önce `products.ts` tiplerini DB satırlarına map et; sonra ana sayfa, vitrin, kategori, ürün detay ve WishlistGrid'i kademeli taşı. Ürün ID'leri, cart storage key/shape, auth, mevcut favorites ve orders davranışı korunmalı. Stok varyantları tek kaynak olsun.
10. **Admin catalog ekranları:** Dashboard, products CRUD/archive, image manager, categories, inventory; sonra orders, users/profiles, favorites, settings ve audit log. Kullanıcı listesinde `profiles` kapsamı ile Supabase Auth user listesinin farklı olduğunu belgeleyip gereksiz service-role kullanımından kaçın.
11. **Ödeme güvenliği:** Callback gerçek sağlayıcı imza doğrulaması, tutar/para birimi/order eşleşmesi ve idempotent durum geçişiyle tasarlansın. Sağlayıcı simülasyonu gerçek entegrasyon gibi sunulmasın. PII ve raw errors log/response'tan çıkarılsın.
12. **Her migration öncesi etki incelemesi:** Planlanan SQL, eski-yeni policy farkı, affected role/command, guest checkout etkisi ve mevcut kullanıcı/sipariş korunumu açıkça incelensin. Bu rapordan sonra hiçbir SQL veya kod adımı çalıştırılmadı.

