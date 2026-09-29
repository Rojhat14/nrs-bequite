# NRS Sepet Düzeltmesi Raporu

## 1. Kök neden

Sepet Zustand + `persist` ile `nrs-cart-storage` localStorage anahtarında tutuluyordu. `addItem()` aynı ürün için `id + size` karşılaştırması yapıp bedenleri ayrı ekleyebiliyordu; ancak `removeItem()` yalnızca ürün `id` değerini filtreliyordu. Aynı ürünün S ve M satırları bu yüzden birlikte siliniyordu. CartDrawer React key'i de yalnızca ürün ID'siydi.

Store toplamı her ekle/sil işleminde önceki `totalAmount` üstünden artırılıp azaltılıyor ve localStorage'a ayrı yazılıyordu. Miktar değiştirme action'ı yoktu; persisted toplamla kalemler birbirinden kopabiliyordu. Varyantın gerçek ID'si de cart item içinde tutulmuyordu.

## 2. Değiştirilen dosyalar

- `src/store/useCart.ts`
- `src/components/CartDrawer.tsx`
- `src/components/ProductDetail.tsx`
- `src/components/ProductCard.tsx`
- `NRS_CART_FIX_REPORT.md`

## 3. Sepet item kimliği ve işlemler

Cart item ürün ID'sini checkout uyumluluğu için koruyor; varyantlı ürünlerde ayrıca gerçek `variantId` ve görünen beden saklanıyor. Satır kimliği `productId + variantId` (eski persist kayıtlarında `productId + size`) üzerinden türetiliyor. Aynı varyant eklenince miktarı birleştiriliyor; farklı varyantlar farklı satırlarda kalıyor. Eski `nrs-cart-storage` kayıtlarında variantId yoksa beden üzerinden kimlik korunuyor ve aynı beden yeni eklendiğinde ID tamamlanıyor.

Silme ve miktar güncelleme `cartItemId` ile tek satıra uygulanıyor. CartDrawer anahtarı da bu benzersiz kimliği kullanıyor. Sepette beden satırda gösteriliyor; artı/eksi kontrolleri sadece seçili satırın miktarını değiştiriyor. Ürün kartından varyantlı bir ürünü beden seçmeden sepete eklemek yerine ürün detayına yönlendiriyor.

## 4. Para hesapları

Hesaplamalar TL'nin kuruş karşılığına yuvarlanarak yapılır:

- **Ara toplam:** Karşılaştırma fiyatı geçerliyse liste fiyatı × adet; değilse gerçek `price` × adet.
- **İndirim:** `(compareAtPrice - actualPrice) × adet`; karşılaştırma fiyatı yoksa sıfır.
- **Kargo:** Projede kullanılabilir sabit kargo ücreti ayarı yok. Yeni ücret uydurulmaması için mevcut davranış korunarak `0` kalıyor; drawer bunu “Henüz tanımlanmadı” olarak gösteriyor.
- **Genel toplam:** `ara toplam - indirim + kargo`. Sonuç gerçek satış fiyatlarının toplamı ve mevcut checkout'un kullandığı `totalAmount` olur.

Örneğin karşılaştırma fiyatı bulunmayan 5.000 TL'lik üründen S × 2 ve M × 1 için ara toplam/genel toplam 15.000 TL'dir. 6.000 TL karşılaştırma ve 5.000 TL satış fiyatında adet başına 1.000 TL indirim gösterilir; ödeme toplamında gerçek satış fiyatı kullanılır.

Cart toplamları her değişiklikte mevcut satırlardan tekrar hesaplanır. `totalAmount` localStorage'dan güvenilir kaynak olarak okunmaz; eski persisted state hydrate edilirken de kalemlerden yeniden türetilir. Sepet boşaldığında tüm toplamlar sıfırdır.

## 5. Test sonuçları

Store modülü TypeScript'ten bellekte CommonJS'e çevrilip, Zustand persist için bellek localStorage adaptörüyle edge case senaryoları çalıştırıldı:

- S ve M ayrı satır — geçti.
- S silinince M kalır — geçti.
- M silinince S kalır — geçti.
- Aynı S tekrar eklenince tek satırda miktar 2 — geçti.
- S/M miktar güncellemesi birbirinden bağımsız — geçti.
- 5.000 TL için S × 2 + M × 1 toplamı 15.000 TL — geçti.
- 6.000 TL karşılaştırma / 5.000 TL satış için indirim ve ödeme toplamı — geçti.
- persist rehydrate sonrası variantId ve toplamın korunması — geçti.
- Son kalem silinince bütün toplamların sıfırlanması — geçti.

Bu otomatik store testleri gerçek tarayıcıda görsel UI tıklaması değildir. Tarayıcı yenilemesi gerçek browser profiliyle ayrıca elle denenmedi; persist middleware'in localStorage rehydrate yolu bellek adaptörüyle doğrulandı.

## 6. Doğrulama

- `npx tsc --noEmit --incremental false` — başarılı.
- `npm run build` — başarılı.
- Build çıktısında kalan uyarı yok.
- Supabase şeması, admin paneli ve payment API değiştirilmedi.

## 7. Bilinen sınır

`orders/order_items` yapısında varyant/beden snapshot alanı bulunmadığından mevcut payment route'u cart item'daki `variantId`/`size` bilgisini sipariş satırına yazmıyor. Bu görevde checkout/payment ve veritabanı yapısı özellikle korunmuştur. Kargo ücretinin gerçek hesaplanabilmesi için de sabit ücret değeri veya ayar kaynağı tanımlanmalıdır.
