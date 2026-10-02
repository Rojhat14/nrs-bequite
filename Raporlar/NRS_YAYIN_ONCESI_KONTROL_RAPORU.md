# NRS yayın öncesi kontrol raporu

Tarih: 3 Ekim 2026

Kod, derleme, paket güvenliği, HTTP sayfa erişimi ve mobil CSS sorunları kontrol edildi. Site yayına gönderilmedi. Ürün kayıtları, fiyatlar, Supabase şeması, migration'lar ve canlı veritabanı politikaları değiştirilmedi; test sırasında veritabanına kayıt yazılmadı.

## Düzeltilen sorunlar

- Bazı sayfalarda hem global shell hem sayfa bileşeni header oluşturuyordu. Sayfalardaki tekrarlar kaldırıldı; HTTP kontrolünde her normal sayfada tek header bulundu.
- Mobil header'daki gizlenmeyen masaüstü logo kolonu düzeltildi. Tablet menü taşması azaltıldı; header yüksekliği ResizeObserver ile ölçülüyor.
- Sepet ve hesap pencereleri kısa ekranlara sınırlandı; içeriğin kaydırılması, Escape ile kapanma, klavye odağının pencere içinde kalması ve arka plan kaydırmasının kilitlenmesi eklendi.
- Mobil sepet satırları dar ekranlarda sarılıyor. Checkout ve profil ekranlarının mobilde yer kaplayan sol sidebar'ı gizlendi; masaüstü sidebar'ı header altına taşındı.
- Dokunmatik ekranlarda ürün kartı butonları görünür. Kart içindeki iç içe link/buton yapısı düzeltildi. Stokta olmayan ürünün hızlı ekleme işlemi engellendi.
- Ürün kartlarında renkli görüntü ve zoom korundu. Detay galerisinde soldaki dikey thumbnail'lar, viewport sınırı ve object-contain korundu.
- Mobil kategori başlıklarına yeterli yükseklik verildi. Mobil form alanlarında iOS'un odak sırasında zoom yapmaması için 16 px metin kullanılıyor.
- Arama butonları artık /search sayfasını açıyor. Ürün adı/kategori araması ve kategori sayfasındaki fiyat sıralaması çalışıyor.
- İndirim kategorisi yoksa /category/sale mevcut compare-at/current-price verilerinden indirimli ürünleri listeliyor; 404 kaldırıldı. Kayıtlar değiştirilmedi.
- Ürün kartının ana fotoğrafı is_primary alanından seçiliyor. Favorilerde Storage provider/storage_key bilgileri kullanılarak doğru görsel URL'si oluşturuluyor.
- Favori yazma hataları kontrol ediliyor; peş peşe istekler ve eski kullanıcının gecikmiş favori sorgusunun UI'ı değiştirmesi önlendi.
- Storefront ve admin oturumları aynı cookie tabanlı Supabase istemcisini kullanıyor. Auth callback içindeki profil sorgusu ayrı effect'e taşındı. E-posta onayı gereken kayıtlar artık henüz oturum yokken profil INSERT'i yapmıyor; bilgiler metadata'da tutulup doğrulanmış oturumdan sonra eksik profil oluşturuluyor. Bu yaklaşım [Supabase auth callback rehberindeki](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) kilitlenme uyarısıyla uyumludur.
- Profil formu geç gelen profil verisini alıyor; sipariş tutarları sayıya dönüştürülerek formatlanıyor. Favori/sipariş yükleme hataları boş liste gibi gösterilmiyor.
- Bozuk localStorage sepet kayıtları ayıklanıyor; saklanmış veriler store fonksiyonlarını değiştiremiyor. Beden ayrımı ve indirim hesaplaması test edildi.
- Intro animasyonundaki rastgele SSR değerleri deterministik hale getirildi; mobil logo boyutu sınırlandı ve görünür header logosu hedefleniyor.
- Eksik editorial dosyaları artık görsel isteği/404 üretmiyor. Build sırasında mevcut public dosyaları belirleniyor; mevcut nötr boş alan davranışı korunuyor.

## Güvenlik ve sürümler

Next.js 14.2.15 → 15.5.27; eslint-config-next aynı sürüme getirildi. React 18 korundu. Next.js 15 için params/searchParams/cookies kullanımının async uyarlaması yapıldı; bu değişiklikler [resmi yükseltme rehberinde](https://nextjs.org/docs/app/guides/upgrading/version-15) açıklanıyor.

PostCSS 8.5.28'e güncellendi; Next.js alt bağımlılığında aynı sürüm kullanılıyor. Son npm audit sonucu: 0 açık. Yeni bir doğrudan dependency eklenmedi.

Görsel optimizasyonu yalnız mevcut Supabase hostname'ine sınırlandı. nosniff, SAMEORIGIN ve referrer-policy başlıkları eklendi. .env dosyaları git dışında tutuluyor; .env.example boş değerler içeriyor. Geliştirme ve production build klasörleri .next-dev / .next olarak ayrıldı.

## Ödeme ve servislerin mevcut durumu

Mevcut ödeme kodu PayTR entegrasyonu değildi: istemcinin gönderdiği tutara/kullanıcı ID'sine güveniyor, sabit 1234 kodunu kabul ediyor ve imzasız callback ile siparişi ödendi işaretleyebiliyordu. Bu yol kaldırıldı. create ve callback endpoint'leri 503 döndürüyor; verify/success sayfaları gerçek onay iddiasında bulunmuyor. Online tahsilat şu anda kapalıdır; sepet korunur.

Gerçek tahsilatı açmak için sağlayıcı entegrasyonu, sunucudan fiyat/stok doğrulaması, güvenli sipariş oluşturma ve imzası doğrulanan ödeme callback'i gerekir. PayTR hesap/hosting bilgileri bu turda verilmedi. Güvenlik düzeltmesi olarak sahte başarı yolunu kapatmak, gerçek entegrasyonun tamamlandığı anlamına gelmez.

İletişim formu gerçek bir e-posta servisine bağlı değildi. Artık yapılandırılmış e-posta varsa mail uygulamasını açıyor ve kullanıcının oradan göndermesi gerektiğini söylüyor; yoksa gönderim kapalı. WhatsApp'taki sahte telefon numarası kaldırıldı; gerçek numara yapılandırılınca buton görünür. Bülten kayıt servisi yok; sahte abonelik başarı mesajı kaldırıldı ve özellik yakında olarak gösteriliyor.

## Kontroller

| Kontrol | Sonuç |
| --- | --- |
| npm run build | Başarılı; TypeScript ve derleme kontrolü geçti |
| npm run lint | Hata/uyarı yok |
| npm test | 7/7 test başarılı |
| npm audit | 0 güvenlik açığı |
| Yerel üretim HTTP kontrolü | 83 sayfa, 0 hata; site içi bağlantılar tarandı |
| Yetkisiz /admin, /admin/products, /admin/orders | Login'e 307 yönlendirme |
| Ödeme create/callback | 503; sahte ödeme onayı engelli |
| git diff --check | Başarılı |

HTTP kontrolü ve testler canlı veritabanına kayıt yazmadı. Gerçek giriş/kayıt/e-posta onayı, oturum açıkken admin yazma işlemleri, gerçek ödeme ve canlı Supabase RLS politikaları uçtan uca test edilmedi. Tarayıcı bilgisayar kontrol izni bulunmadığından mobil/tablet/masaüstünde görsel ve dokunmatik cihaz testi yapılamadı; responsive değişiklikler kod/boyut hesapları üzerinden kontrol edildi.

## Yayın ayarları ve kalan işler

Hosting platformu belirtilmedi. Node.js çalıştırabilen Next.js hosting kullanın; mevcut Supabase SDK Node >=22 gerektiriyor. Node 22 veya 24 seçin. .nvmrc ve package engines bu gereksinimi belirtir. Yerel doğrulama Node 24.21.0 ile yapıldı.

Build öncesi hosting ortamına .env.example içindeki NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY değerlerini tanımlayın; anon/publishable anahtar kullanılmalı, service-role anahtar kullanılmamalı. İşletme e-postası ve WhatsApp numarasını NEXT_PUBLIC_CONTACT_EMAIL / NEXT_PUBLIC_WHATSAPP_NUMBER ile ekleyin. NEXT_PUBLIC ayarları değiştiğinde yeniden build/deploy gerekir. Supabase Site URL ve izinli redirect URL'lerini gerçek domain için yapılandırın.

3 Ekim 2026 görsel güncellemesi: 12 kategori/koleksiyon fotoğrafı public/images/editorial altına eklendi. Kaynaklar ve doğrulama ayrıntıları [görsel kaynak raporunda](NRS_EDITORIAL_GORSEL_KAYNAKLARI.md). Önceden açık kalan dev sunucusunu yeniden başlatın; görsel listesi başlangıç/derleme sırasında belirlenir.

Yayından önce gerçek cihazda menü, sepet, giriş penceresi, ürün galerisi ve checkout/profil ekranlarını deneyin. Gerçek hesapla giriş/kayıt/e-posta onayı ve RLS erişimini doğrulayın. Online ödeme ve bülten servisleri entegrasyon tamamlanana kadar kapalıdır.

Yerel komutlar:

```sh
npm ci
npm run lint
npm test
npm run build
npm run start -- -p 3101
# Ayrı terminalde:
node tests/release-smoke.cjs http://localhost:3101
```

Güncelleme öncesinden açık kalan eski dev sunucusunu yeniden başlatın; yeni dev build'i .next-dev kullanır.

## Değiştirilen dosyalar

Bu liste bu oturumun önceki galeri/kart düzenlemelerini de kapsar.

- `.gitignore`
- `next-env.d.ts`
- `next.config.mjs`
- `package-lock.json`
- `package.json`
- `src/app/about/page.tsx`
- `src/app/admin/(protected)/favorites/page.tsx`
- `src/app/admin/(protected)/inventory/page.tsx`
- `src/app/admin/(protected)/orders/[id]/page.tsx`
- `src/app/admin/(protected)/orders/page.tsx`
- `src/app/admin/(protected)/products/[id]/page.tsx`
- `src/app/admin/(protected)/products/page.tsx`
- `src/app/admin/(protected)/users/[id]/page.tsx`
- `src/app/admin/(protected)/users/page.tsx`
- `src/app/admin/login/page.tsx`
- `src/app/api/payment/callback/route.ts`
- `src/app/api/payment/create/route.ts`
- `src/app/care-guide/page.tsx`
- `src/app/category/[slug]/page.tsx`
- `src/app/checkout/page.tsx`
- `src/app/checkout/success/page.tsx`
- `src/app/checkout/verify/page.tsx`
- `src/app/collections/[slug]/page.tsx`
- `src/app/collections/page.tsx`
- `src/app/contact/page.tsx`
- `src/app/curated/page.tsx`
- `src/app/faq/page.tsx`
- `src/app/globals.css`
- `src/app/product/[id]/page.tsx`
- `src/app/profile/components/OrderHistory.tsx`
- `src/app/profile/components/ProfileHeader.tsx`
- `src/app/profile/components/WishlistGrid.tsx`
- `src/app/profile/page.tsx`
- `src/app/returns/page.tsx`
- `src/app/shipping/page.tsx`
- `src/app/size-guide/page.tsx`
- `src/components/AccountModal.tsx`
- `src/components/CartDrawer.tsx`
- `src/components/CategoryHero.tsx`
- `src/components/Footer.tsx`
- `src/components/Hero.tsx`
- `src/components/HomePageContent.tsx`
- `src/components/IntroAnimation.tsx`
- `src/components/Navigation.tsx`
- `src/components/Newsletter.tsx`
- `src/components/ProductCard.tsx`
- `src/components/ProductDetail.tsx`
- `src/components/Selected.tsx`
- `src/context/AuthContext.tsx`
- `src/lib/editorialImages.ts`
- `src/lib/products.ts`
- `src/lib/supabase.ts`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/server.ts`
- `src/store/useCart.ts`
- `tsconfig.json`
- `.env.example`
- `.nvmrc`
- `src/app/search/page.tsx`
- `src/components/ProductListing.tsx`
- `src/hooks/useDialog.ts`
- `src/lib/storefront-config.ts`
- `tests/release.test.cjs`
- `tests/release-smoke.cjs`
