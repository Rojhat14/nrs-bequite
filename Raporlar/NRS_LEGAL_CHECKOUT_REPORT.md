# NRS hukuki sayfalar ve sözleşme altyapısı raporu

Tarih: 08.10.2026. Çalışmaya başlamadan önce git status --short boştu. Değişiklikler yereldir; deploy veya migration uygulanmadı.

## Değiştirilen ve eklenen dosyalar

Dosya → değişiklik

- `.env.example` → Gerçek iletişim e-postası için örnek ayar güncellendi.
- `src/lib/storefront-config.ts` → Varsayılan müşteri iletişim e-postası rojhat1maman@gmail.com oldu; telefon ve WhatsApp mantığı korunuyor.
- `src/components/Footer.tsx` → Müşteri Hizmetleri linkleri güncellendi ve Yasal bölümü eklendi.
- `src/components/Navigation.tsx` → Hesaplamayla doğrulanmayan 3.000 TL ücretsiz kargo duyurusu sipariş teyidi açıklamasıyla değiştirildi.
- `src/app/checkout/page.tsx` → Sepete özgü özet, açılabilir hukuki metinler, kart bölümü için snapshot ile bağlı zorunlu kabul ve güvenli payload hazırlama eklendi. Ödeme isteği yapılmıyor.
- `src/app/api/payment/create/route.ts` → Yalnız gelecekteki server-side kontrolü belirten yorum eklendi; POST uygulaması ve 503 aynı.
- `src/app/checkout/success/page.tsx` → Ödeme kullanılamıyor uyarısı korunarak müşteri hesabındaki sipariş/belge alanına link eklendi.
- `src/app/profile/components/OrderHistory.tsx` → Mevcut sorgu korunarak her siparişe kayıtlı belge/özet açma componenti bağlandı.
- `src/app/returns/page.tsx` → Eski route 308 ile genişletilmiş /iade-ve-degisim sayfasına yönlendiriliyor.
- `src/app/shipping/page.tsx` → Eski route 308 ile /kargo-ve-teslimat sayfasına yönlendiriliyor.
- `src/app/faq/page.tsx` → Eski iade e-postası ve doğrulanmamış PayTR sağlayıcı iddiası düzeltildi.
- `src/app/sitemap.ts` → Sekiz kanonik hukuki route eklendi; yönlenen eski adresler kanonik listede kullanılmıyor. Robots stratejisi değişmedi.
- `src/lib/legal/versions/v1.ts` → Gerçek şirket bilgileri, sekiz metin ve değiştirilmeden korunacak v1.0 arşivi.
- `src/lib/legal/documents.ts` → Merkezi sürümler, route listesi, sürüme özgü şirket/yayın bilgisi ve arşiv çözümleme.
- `src/lib/legal/acceptance.ts` → Ortak kabul doğrulama ve ödeme payload hazırlama; otomatik onay yok.
- `src/lib/legal/order-summary.ts` → Sipariş snapshot tipleri, nihai kargo/alıcı/tutar/tarih doğrulaması.
- `src/lib/legal/payment-preflight.ts` → Yalnız sunucu için kabul guardı, sunucu zamanı, belge/özet SHA-256 ve insert edilebilir kayıt nesnesi. Canlı DB/provider çağrısı yok.
- `src/components/legal/CheckoutLegalConsent.tsx` → Responsive, label ilişkili ve erişilebilir checkbox; sözleşme/form linkleri; KVKK ayrı bilgi linki.
- `src/components/legal/LegalDocumentContent.tsx` → NRS tipografi ve renkleriyle bölümlü hukuki içerik.
- `src/components/legal/LegalDocumentPage.tsx` → Responsive sayfa, SEO wrapper ile uyum, sürüm/şirket/iletişim alanları.
- `src/components/legal/LegalOrderSummary.tsx` → Birim fiyat, adet, indirim, toplam, kargo, alıcı ve teslimat gösterimi.
- `src/components/legal/OrderLegalDocuments.tsx` → Siparişe bağlı snapshot ve kabul edilen metin sürümü; eksik migration/legacy kayıtta açıklama, güncel belgeyle eski kabulü değiştirme yok.
- `supabase/migrations/20261008120000_order_legal_records.sql` → Şema önkontrollü, ayrı kayıt tablosu ve yalnız bu tablo için owner SELECT RLS/immutable kayıt hazırlığı. UYGULANMADI.
- `tests/legal.test.cjs` → 11 yeni test: kabul, sürüm, payload, hash, bilinmeyen kargo, frontend olayları, footer/route render, API 503 ve hesap belgeleri.
- `tests/whatsapp-order.test.cjs` → Varsayılan gerçek iletişim e-postası beklentisi güncellendi; mevcut senaryolar korunuyor.
- `src/app/mesafeli-satis-sozlesmesi/page.tsx` → Mesafeli Satış Sözleşmesi: metadata, kanonik route ve sürümlü içerik sayfası.
- `src/app/on-bilgilendirme-formu/page.tsx` → Ön Bilgilendirme Formu: metadata, kanonik route ve sürümlü içerik sayfası.
- `src/app/iade-ve-degisim/page.tsx` → İade ve Değişim Koşulları: metadata, kanonik route ve sürümlü içerik sayfası.
- `src/app/iptal-kosullari/page.tsx` → İptal Koşulları: metadata, kanonik route ve sürümlü içerik sayfası.
- `src/app/gizlilik-politikasi/page.tsx` → Gizlilik Politikası: metadata, kanonik route ve sürümlü içerik sayfası.
- `src/app/kvkk/page.tsx` → KVKK Aydınlatma Metni: metadata, kanonik route ve sürümlü içerik sayfası.
- `src/app/kullanim-kosullari/page.tsx` → Kullanım Koşulları: metadata, kanonik route ve sürümlü içerik sayfası.
- `src/app/kargo-ve-teslimat/page.tsx` → Kargo ve Teslimat: metadata, kanonik route ve sürümlü içerik sayfası.
- `Raporlar/NRS_LEGAL_CHECKOUT_REPORT.md` → bu rapor ve uygulama sınırları.

## Eklenen route'lar / hukuki belgeler

| Belge | Route | Mevcut | Footer | Checkout |
|---|---|---|---|---|
| Mesafeli Satış Sözleşmesi | `/mesafeli-satis-sozlesmesi` | Evet | Evet | Metin + link; kart bölümünde zorunlu kabul |
| Ön Bilgilendirme Formu | `/on-bilgilendirme-formu` | Evet | Evet | Metin + link; kart bölümünde zorunlu kabul |
| İade ve Değişim Koşulları | `/iade-ve-degisim` | Evet | Evet | Ortak footer |
| İptal Koşulları | `/iptal-kosullari` | Evet | Evet | Ortak footer |
| Gizlilik Politikası | `/gizlilik-politikasi` | Evet | Evet | Ortak footer |
| KVKK Aydınlatma Metni | `/kvkk` | Evet | Evet | Kart bölümünde yalnız bilgilendirme linki; açık rıza checkboxı yok |
| Kullanım Koşulları | `/kullanim-kosullari` | Evet | Evet | Ortak footer |
| Kargo ve Teslimat | `/kargo-ve-teslimat` | Evet | Evet | Ortak footer |

`/returns` ve `/shipping` silinmedi: kanonik yeni sayfalara 308 yönleniyor. İade, değişim, hazırlık, yurt içi teslimat ve uluslararası gönderim başlıkları genişletilerek taşındı. Etiket/ambalajı mutlak iade şartı yapan eski ifade tüketici haklarını daraltmayacak şekilde düzeltildi.

## Checkout

- Kart ödeme bölümünde required checkbox ve açık hata mesajı var. Başlangıçta seçili değildir. Ürün, miktar, tutar veya alıcı bilgisi değişince kabul geçersiz olur.
- Sözleşme ve ön bilgilendirme linkleri yeni sekmede açılır; ayrıca sipariş ekranında açılabilir metinler ve dinamik özet var.
- Buton metni: **Siparişi Ver ve Ödeme Yap**.
- Feature flag false kaldığı için kart butonu ve kart sözleşme kabul alanı şu anda gizlidir. Bilgi metinleri/özet ve WhatsApp akışı görünürdür.
- Checkbox kontrolü WhatsApp iletişim talebine zorlanmaz. WhatsApp mesajı ve BankTransferInfo dosyaları değişmedi; kesin sipariş/ödeme onayı olmadığı uyarısı korunuyor.
- Eksik kabulde payload hazırlanmaz. Geçerli kabulde de mevcut kapalı ödeme durumu gösterilir; fetch veya gerçek tahsilat yoktur.
- KVKK aydınlatma linki ayrı bilgilendirmedir. Sözleşme onayı pazarlama veya genel veri işleme açık rızası değildir.

## Supabase

Migration: `20261008120000_order_legal_records.sql` — **hazırlandı, çalıştırılmadı**.

Repository'de orders/order_items tam DDL bulunmuyor. Mevcut OrderRow, OrderItemRow, hesap sorguları, admin UUID order RPC migration'ı ve geçmiş şema raporu okundu. Bunlar canlı metadata doğrulaması yerine geçmez. Canlı Supabase'e şema/migration bağlantısı yapılmadı.

Yeni ayrı `public.order_legal_records` tablosu siparişle `order_id` PK/FK üzerinden ilişkilidir. Alanlar: `contract_accepted`, `contract_version`, `pre_information_version`, `accepted_at`, `document_hash`, `summary_hash`, `order_summary`. IP/user-agent yok. Mevcut orders/order_items/profiles/wishlist/product tablolarına alan eklenmiyor; mevcut RLS politikaları değiştirilmiyor.

Önkontrol orders tablosu, id/user_id UUID tipleri ve mevcut hukuki alan/tablo varlığını kontrol eder; uyumsuz şema veya zaten mevcut kayıt yapısında migration durur. Böylece bilinmeyen şemayı tahmin ederek üzerine yazmaz/uygun alanları tekrar oluşturmaz. Yalnız yeni tabloda sahibin SELECT erişimi vardır; istemci INSERT/UPDATE/DELETE yetkisi yoktur. Snapshot UPDATE ile değiştirilemez. Saklama süresi dolduğunda silme yalnız yetkili sunucu süreciyle yapılabilir; siparişe ait kayıt varken FK siparişin silinmesini engeller.

`prepareOrderLegalRecord` yalnız server-verified özetle insert edilebilir nesne üretir. Gelecekteki güvenilir sipariş transaction/RPC'si order/order_items ile bu kaydı atomik olarak yazmalıdır. Şu anda çalışan bir online sipariş yaratma/tahsilat veya hukuki kayıt yazma akışı eklenmemiştir. Sırf bir sayfayı görüntülemek veya WhatsApp talebi göndermek kabul kaydı yaratmaz. Eski siparişlere otomatik kabul backfill yapılmaz.

## Versiyon ve snapshot

İlk sürümler v1.0 / v1.0. Merkezi sürüm config'i checkout, request ve kayıt hazırlamada ortaktır. Arşivde sürüme özgü satıcı/metin/yayın bilgileri korunur. Genel belgelerin metinleri her siparişte çoğaltılmaz; kısa sipariş snapshot'ı ve SHA-256 hash'leri tutulur. Test kabul edilen v1.0 metin hash'ini sabitler. Bu hash kayıt bütünlüğü için yardımcıdır; tek başına elektronik imza veya banka doğrulaması değildir.

Hesaptaki sipariş geçmişi, kaydedilen sürümü ve snapshot'ı açar. Bilinmeyen sürümde güncel metin eski kabulün yerine gösterilmez. Migration yoksa veya eski siparişin belgesi yoksa açıklama gösterilir, mevcut sipariş listesi bozulmaz. Success sayfası gerçek ödeme onayı iddiası yapmaz; mevcut uyarı ve hesaba erişim linki var.

## Banka API

**HAYIR — mevcut 503 davranışı korunuyor.**

Create endpoint uygulaması aynıdır; sadece gelecekte kullanılması gereken legal guard için yorum eklendi. Callback ve feature flag dosyaları byte olarak değişmedi. Provider/key/3D Secure çağrısı yok.

## Kargo ve iletişim

Sepet halen shippingAmount = 0 kullanıyor; fiyat/ürün/stok iş mantığı değiştirilmedi. Bu değer ücretsiz kargo vaadi olarak sunulmuyor. Checkout özeti kargoyu “henüz belirlenmedi; sipariş teyidinde bildirilir” gösterir. Yeni teslimat metni sabit fiyat/eşik uydurmaz. Header'daki 3.000 TL ücretsiz kargo duyurusu da düzeltildi. Nihai kargo tutarı bilinmeyen snapshot sunucu kayıt hazırlığında reddedilir.

Müşteriye gösterilen eski info@nrs.com adresleri kaldırıldı; varsayılan iletişim e-postası ve .env.example rojhat1maman@gmail.com oldu. Tarihsel raporlar değiştirilmedi. Gelecekte hosting ortamında NEXT_PUBLIC_CONTACT_EMAIL farklı ayarlanırsa ayrıca doğru adresle güncellenmelidir.

## Testler

- ESLint: başarılı.
- TypeScript: npx tsc --noEmit --incremental false başarılı.
- Production build: başarılı; 42 route/page üretildi.
- Mevcut 27 + yeni 11 = **38 test, 38 başarılı, 0 başarısız/atlanmış**.
- Production HTTP: sekiz yeni route 200; returns/shipping 308; v1.0 arşiv 200, bilinmeyen sürüm 404; create/callback kabul bilgisi olsun/olmasın 503.
- Checkbox/component render ve olay testleri: label ilişkisi, required, ayrı KVKK linki, responsive alanlar, dokunma yüksekliği ve kabul değişiklikleri kontrol edildi. Desktop sayfa Chrome'da görsel incelendi. Gerçek mobil cihaz uçtan uca testi yapılmadı; mobil render fixture hazırlandı.
- Git diff/diff --check incelendi. Ürün kataloğu, sepet hesaplama, WhatsApp, BankTransferInfo, payment callback ve flag dosyalarının değişmediği doğrulandı. Üretilen next-env.d.ts ve tsconfig.tsbuildinfo başlangıç içeriğine döndürüldü.

## Kalan eksikler / banka entegrasyonu öncesi

1. Canlı orders şeması ve RLS yetkili ortamda doğrulanmalı; migration incelenip uygulanmalı. Yeni tablo owner erişimi iki ayrı müşteri oturumuyla gerçek DB'de test edilmelidir.
2. Gelecekteki ödeme sunucusu kabul guardını çağırmalı, alıcı kimliği/fiyat/stok/vergi/kargoyu kendi doğrulamalı ve hukuki kaydı siparişle atomik yazmalıdır. Bu çalışmada API aktivasyonu yapılmadı.
3. Kesin kargo tarifesi, taşıyıcı, iade taşıyıcısı ve siparişe özgü teslim süresi işletme tarafından belirlenmelidir. Bugünkü hesaplanan 0 kargo henüz nihai kargo ücreti değildir.
4. Hesapsız online siparişler için belgelerin güvenli e-posta/kalıcı veri saklayıcısı ile iletimi gerekir; keyfi order ID ile kişisel belge açan public route eklenmedi. Hesaplı kullanıcı için kayıt erişim UI'si hazırdır.
5. Mevcut MetaPixel onaydan önce PageView gönderiyor; ayrı reklam/analitik çerez tercih/rıza yönetimi yoktur. Supabase/Meta/WhatsApp veri bölgeleri, KVKK 9 aktarım dayanağı, fiili saklama/silme süreleri işletmece doğrulanmalı ve gerekli süreçler kurulmalıdır. Hukuki metinler mevcut eksikliği gizlemez; piksel kodu bu görevde değiştirilmedi.
6. Verilen ticari unvan aynen BOUTQUE olarak kullanıldı. MERSİS/ticaret sicili ve varsa KEP bilgisi verilmedi; uydurulmadı. Banka başvuru gereklilikleri kapsamında işletme tarafından tamamlanmalıdır.
7. Banka/ödeme sağlayıcısı belirlenince veri akışı, ödeme/iade koşulları ve ilgili metinler yeni sürümle güncellenmelidir. V1.0 geçmiş siparişler için korunmalıdır.
8. Hazırlanan metinlerin işletmenin fiili uygulamalarıyla ve güncel mevzuatla son hukuki kontrolü, gerçek mobil cihaz ve migration sonrası DB kabul/erişim testleri tamamlanmalıdır. Yerel değişiklikler henüz production'a yayımlanmadı.

## Resmi kaynaklar

- Ticaret Bakanlığı, 17 Ağustos 2026 Mesafeli Sözleşmeler bilgilendirmesi: https://tuketici.ticaret.gov.tr/yayinlar/tuketici-bilgi-rehberi/mesafeli-sozlesmeler-hakkinda-bilgilendirme
- KVKK aydınlatma yükümlülüğü: https://www.kvkk.gov.tr/Icerik/2033/Aydinlatma-Yukumlulugu-
- KVKK ilgili kişi hakları: https://www.kvkk.gov.tr/Icerik/2036/Ilgili-Kisinin-Haklari
- KVKK çerez rehberi: https://www.kvkk.gov.tr/Icerik/7353/Cerez-Uygulamalari-Hakkinda-Rehber
- KVKK başvuru usulü ve ilkeleri (Kurum yayını): https://kvkk.gov.tr/SharedFolderServer/CMSFiles/0517c528-a43d-49f5-b1eb-33dc666cb938.pdf
