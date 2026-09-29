# NRS Admin Panel Mimari Planı

Bu belge, NRS mağazasına aynı Next.js uygulaması içinde `/admin` altında çalışacak bir yönetim paneli eklemek için önerilen mimariyi tanımlar. Bu plan hazırlanırken uygulama dosyalarında veya Supabase verilerinde değişiklik yapılmamıştır.

## 1. Mevcut mimari

- Proje Next.js 14 App Router, TypeScript, Tailwind CSS ve Supabase kullanıyor.
- Sayfalar `src/app/`, arayüz bileşenleri `src/components/` altında bulunuyor.
- Supabase bağlantısı `src/lib/supabase.ts` içinde tek bir istemci olarak tanımlı. Oturum ve profil bilgileri istemci tarafındaki `AuthContext` üzerinden yönetiliyor.
- Ürünler `src/data/products.ts` içinde sabit bir dizi olarak tutuluyor. Ürün listeleme ve detay bileşenleri bu veriyi kullanıyor.
- Favori, profil, sipariş ve ödeme akışları Supabase tablolarına bağlanıyor. Repoda tablo şeması veya migration dosyaları görünmediği için mevcut tabloların kolonları ve RLS politikaları kod üzerinden doğrulanamıyor.
- `src/app/api/payment/create/route.ts` istemciden gelen toplam tutarı kullanıyor. Ödeme callback'i de başarı durumunu doğrulamadan siparişi ödenmiş olarak işaretliyor. Gerçek ödeme entegrasyonundan önce bu akış ayrıca güvenli hale getirilmeli.

## 2. Eklenmesi önerilen dosyalar

```text
src/app/
  admin/
    layout.tsx
    page.tsx                       # Dashboard
    login/page.tsx                 # Gerekirse admin giriş ekranı
    products/page.tsx
    products/new/page.tsx
    products/[id]/edit/page.tsx
    categories/page.tsx
    inventory/page.tsx
    users/page.tsx
    favorites/page.tsx
    orders/page.tsx
    orders/[id]/page.tsx
    settings/page.tsx

src/components/admin/
  AdminShell.tsx
  AdminSidebar.tsx
  ProductForm.tsx
  ProductTable.tsx
  ImageManager.tsx

src/lib/supabase/
  client.ts                         # Tarayıcı istemcisi
  server.ts                         # Cookie tabanlı sunucu istemcisi
  admin.ts                          # Sunucu tarafı admin yetki kontrolü

src/app/api/admin/
  ...                               # Yalnızca sunucuda yapılması gereken işlemler

supabase/
  migrations/
    ...                             # Tablolar, indeksler, RLS ve fonksiyonlar
```

Sunucu tarafında oturum doğrulaması için Supabase SSR istemcisi gerekir. Projede şu an `@supabase/ssr` görünmüyor; uygulama aşamasında bu bağımlılık eklenebilir. Mevcut Supabase istemcisi de kademeli olarak tarayıcı ve sunucu istemcilerine ayrılabilir.

## 3. Supabase tabloları

| Tablo | Amaç ve önemli alanlar |
|---|---|
| `profiles` | Mevcut profil tablosu; `id` Auth kullanıcısına bağlı olmalı. Yönetici rolü kullanıcının değiştirebildiği profil alanlarında tutulmamalı. |
| `admin_users` | Yönetici yetkisi: `user_id`, `role`, `is_active`, `created_at`. Yetki verme yalnızca güvenilir yönetim kanalıyla yapılmalı. |
| `categories` | Kategori adı, slug, açıklama, görsel URL'si, sıralama ve aktiflik bilgisi. |
| `products` | Ürün adı, slug, açıklama, fiyat, para birimi, kategori, yayın durumu ve zaman damgaları. |
| `product_images` | Görsel URL'si, sağlayıcı, dosya anahtarı, alt metin, sıralama ve kapak görseli bilgisi. |
| `product_variants` | Beden/SKU gibi varyantlar ve stok miktarı. Tek bedenli ürünlerde de aynı yapı kullanılabilir. |
| `wishlist` | Mevcut favori tablosu; kullanıcı ve ürün ilişkisi. Favori istatistikleri ürün bazında hesaplanabilir. |
| `orders` | Mevcut sipariş tablosu; müşteri, teslimat, tutar, sipariş ve ödeme durumları. |
| `order_items` | Sipariş satırları; ürün referansına ek olarak satın alma anındaki ürün adı, SKU ve fiyat kopyası tutulmalı. |
| `site_settings` | Site ayarları. Genel ayarlar ile gizli anahtarlar ayrılmalı; gizli anahtarlar bu tabloda tutulmamalı. |
| `admin_audit_logs` | Yönetici işlemlerini kim/ne zaman yaptı bilgisini tutar. Fiyat, stok, sipariş durumu ve silme işlemlerinde faydalıdır. |

Sipariş geçmişini korumak için ürün sonradan arşivlense veya silinse bile sipariş satırlarında satın alma anındaki bilgiler saklanmalı. Kategori ve ürünlerde fiziksel silme yerine arşivleme tercih edilebilir.

## 4. RLS politikaları

RLS, ilgili tüm tablolarda etkin olmalı. Ön yüzde buton gizlemek veri güvenliği sağlamaz.

- **`products`:** Herkes yalnızca yayınlanmış ürünleri okuyabilir. Ekleme, düzenleme ve silme yalnızca admin yetkili `authenticated` kullanıcılara açık olur.
- **`categories`:** Herkes aktif kategorileri okuyabilir; değişiklikleri adminler yapabilir.
- **`product_images` ve `product_variants`:** Yayındaki ürünlere bağlı veriler okunabilir; yazma işlemleri adminlerle sınırlanır.
- **`admin_users`:** Kullanıcılar buraya rol ekleyemez veya rol değiştiremez. Yetki kontrolü için tabloyu güvenli şekilde okuyan `is_admin()` benzeri bir veritabanı fonksiyonu kullanılabilir.
- **`profiles`:** Kullanıcı yalnızca kendi profilini görebilir ve izin verilen alanlarını değiştirebilir. Profil güncellemesiyle admin yetkisi kazanılamaz.
- **`wishlist`:** Kullanıcı yalnızca kendi favorilerini okuyabilir ve değiştirebilir. Admin istatistikleri kontrollü bir sunucu fonksiyonu veya admin yetkili sorgusuyla alınır.
- **`orders` ve `order_items`:** Kullanıcı yalnızca kendi siparişlerini görür; adminler siparişleri yönetebilir. Sipariş oluşturma ve ödeme durumu güncelleme ayrıca sınırlandırılmalıdır.
- **`site_settings`:** Genel ayarlar okunabilir olabilir; değişiklikleri yalnızca adminler yapabilir.
- **`admin_audit_logs`:** Kayıt ekleme güvenilir sunucu işlemleriyle yapılır; normal kullanıcılar kayıtları değiştiremez veya silemez.

Admin kontrol fonksiyonu `SECURITY DEFINER` olarak tanımlanırsa sabit `search_path` ile yazılmalı ve kullanıcıların kendi rolünü yükseltebileceği hiçbir yazma politikası bulunmamalıdır. `service_role` anahtarı tarayıcıya gönderilmemelidir.

## 5. Admin authorization sistemi

1. Kullanıcı Supabase Auth ile oturum açar.
2. Sunucu, oturum token'ını doğrular; istemciden gelen kullanıcı ID'sine tek başına güvenmez.
3. Sunucu, kullanıcının aktif admin kaydını ve rolünü doğrular.
4. Yetkisiz kullanıcı admin sayfalarından giriş sayfasına veya erişim reddi sayfasına yönlendirilir.
5. Aynı yetki veritabanı RLS politikalarında da uygulanır. Böylece normal kullanıcı doğrudan Supabase API çağrısıyla yönetim verilerini değiştiremez.

`middleware.ts` yönlendirme için yardımcı olabilir ancak tek güvenlik katmanı olmamalıdır. Asıl güvenlik sunucuda doğrulanmış oturum ve veritabanındaki RLS kontrolleriyle sağlanmalıdır. Admin oluşturma veya yetki yükseltme, herkese açık kayıt akışına bağlanmamalıdır.

## 6. Admin route yapısı

- `/admin` — Dashboard
- `/admin/products` — Ürün listesi
- `/admin/products/new` — Ürün ekleme
- `/admin/products/[id]/edit` — Ürün düzenleme
- `/admin/categories` — Kategori yönetimi
- `/admin/inventory` — Stok ve varyantlar
- `/admin/users` — Kullanıcıları görüntüleme
- `/admin/favorites` — Favori istatistikleri
- `/admin/orders` ve `/admin/orders/[id]` — Sipariş yönetimi
- `/admin/settings` — Site ayarları

Admin layout'unda müşteri sitesinin footer/newsletter bileşenlerini kullanmamak ve admin navigasyonunu ayrı tutmak uygun olur. Mevcut root layout bu öğeleri tüm sayfalara eklediği için uygulama aşamasında admin yerleşimi ayrıca ele alınmalı.

## 7. Ürün ve görsel veri yapısı

Ürün fiyatını string yerine sayısal tutar ve açık para birimiyle saklamak önerilir:

```text
products
  id
  slug
  name
  description
  category_id
  price_amount       # Örnek: 8200.00
  currency           # Örnek: TRY
  status             # draft | published | archived
  created_at
  updated_at

product_variants
  id
  product_id
  sku
  size
  stock_quantity
  is_active

product_images
  id
  product_id
  url                # CDN veya storage URL'si
  provider           # local | cloudinary | başka sağlayıcı
  storage_key        # Sağlayıcıdaki nesne anahtarı, varsa
  alt_text
  sort_order
  is_primary
```

Bu yapı görsel dosyalarının nerede saklandığından bağımsızdır. Ürün yalnızca erişilebilir URL'yi ve gerekirse sağlayıcı bilgilerini saklar. Başlangıçta mevcut `/public/images/...` yolları kullanılabilir; ileride CDN veya başka storage seçildiğinde ürün şeması baştan tasarlanmaz.

Ürünler veritabanına taşındığında ana sayfa, kategori, ürün detay, seçkiler ve favori görünümü sabit `PRODUCTS` dizisi yerine Supabase sorgularını kullanmalıdır. Mevcut metin ürün ID'lerinin (`mavi-ceket-01` gibi) favori ve sipariş tablolarındaki `product_id` alanlarıyla uyumu migration öncesinde doğrulanmalıdır.

## Uygulama sırası önerisi

1. Mevcut Supabase şemasını ve RLS durumunu doğrula.
2. Ürün, kategori, varyant ve görsel metadata tablolarını migration ile oluştur.
3. RLS politikalarını ve admin rolü kontrol fonksiyonunu ekle.
4. Sunucu tarafı Supabase istemcisini ve admin authorization katmanını kur.
5. `/admin` layout'u ve dashboard'u oluştur.
6. Ürün/kategori/stok CRUD ekranlarını ekle; storefront'u veritabanı ürünlerine geçir.
7. Sipariş, kullanıcı, favori istatistikleri ve ayar ekranlarını ekle.
8. Admin işlemleri ve mevcut ödeme akışını güvenlik açısından gözden geçir.

**Durum:** Bu belge mimari plan niteliğindedir. Uygulama kodu veya Supabase verisi değiştirilmemiştir.
