# NRS ödeme, hukuki checkout ve sipariş güvenliği denetimi

Tarih: 09.10.2026. Çalışma dizini: `/Users/rojhatmaman/boutique-luxury`.
Başlangıç branch’i: `main`; son commit: `de8f4e5` (`push the code`).

**Sonuç: PARTIALLY_READY.** Yerel kod, migration ve güvenlik testleri tamamlandı. Gerçek PayTR adaptörü/protokolü, hedef veritabanı doğrulaması, migration uygulaması ve işletmenin kesin teslimat politikası olmadan üretim ödeme hazırlığı tamamlanmış sayılamaz.

## Sınırlar ve kanıtın kapsamı

- Başlangıçta `git status --short`, branch ve commit incelendi. Zaten çok sayıda değiştirilmiş/eklenmiş dosya vardı; kullanıcının bu çalışmaları korunmuştur. Aşağıdaki dosya listesi bu görevde yapılan ek değişiklikleri belirtir, HEAD’den itibaren tüm eski çalışmaları değil.
- Canlı Supabase’e bağlanılmadı; CLI bağlantısı, production SQL, migration uygulaması veya gerçek müşteri verisiyle test yapılmadı. **Bütün yeni migration’lar NOT APPLIED.** Canlı izin/RLS doğrulaması yapılmış gibi raporlanmaz.
- `.env`, `.env.local` ve production secret dosyaları okunmadı. Yalnızca `.env.example` incelendi. Gerçek production environment değerleri bu nedenle doğrulanmış değildir.
- `.env.example` ve kod varsayılanları `PAYMENT_ENABLED=false`, `PAYMENT_DATABASE_VERIFIED=false`. Gerçek provider registry’si boş; bayrak yanlışlıkla açılmış olsa bile sağlayıcı yoksa ödeme kullanılmaz. Kart UI’si kapalıdır; create/callback/quote/return API’leri yerel production çalışmasında 503 verdi.
- Banka/POS/PayTR çağrısı, gerçek kart tahsilatı, 3DS işlemi, provider kaydı veya deployment yapılmadı. Test sağlayıcıları yalnızca unit test fixture’larında bulunmaktadır.

## İncelenen tablolar ve ilişkiler

Aşağıdaki mevcut şema bilgileri kullanıcının sağladığı doğrulanmış bulgular, repository migration’ları ve uygulama sorguları üzerinden incelendi; bu oturumda canlı şema introspection’ı yapılmadı.

| Tablo | İncelenen yapı / ilişki |
| --- | --- |
| `orders` | `id uuid` PK; `user_id uuid NOT NULL`; `total_amount numeric`; `status text`; mevcut müşteri ve teslimat adresi kolonları. Kullanıcının belirttiği kullanıcı FK’sinin `ON DELETE CASCADE` davranışı değiştirilmedi. |
| `order_items` | `id uuid`, `order_id uuid → orders.id`, `product_id text`, `quantity integer`, `price_at_purchase numeric`. Yerel fixture’da sipariş FK’si ve PK doğrulandı. |
| `products` | `id text`, `price_amount numeric`, `compare_at_price`, `currency`, `status`, `in_stock`. Fiyat kaynağı olarak server-side okunur; veri/şema değiştirilmedi. |
| `product_variants` | `id uuid`, `product_id text → products.id`, `stock_quantity integer NOT NULL`, `is_active boolean`; varyant-ürün eşleşmesi ve kilit altında stok kontrolü. |
| `admin_users` | Mevcut `nrs_is_active_admin()` fonksiyonu `auth.uid()` için `role='admin' AND is_active=true` kontrolünü SECURITY DEFINER ve boş search_path ile yapıyor. Yeni politikalar bu doğrulamayı kullanır. Yerel testte gerçek bu predicate modeli, aktif/pasif admin kayıtlarıyla sınandı. |
| `order_legal_records` | Eski hazırlanan migration: `order_id uuid` PK/FK → `orders.id ON DELETE RESTRICT`; kabul, sürümler, zaman, belge/özet hash’leri ve JSON sipariş özeti. UPDATE/DELETE trigger ile engellenir. |
| `payment_orders` | Siparişe FK; kullanıcı/legacy guest sahipliği; unique idempotency key ve merchant reference; provider, tutar, currency, ödeme state, transaction ID. Provider+transaction ID unique index. |
| `payment_stock_reservations` | Sipariş/varyant FK; `(order_id,variant_id)` PK, miktar ve tek seferlik `released` durumu. |
| `payment_events` | `(provider,event_id)` PK; sipariş FK, transaction, tutar, currency, durum ve 3DS. Yeni migration, replay karşılaştırması için `merchant_id` ekler. |

Yeni preflight’lar beklenen tipleri, PK/FK bağlantılarını, sahiplik nullability’sini, admin RPC ön koşullarını ve mevcut status CHECK constraint uyumunu inceler. Uyuşmazlıkta migration durur. Tekrarlı uygulama sessizce atlanmaz; migration geçmişi incelenmesi istenir. Gerçek ilave kolon/default/trigger/grant’ler staging öncesi ayrıca okunmalıdır.

## Bulunan sorunlar ve düzeltmeler

| Risk | Bulgu | Yapılan işlem / kalan kapsam |
| --- | --- | --- |
| Kritik | Kullanıcı bulgularında `order_items_access_policy` / `order_items_policy`: PUBLIC, ALL, USING(true); anon/authenticated CRUD izinleri ve orders public INSERT. | Ayrı migration, sadece orders/order_items politikalarını sahiplik/aktif-admin SELECT kurallarıyla değiştirir; tablo VE kolon ACL’lerini temizler. Anon erişim ve browser yazımı yerel testte reddedildi. **Canlıya uygulanmadığından canlı risk giderilmiş sayılmaz.** |
| Yüksek | `orders.user_id NOT NULL` iken guest payment create null kullanıcı gönderebiliyor. | Yeni misafir kart checkout’u kapatıldı. UI’de misafir kart seçeneği kaldırıldı; quote/create API, service/repository ve RPC giriş yapmış kullanıcı gerektirir. Mevcut orders FK/nullability değişmedi. WhatsApp hesapsız talep göndermeyi sürdürür. |
| Yüksek | SQL’de NULL değerler `<>` / NOT IN kontrollerinden geçebiliyor. | Callback alanları tip/eksiklik bakımından açık doğrulanır; NULL/missing/failed 3DS ile paid reddedilir. Tutar/currency/reference/replay karşılaştırmaları NULL-safe yapıldı. |
| Yüksek | Çelişkili callback tekrarları ve bilinmeyen settlement sırasında yeni ödeme riski. | Event’in merchant, transaction, sipariş, state, tutar, currency ve 3DS alanları karşılaştırılır; terminal state bozulamaz. Aynı key tekrarında ikinci sipariş/provider initiation yoktur. Aynı kullanıcı için yeni key ile ikinci unresolved ödeme de owner advisory lock ve kontrol ile reddedilir; provider reconciliation gerektirir. |
| Yüksek | Admin eski pending okumasıyla callback’in paid sonucunu ezebilir. | Mevcut admin durum RPC’si yeni migration’da sipariş satırını FOR UPDATE kilitler. Aktif-admin doğrulaması ve mevcut operasyon geçişleri korunur; admin paid oluşturamaz/ezemez. |
| Yüksek | Cache’den dönen payment redirect, yeni redirect gibi allowlist kontrolünden geçmiyordu. | Yeni ve tekrar kullanılan redirect’lerde HTTPS, URL credential yasağı ve provider origin allowlist aynı şekilde uygulanır. |
| Orta | Eski SQL, kullanıcı tarafından listelenmeyen `orders.payment_id` kolonuna yazıyor. | Yeni finalize fonksiyonu bu kolona bağımlı değil. İşlem ID’si mevcut `payment_orders.transaction_id` içinde tutulur. Eksik payment_id ile temsilî şemada paid finalize testi geçti; admin eski opsiyonel gösterimi korunur. |
| Orta | Product in_stock bayrağı varyant stoklarıyla güncellenmiyor. | Katalog zaten aktif varyant stoklarını esas alıyor. Payment quote/RPC de aktif seçilmiş varyant stoklarını esas alacak şekilde eşitlendi. Legacy boolean’a yazılmadı; 0 stok checkout’ta reddedilir, admin stok işleyişi değiştirilmedi. |
| Orta | Repository kullanılmayan `sku` alanını quote sorgusunda zorunlu kılıyordu. | Gereksiz alan sorgudan çıkarıldı; mevcut gerçek zorunlu varyant alanları kullanılır. |
| Orta | Doğrulanmış paid sipariş admin panelinde hazırlığa alınamıyordu. | Payment state mevcut payment_orders tablosunda paid kalır; aktif admin mevcut processing/shipped/delivered operasyon geçişlerini yapabilir. Sonraki paid callback fulfillment durumunu ezmez. Kart iadeli iptal banka refund akışı olmadan reddedilir. |
| Orta | Tekrar özet inceleme her seferinde yeni idempotency key oluşturuyordu. | Aynı checkout girdileri için key korunur. Key kaybı/değişen sepet durumunda unresolved-owner SQL kontrolü ikinci belirsiz tahsilatı engeller. |
| Orta | WhatsApp son adımı hukuki bilgilendirme bakımından zayıftı. | Belge linkleri ve mesaj göndererek talebi tamamlamaya ilişkin açıklama eklendi. Mevcut gerçek WhatsApp anchor’ı, mesaj içeriği ve havale uyarısı korunur; ödeme/sipariş onayı iddiası yapılmaz. |
| Dış bağımlılık | Gerçek PayTR protokolü, imza ve banka doğrulaması yok. | Registry boş kaldı. Generic/mock production adapter veya tahmini algoritma eklenmedi. |

## Migration’lar ve uygulanma durumu

### Mevcut dosyalar — değiştirilmedi, canlı uygulama doğrulanmadı

1. `supabase/migrations/20261008120000_order_legal_records.sql`
   - Siparişe bağlı hukuki kayıt; FK/PK, hash/check kontrolleri, owner SELECT, değiştirilemezlik trigger’ı.
2. `supabase/migrations/20261008130000_payment_order_transactions.sql`
   - Payment order/reservation/event tabloları, service-only RPC’ler, atomik sipariş+kalem+legal kayıt+stok rezervasyonu.
   - Bu dosyanın tarihsel NULL ve guest uyumsuzlukları yeni dosyayla düzeltilir; **tek başına son güvenli sürüm değildir**.

Başlangıç içerik hash’leriyle iki dosyanın değişmediği doğrulandı.

### Eklenen dosyalar — NOT APPLIED

3. `supabase/migrations/20261009120000_order_access_hardening.sql`
   - Şema, admin predicate ve admin status RPC preflight’ı; mevcut policy metadata’sını NOTICE ile kaydeder.
   - Sadece `orders` / `order_items` üzerindeki eski politikaları kaldırıp owner ve aktif-admin SELECT politikalarını oluşturur. Permissive politikalar OR ile birleştiğinden geniş bir eski policy bırakılmaz.
   - PUBLIC/anon/authenticated tablo ve bağımsız kolon izinlerini kaldırır; authenticated SELECT ve service_role CRUD erişimi sağlanır. `is_grantable=NO` izin yokmuş gibi yorumlanmadı.
   - Mevcut admin status fonksiyonunun satır kilidi eksikliğini düzeltir. SECURITY DEFINER, boş search_path ve aktif-admin kontrolü korunur.
   - Diğer ürün, profil, favori, storage ve admin policy’lerine dokunmaz; tablo/veri silmez.

4. `supabase/migrations/20261009130000_payment_transaction_hardening.sql`
   - Beklenen kolon tipleri, NOT NULL sahiplik, gerçek PK/FK hedefleri ve payment_pending/paid/cancelled status uyumluluğu için preflight.
   - `payment_events.merchant_id` nullable legacy alan olarak eklenir. Yeni event’lerde zorunlu RPC kontrolü vardır. Eski kayıtlara merchant bilgisi uydurulmaz; merchant alanı bilinmeyen eski replay güvenli biçimde reddedilir.
   - Create/finalize RPC’lerini aynı imzaları koruyarak güçlendirir: signed-in only, NULL-safe fiyat/özet/quantity, duplicate variant, gerçek varyant stoğu, same-key ve same-owner unresolved kontrolleri.
   - Legal kayıt, order_items ve stok rezervasyonu aynı SQL fonksiyonu/transaction içinde kalır. Hata bütün işlemi geri alır.
   - Finalize: verified-result şekil doğrulaması, tutar/currency/provider/reference eşleşmesi, event replay karşılaştırması, terminal state koruması, tek sefer stok serbest bırakma, transaction unique denetimi.
   - Aktif-admin-only `nrs_admin_payment_summary(uuid)` RPC’si token/guest hash/redirect paylaşmadan ödeme metadata’sını gösterir. Admin status RPC’si doğrulanmış paid siparişi mevcut processing durumuna alabilir; ödeme kaydı ayrı tabloda korunur. Kart iadeli iptal gerçek refund olmadan reddedilir.
   - `orders.payment_id` varsayımını kaldırır; service-only EXECUTE izinleri tekrar açıkça uygulanır. Provider signature algoritması içermez.

Önerilen sıra, staging’de mevcut foundation/admin prerequisite migration’ları doğrulandıktan sonra: **12000 legal → 13000 transactions → 09120000 access hardening → 09130000 transaction hardening**. Payment bayrakları tüm süreçte kapalı kalmalıdır. Bu çalışma bu sırayı yalnızca yerel fixture’da uygulamıştır.

## Checkout, hukuki belgeler ve erişim

| Belge | Route | Footer | Checkout / sipariş erişimi |
| --- | --- | --- | --- |
| Mesafeli Satış Sözleşmesi | `/mesafeli-satis-sozlesmesi` | Var | Onay linki, checkout metni ve yetkili sipariş belgesi |
| Ön Bilgilendirme Formu | `/on-bilgilendirme-formu` | Var | Onay linki, checkout metni ve yetkili sipariş belgesi |
| İade ve Değişim | `/iade-ve-degisim` | Var | WhatsApp bilgilendirme linki |
| İptal Koşulları | `/iptal-kosullari` | Var | Footer erişimi |
| Gizlilik | `/gizlilik-politikasi` | Var | Footer erişimi |
| KVKK | `/kvkk` | Var | Ayrı aydınlatma; zorunlu açık rıza checkbox’ı değildir |
| Kullanım Koşulları | `/kullanim-kosullari` | Var | Footer erişimi |
| Kargo ve Teslimat | `/kargo-ve-teslimat` | Var | WhatsApp bilgilendirme linki |

- `/returns` ve `/shipping` yeni sayfalara yönleniyor; yerel production HTTP testinde doğrulandı. Sekiz route sitemap’ta mevcut; SEO/canonical ve sitemap üretim kodu değiştirilmedi.
- Aktif contract/pre-information sürümü **v1.1**; güncel RPC sürümleriyle eşleşir. v1.0 ve v1.1 arşiv dosyaları bu görevde değiştirilmedi. Hash/arşiv/sürüm testleri geçiyor.
- Checkout onayı başlangıçta işaretsizdir; zorunlu checkbox ve belge linkleri vardır. Onay olmadan payment request oluşmaz; eski/yanlış sürüm server’da reddedilir. Sipariş girdisi/quote değişirse onay geçersizleşir.
- Hazır online satış butonu: **“Siparişi Ver ve Ödeme Yap”**. Production kart özelliği kapalıyken bu buton kullanıcıya gösterilmez. WhatsApp butonu görünür ve gerçek talep bağlantısını açar; kullanıcı mesajı göndererek talebi tamamlar. Site otomatik “ödendi” veya “kesin sipariş” üretmez.
- Server fiyat/stok/indirim/nihai tutarı DB’den hesaplar; browser fiyat/total/discount/shipping/hash/sahipliği sipariş tutarı olarak güvenilmez. Güvenli tam sayı tutar sınırı da kontrol edilir.
- Kabul sürümü, zaman ve deterministic document/summary hash’leri server’da üretilir; ticari özet snapshot’ı saklanır. IP / user-agent eklenmedi.
- Müşteri hesabında ve mevcut admin sipariş detayında `OrderLegalDocuments` vardır; profile geçmişi server tarafından yetkilendirilen ödeme/özet ekranına da bağlanır. Başarı ekranı browser status parametresine değil yetkili server kaydına bakar.
- Legacy guest erişim altyapısında random 256-bit token/hash ve süre kontrolü korunur. **Yeni guest kart siparişi desteklenmez.** Yerel legacy fixture yanlış/boş/süresi dolmuş capability ile erişimi reddeder. Sipariş ID’si tek başına erişim vermez.
- Şirket unvanı kullanıcı bilgisiyle aynı: **NRS BOUTQUE LUMINOUS TEKSTİL KONFEKSİYON VE SANAYİ TİCARET LİMİTED ŞİRKETİ**. VKN 6321569628, Doğanbey, verilen Beytepe adresi/e-posta/telefon korunmuştur; BOUTQUE düzeltilmemiştir. MERSİS/KEP/sicil/IBAN/provider bilgisi uydurulmadı. Kaynaklardaki iletişim adresi doğru; aktif src içinde eski `info@nrs.com` bulunmadı.
- Kargo hesabındaki 0, ücretsiz kargo vaadine çevrilmedi. Kesin shipping kuruş tutarı ve delivery terms gelmeden payment deployment guard açılmaz. Aktif v1.1 metni belirsiz tahmini teslimat vaadini kaldırıyor. Repository’de ayrı, uygulamada import edilmeyen `Navigation.tsx` sonunda backtick bulunan tarihsel dosyada 3.000 TL reklamı hâlâ var; bu kullanıcı dosyası silinmedi/değiştirilmedi.
- Meta Pixel varsayılan ayrı reklam izni olmadan yüklenmiyor; reddetmek alışverişi engellemiyor. Gerçek üçüncü taraf aktarım/saklama sözleşmeleri bu kod denetimiyle doğrulanmış sayılmaz. Hukuki uygunluk garantisi verilmez.

## Bu görevde değiştirilen / eklenen dosyalar

| Dosya | Değişiklik |
| --- | --- |
| `src/lib/payment/service.ts` | Signed-in guard; yeni/cache redirect allowlist kontrolü; doğrulanmış referans/alan şekilleri. |
| `src/lib/payment/repository.ts` | Signed-in atomic guard; provider bağlı idempotency; varyant esaslı stok; gereksiz sku sorgusunun kaldırılması; safe-integer toplam. |
| `src/app/api/payment/create/route.ts` | Giriş zorunlu; yeni guest token/cookie oluşturma kaldırıldı; 503 ve güvenli hata davranışı korundu. |
| `src/app/api/payment/quote/route.ts` | Quote için giriş gerekliliği; kapalı provider gate korunur. |
| `src/app/checkout/page.tsx` | Guest kart seçeneğinin kapatılması, oturum guard’ları, aynı girdi için idempotency key korunması. |
| `src/components/CartWhatsappOrder.tsx` | Hukuki linkler ve gerçek WhatsApp tamamlama açıklaması; mesaj/URL akışı değişmedi. |
| `src/lib/admin/data.ts` | Sipariş detayında dar admin payment summary RPC; migration yoksa eski görünüm korunur. |
| `src/app/admin/(protected)/orders/[id]/page.tsx` | Ayrı doğrulanmış ödeme durumu/transaction ID ve hazırlık izni gösterilir. |
| `src/app/profile/components/OrderHistory.tsx` | Sahipliği server’da doğrulanan ödeme durumu ve sipariş özeti sayfasına bağlantı; mevcut order listesi korunur. |
| `src/components/admin/OrderStatusForm.tsx` | Doğrulanmış paid siparişi hazırlığa alma; kart iadesi olmadan iptal seçeneği sunulmaz; mevcut değer select içinde açık gösterilir. |
| `src/components/payment/PaymentResult.tsx` | Yeni guest checkout’un kapalı olduğu açıklandı; server sonucu ve güvenli belge erişimi korunur. |
| `tests/legal.test.cjs` | Checkout harness signed-in akışa uyarlandı; gerçek handler/onay testleri korunur. |
| `tests/payment.test.cjs` | Guest engeli, cache redirect saldırıları ve legacy in_stock false + gerçek varyant stoku senaryoları. |
| `tests/payment-database.test.cjs` | NOT NULL kullanıcı, payment_id olmayan gerçekçi şema, gerçek aktif-admin predicate, açık eski ACL/policy fixture’ı; yeni migration’lar ve negatif/atomik testler. |
| `scripts/check-payment-readiness.cjs` | Guest kapalılığı ve yeni güvenlik migration kontrolleri; canlı doğrulanmışlık iddiası kaldırıldı. |
| `scripts/check-payment-build-isolated.py` (yeni) | Secret dosyalarını hariç tutan izole build, yalnızca yerel boş katalog, opsiyonel HTTP/Chrome kontrolleri. Test artifact’ı deploy edilmemelidir. |
| İki `20261009...` migration (yeni) | Yukarıdaki dar kapsamlı güvenlik düzeltmeleri. |
| `Raporlar/NRS_PAYMENT_READINESS_CHECKLIST.json` | Kaynak checklist yeniden üretildi; final durum PARTIALLY_READY. |
| `Raporlar/NRS_PAYMENT_LEGAL_SECURITY_AUDIT.md` (yeni) | Bu güncel denetim ve gerçek sonuçlar. |

Ürün/kategori/fiyat/stok verileri; `products.ts`, cart store, WhatsApp mesaj builder, BankTransferInfo, AuthContext, eski migration ve hukuki sürüm arşivleri başlangıç hash’leriyle **değişmemiş** olarak doğrulandı. Paket/lock değişiklikleri önceki çalışmadan mevcuttu; bu görev bağımlılık yüklemedi. Önceki diğer uncommitted dosyalar geri alınmadı.

## Test komutları ve gerçek sonuçlar

| Kontrol | Komut | Sonuç |
| --- | --- | --- |
| TypeScript | `./node_modules/.bin/tsc --noEmit --incremental false` | PASS, exit 0 |
| ESLint | `npm run lint` | PASS, exit 0 |
| Tüm mevcut testler | `npm test` | **80 test, 80 PASS, 0 FAIL, 0 skipped** |
| Kaynak hazırlık checklist’i | `node scripts/check-payment-readiness.cjs` | 23 SOURCE_PASS; canlı DB, teslimat politikası ve gerçek provider ayrı açık maddeler |
| Production build / HTTP / responsive | `python3 scripts/check-payment-build-isolated.py --http --browser` | İzole kopyada `npm run build` PASS; 18 production HTTP kontrolü PASS; Chrome 320/390/1280 px PASS |
| Diff kontrolü | `git diff --check`, `git status --short`, `git diff --stat` ve ilgili diff/hash incelemeleri | PASS; kullanıcı değişiklikleri korunur |

Build kopyası tüm `.env*` dosyalarını dışarıda tutar; secret’sız minimum env kullanır. Supabase yerine loopback boş katalog fixture’ı vardır. Production kaynak ve tasarım değiştirilmeden build edilir; bu **canlı katalog/veritabanı doğrulaması değildir**. Font indirmek ve loopback/Chrome çalıştırmak için sandbox dışı yürütme izni kullanıldı; canlı Supabase veya bankaya bağlanılmadı.

Yerel PostgreSQL testleri: anonim SELECT/INSERT/UPDATE/DELETE ve bağımsız kolon grant’leri; kendi/başka müşterinin order/item erişimi; aktif/pasif admin; service-only RPC sınırı; legal PK/FK/immutability; orphan/duplicate kayıt; atomic rollback; eksik/NULL/failed 3DS; yanlış tutar/currency/provider; merchant/transaction/state/3DS event çatışması; aynı transaction’ın iki order’a kullanılması; tek sefer stok düşümü/iadesi; stok yetersizliği; ürün/varyant uyuşmazlığı; sahte/missing summary; aynı key ve yeni key ile unresolved tekrar engeli; preflight şema/status/rerun hataları sınandı. 23 yerel veritabanı testi vardır. PGlite gerçek PostgreSQL engine’idir, Supabase production değildir; Admin hazırlık/kargo/teslimat sonrası payment state’in paid kalması ve sonraki callback’in teslimat durumunu ezmemesi de sınandı. Çok bağlantılı gerçek yük/race testi yapılmadı.

İlk başarısız denemeler gizlenmedi:
- İlk unit çalışmasında iki eski guest varsayımlı checkout testi başarısızdı; signed-in davranışına uyarlanıp tekrar çalıştırıldı.
- İlk izole build sandbox DNS nedeniyle Google Fonts indiremiyordu. İzinli tekrar font aşamasını geçti.
- Bir sonraki build dummy dış host üzerinde sitemap katalog sorgusu nedeniyle başarısızdı. Canlıya bağlanmak yerine loopback test katalog sunucusu eklenerek build ve sitemap HTTP kontrolü tamamlandı; production sitemap kodu değişmedi.

Çalıştırılmayanlar: canlı Supabase introspection/migration/RLS, gerçek müşteri verisiyle test, PayTR sandbox/signature/3DS, gerçek cihaz testi ve gerçek banka settlement/refund. Chrome responsive test, fiziksel cihaz testi değildir.

## Etkiler, kurtarma ve deployment planı

- Yeni migration’lar uygulanırsa browser rolü orders/order_items üzerinde doğrudan yazamaz. Repository’de eski doğrudan order INSERT bulunmadı: checkout service-only RPC; WhatsApp sadece talep; admin status güvenli RPC; profile kendi kayıtlarını okur. Başka deployment/eski harici istemci bu yazma izinlerine bağımlıysa staging’de ayrıca tespit edilmelidir.
- Customers/profiles/favorites/products/category/storage RLS ve verileri değişmez. Mevcut kullanıcı ilişkisi ve FK silme davranışı değiştirilmez. Legal/payment RESTRICT FK’leri nedeniyle hukuki kaydı olan siparişin veya cascading kullanıcı silme işleminin engellenmesi beklenir; veri saklama/hesap silme politikası ayrı değerlendirilmelidir.
- Migration’lar BEGIN/COMMIT ile atomiktir; preflight veya SQL hatasında transaction rollback gerekir. Başarısız migration’dan sonra aynı açık SQL Editor session’ında `ROLLBACK` yapıp nedeni incelemek gerekir; ödeme açılmamalıdır.
- Uygulama öncesinde yetkili operatör staging’de schema-only dump, grants/policies/function definitions ve migration history yedeğini almalı; schema/default/status/trigger/FK/admin predicate karşılaştırmasını tamamlamalıdır. Burada canlı yedek alınmadı.
- Uygulama sonrası sorun çıkarsa flags kapalı kalmalı; otomatik rollback/drop yapılmamalıdır. Önce ileri yönde düzeltici migration tercih edilmelidir. Eski fonksiyon/izin metadata’sı güvenli yedekten karşılaştırılabilir; **PUBLIC USING(true) veya anonim CRUD erişimini geri açmak kurtarma yöntemi değildir**.
- Yeni merchant_id alanı veya legal/payment tabloları veri oluşmuşsa geri alma amacıyla düşürülmemeli; event/sözleşme geçmişi ve immutable kayıtlar korunmalıdır. Gerekli fonksiyon/RLS değişikliği yeni denetlenmiş migration ile yapılmalıdır. Kaynak geri alma yalnızca bu görevin ayrı patch/commit’i üzerinden, önceki kullanıcı değişikliklerini koruyarak yapılmalıdır.

## Canlıya geçmeden açık kalanlar

1. Yetkili ayrı çalışma ile doğru Supabase projesinde schema/RLS/grants/trigger/function/default/status karşılaştırması; staging migration uygulaması ve gerçek anon/customer/admin/service-role negatif testleri. Bu görevde canlıya hiçbir migration uygulanmadı.
2. Kesin banka/PayTR ürün ve protokol dokümantasyonu: gerçek endpoint/parametreler, merchant ID, key/secret, callback signature ve merchant reference/tutar/currency/3DS durumları. Provider adapter ve callback ACK/return formatı ancak bu bilgilerle yazılmalı; sandbox doğrulanmadan registry’ye kayıt yapılmamalıdır.
3. Callback gecikmesi/timeout ve tek unresolved ödeme için bankanın gerçek reconciliation mekanizması ile güvenli operasyon/job hazırlanmalı. Interface vardır, gerçek job/provider çalışmıyor. Belirsiz ödeme otomatik failed sayılmaz; stok otomatik serbest bırakılmaz.
4. İşletmenin kesin kargo bedeli, teslimat şartı/süresi, gerçek havale bilgileri ve varsa özel üretim koşulları. `.env.example` boş alanları bu bilgileri uydurmaz; cart’taki 0 ücret garantisi değildir.
5. Gerçek banka refund entegrasyonu ve işletmenin iade operasyonu: doğrulanmış paid sipariş admin tarafından hazırlığa/kargoya/teslimata alınabilir; ödeme sonucu payment_orders içinde korunur. Kart iadesi yapılmış gibi manuel iptal engellenir. Gerçek provider refund işlemi bankanın protokolü geldiğinde ayrıca entegre edilmelidir; admin paid/refund sonucunu elle üretemez.
6. Hukuki/kişisel veri envanteri ve işletme belgeleri: bilinen şirket bilgileri karşılaştırıldı; bilinmeyen resmi bilgiler, gerçek sağlayıcı aktarım/saklama ve hesap silme/sözleşme saklama politikası yetkili işletme/hukuk değerlendirmesi gerektirir.
7. Sandbox uçtan uca testleri, gerçek çok bağlantılı eşzamanlı stok/settlement testleri, webhook replay, başarısızlık/timeout/reconciliation ve güvenli deployment kontrolleri. Bundan sonra doğru production environment kurulabilir; flags en son kontrollü açılır.

**BANKA API: HAYIR — mevcut 503 davranışı korunuyor.**
**Canlı Supabase migration: NOT APPLIED. Production ödeme: AÇILMADI.**
**READY_FOR_BANK_API durumuna ulaşıldığı iddia edilmez: PARTIALLY_READY.**
