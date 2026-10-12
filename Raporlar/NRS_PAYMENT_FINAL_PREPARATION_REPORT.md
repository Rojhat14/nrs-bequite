# NRS banka/POS hazırlığı — 08.10.2026

## A) Tamamlananlar

Çalışma yerel repository ve production build üzerinde tamamlandı; canlı domaine deploy edilmedi. Başlangıçta önceki hukuki/checkout çalışmasının commit edilmemiş değişiklikleri vardı; bunlar korundu. Başlangıç ve bitiş git durumları, diff ve korunması gereken kaynak dosyalar kontrol edildi.

- Sekiz hukuki route, footer bağlantıları, sitemap, /returns ve /shipping 308 uyumluluğu mevcut.
- Şirket unvanı BOUTQUE yazımıyla aynen korundu; MERSİS, KEP, sicil ve banka bilgisi uydurulmadı.
- Checkout: sunucudan nihai özet → başlangıçta boş sözleşme onayı → Siparişi Ver ve Ödeme Yap → atomic sipariş → sağlayıcı yönlendirmesi.
- Fiyat, indirim, para birimi ve stok sunucu kataloğundan okunuyor; client fiyat/total/shipping/userId alanları kullanılmıyor.
- Order + items + legal record + stok rezervasyonu tek PostgreSQL fonksiyonunda. Callback sonucu ayrı, atomic işlemde uygulanıyor.
- İmzalı bildirim ve 3DS return doğrulaması sağlayıcı interface'inde; algoritma veya gerçek bankaya çağrı eklenmedi.
- İdempotency key, referans, transaction ve callback event benzersizliği; belirsiz tahsilatı tekrar başlatmama davranışı.
- Başarılı/başarısız/verify ekranları yalnızca veritabanında doğrulanmış ödeme durumunu ve yetkili erişimi kullanıyor.
- Misafir erişimi 256-bit rastgele HttpOnly/SameSite çerez; DB'de yalnızca SHA-256 hash ve 30 günlük süre. Sipariş ID'si tek başına yetki sağlamaz. Başka cihaz/süre sonrası mevcut iletişim üzerinden kimlik doğrulamayla belge talebi gerekir; otomatik e-posta teslimi eklenmedi.
- Profil sipariş belgeleri korundu; admin sipariş detayına aynı belge görüntüleyici eklendi.
- Meta Pixel silinmedi. Başlangıçta yüklenmiyor; ayrı reklam izniyle yükleniyor. Reddetme ve sonradan geri alma mevcut. Sözleşme onayı KVKK/pazarlama rızasına dönüştürülmedi.

## B) Supabase migration

**NOT APPLIED — MIGRATION UYGULANAMADI.** Supabase CLI/psql/docker, bağlı CLI projesi, DB bağlantısı veya service-role anahtarı bulunmadı. Salt okunur anonim OpenAPI şema isteği HTTP 401 döndü. Bu nedenle gerçek PK/FK, kolonlar, zorunlu alanlar, status constraints ve mevcut RLS doğrulanamadı; canlı SQL çalıştırılmadı.

| Migration | İçerik |
|---|---|
| 20261008120000_order_legal_records.sql | UUID orders.id FK, order başına tek immutable legal record, owner SELECT RLS; müşteri yazma/silme yetkisi yok; UPDATE ve DELETE trigger ile engelli; order silme RESTRICT |
| 20261008130000_payment_order_transactions.sql | payment_orders, payment_stock_reservations, payment_events; service-role-only transaction RPC'leri; yeni legal admin SELECT policy; mevcut tablolar/policies değiştirilmez |

Yeni payment tabloları tarayıcıya kapalıdır. RPC'ler PUBLIC/anon/authenticated rollerine kapalı; yalnızca service_role çalıştırabilir. Güvenlik tanımlayıcı fonksiyonların search_path'i boştur. Legal snapshot müşterinin order.user_id sahipliği üzerinden okunur; admin mevcut nrs_is_active_admin() kullanır.

Migration'lar varsayımlar farklıysa durdurur. Mevcut orders/order_items tablolarının tüm kolon/default/check/enum/FK bilgileri **uygulamadan önce** okunmalıdır. Yerel fixture şeması, canlı şema değildir. Özellikle gerçek order_items.id default'u ve orders.status için payment_pending/paid/cancelled kabulü teyit edilmelidir.

Gerçek PostgreSQL motorunda (PGlite) temsilî şemaya her iki migration uygulanıp 12 test çalıştırıldı: atomic kayıt, rollback, duplicate, stok yetersizliği, owner/diğer müşteri/admin okuması, client RPC/yazma engeli, immutable kayıt, orphan/FK, tutar/para birimi, tekrar callback, misafir token/süre ve başarısız ödeme stok iadesi. Bunlar canlı RLS testi olarak raporlanmaz. Çok bağlantılı canlı eşzamanlılık/load testi yapılmadı; SQL row locks ve advisory lock hazır.

## C) Payment ready

Provider abstraction: src/lib/payment/types.ts + provider.ts + service.ts.

Tek etkinleştirme anahtarı server-only PAYMENT_ENABLED. UI'ya yalnızca doğrulanmış kullanılabilirlik boolean'ı geçer; başlangıç false. Gerçek adapter registry şimdilik boştur. Sadece environment yazmak, adapter implementasyonu olmadan ödeme açmaz. Yanlışlıkla PAYMENT_ENABLED=true yapılsa da adapter, DB ve teslimat yapılandırması eksikse sistem kapalı kalır.

Environment şablonu .env.example:
PAYMENT_PROVIDER, PAYMENT_MERCHANT_ID, PAYMENT_API_KEY, PAYMENT_API_SECRET, PAYMENT_BASE_URL, PAYMENT_CALLBACK_URL, PAYMENT_3DS_RETURN_URL, PAYMENT_ENABLED=false.

Ayrıca server-only SUPABASE_SERVICE_ROLE_KEY, PAYMENT_DATABASE_VERIFIED=false, PAYMENT_SHIPPING_MINOR, PAYMENT_DELIVERY_TERMS. Son üç ayar banka bilgisi değildir; DB testleri ve işletmenin kesinleşmiş teslimat politikası gerektirir. Secret'lar NEXT_PUBLIC alanlarına konmadı; eski PAYTR_* değerleri değiştirilmedi ve yeni katmanda kullanılmıyor.

Endpoint'ler:
- POST /api/payment/quote: nihai server özeti; kapalıyken 503.
- POST /api/payment/create: onay + güncel sürüm + quote hash + gerçek authenticated user + atomic sipariş; kapalıyken 503.
- POST /api/payment/callback: adapter imza/doğrulaması → merchant/reference/amount/currency/transaction/status/3DS → atomic sonuç → bankaya özgü acknowledgement; kapalıyken 503.
- POST /api/payment/return: adapter doğrulanmış 3DS/browser return → atomic sonuç → verify. GET return claimed status'u kabul etmez; yalnızca DB görüntüleme yönlendirmesi. Kapalıyken 503.

Provider interface: initiate, verifyCallback, verifyReturn, reconcile, callbackResponse, allowedRedirectOrigins. Gerçek banka protokolüne göre merchant reference eşleştirmesi, imza, hosted ödeme/3DS, response acknowledgement ve reconciliation doldurulacak. Sahte/örnek bankaya canlı adapter bulunmaz.

Aynı request key ve sahiplik tekrarında mevcut redirect kullanılır; ikinci provider çağrısı yapılmaz. Timeout/cevap kaybı durumunda aynı siparişin durumu bankadan reconcile edilmeden tahsilat tekrarlanmaz. Kesin failed sonucunda rezervasyon bir kere geri bırakılır. Belirsiz pending stok rezervasyonu otomatik süre dolumu ile serbest bırakılmaz; bankaya özgü reconciliation job/operasyon prosedürü adapter ile birlikte yapılandırılmalıdır. Admin iptali ile banka sonucu çelişirse callback otomatik paid yapmaz, reconciliation gerekir.

**HAYIR — mevcut 503 davranışı korunuyor.** Gerçek banka çağrısı/para çekme yapılmadı.

## D) Legal

| Belge | Route | Footer | Checkout |
|---|---|---|---|
| Mesafeli Satış Sözleşmesi | /mesafeli-satis-sozlesmesi | Var | Onay linki + tam metin |
| Ön Bilgilendirme Formu | /on-bilgilendirme-formu | Var | Onay linki + tam metin |
| İade ve Değişim | /iade-ve-degisim | Var | Zorunlu onay değil |
| İptal Koşulları | /iptal-kosullari | Var | Zorunlu onay değil |
| Gizlilik Politikası | /gizlilik-politikasi | Var | Ayrı çerez bilgisi |
| KVKK Aydınlatma Metni | /kvkk | Var | Bilgilendirme linki; kabul checkbox'ı yok |
| Kullanım Koşulları | /kullanim-kosullari | Var | Zorunlu onay değil |
| Kargo ve Teslimat | /kargo-ve-teslimat | Var | Siparişe özgü bedel/koşul özeti |

Güncel contract/pre_information sürümleri v1.1; önceki v1.0 aynen arşivde. Değişen ödeme/kargo/çerez davranışı eski kabul metni üzerine yazılmadı. Her iki arşivin deterministik document hash'i testte sabitlenmiştir. Bilinmeyen eski sürüm yerine güncel metin gösterilmez. Yeni sürüm çıkarılırken arşiv, merkezi sürüm ve DB legal version kontrolü birlikte güncellenmelidir.

Legal record: order_id, contract_accepted, contract_version, pre_information_version, accepted_at, document_hash, summary_hash, order_summary. Snapshot ürün ID/ad/açıklama/beden/adet/birim fiyat, alıcı/adres, subtotal/discount/shipping/total/TRY, ödeme/teslimat koşulları ve server tarihini kapsar. IP/user-agent eklenmedi. Kart numarası/CVV alınmıyor veya kaydedilmiyor.

Gizlilik/KVKK metinleri bilinmeyen sağlayıcı bölgeleri, aktarım mekanizması veya saklama süresi hakkında kesin iddia içermiyor. Gerçek işletme veri envanteri/aktarım dayanağı ve saklama politikası hâlâ işletme tarafından teyit edilmelidir; bir çerez banner'ı bu yükümlülüklerin tamamlandığının kanıtı değildir.

## E) Checkout

Checkbox başlangıçta unchecked; cart/customer/quote değişince kabul geçersizleşir. Checkbox olmadan payment/create isteği yok; bu actual component handler testinde doğrulandı. Nihai server quote yoksa onay olsa da ödeme yok. Server legal preflight ayrı kontrol eder. Satış butonu: **Siparişi Ver ve Ödeme Yap**. Online ödeme kapalı olduğundan kart UI ve checkbox müşteriye gizlidir; WhatsApp kendi mevcut akışıyla görünür/aktif kalır.

Mevcut cart shipping=0 hesabı değiştirilmedi. Bu değer hukuki ücretsiz kargo vaadi yapılmadı. Online ödeme için PAYMENT_SHIPPING_MINOR (kuruş, sıfır dahil açık işletme kararı) ve PAYMENT_DELIVERY_TERMS doldurulmadan payment hazır sayılamaz. Gerçek taşıyıcı/hazırlık/teslimat süresi uydurulmadı.

## F) Testler

- TypeScript: npx tsc --noEmit PASS.
- ESLint: npm run lint PASS.
- Production build: npm run build PASS; ilk sandbox DNS hatasından sonra ağ erişimli build tekrar başarılı.
- npm test: **65/65 PASS**, skip yok; bunun 12'si yerel PostgreSQL transaction/RLS testidir.
- Yerel production HTTP: 8 legal route 200, /returns ve /shipping 308, v1.0 arşiv 200, bilinmeyen sürüm 404, dört payment endpoint 503, success/failure/verify sahte status=paid kabul etmiyor, sitemap sekiz legal route içeriyor.
- İzole headless Chrome: gerçek legal sayfa hydration kontrolü; 320/390/1280px yatay taşma yok. Gerçek consent component + production CSS fixture'ında boş checkbox, linkler, tıklama alanları ve buton genişliği kontrol edildi. Fiziksel telefon ve canlı ödeme checkout uçtan uca testi değildir.
- Browser testinde React Context Provider server/client sınır hatası bulundu, function component ile düzeltildi; regresyon testi eklendi ve son build tarayıcıda tekrar doğrulandı.
- node scripts/check-payment-readiness.cjs: 22 kaynak/invariant grubu PASS; DB, teslimat politikası ve deployment/sandbox eksikleri açıkça NOT_VERIFIED/NOT_CONFIGURED/NOT_PERFORMED. Rapor: NRS_PAYMENT_READINESS_CHECKLIST.json.

Tekrar çalıştırma: npm test; npm run lint; npx tsc --noEmit; npm run build. Mobil test: production sunucusu 3118'de açıkken node scripts/check-payment-ui.cjs (CHROME_BIN ve PAYMENT_TEST_URL isteğe bağlı).

## Değişen/eklenen dosyalar

- src/lib/payment/{types,config,provider,request,service,repository,access,http}.ts → güvenli ortak provider/ödeme/sipariş/doğrulama/erişim katmanı.
- src/app/api/payment/{create,callback,quote,return}/route.ts → kapalı gate, server ön kontrol, callback ve 3DS dönüş altyapısı.
- src/lib/feature-flags.ts; src/app/layout.tsx; src/components/CartDrawer.tsx; src/app/faq/page.tsx → server availability boolean'ının UI'ya güvenli aktarımı.
- src/app/checkout/page.tsx → quote, güncel onay, ödeme payload/redirect ve hatalar.
- src/components/payment/PaymentResult.tsx; src/app/checkout/{success,failure,verify}/page.tsx → yetkili DB durumuna bağlı sonuç/snapshot/belgeler.
- src/app/admin/(protected)/orders/[id]/page.tsx → legal belgeler.
- src/lib/legal/documents.ts; src/lib/legal/versions/v1-1.ts → v1.1 yayın, v1.0 arşivini koruma.
- src/components/CookieConsent.tsx; src/lib/cookie-consent.ts; src/components/MetaPixel.tsx → ayrı çerez tercihi ve izin kapısı.
- supabase/migrations/20261008120000_order_legal_records.sql → immutable DELETE engeli, gereksiz service DELETE grant'ini kaldırma.
- supabase/migrations/20261008130000_payment_order_transactions.sql → atomik sipariş/ödeme ve stok rezervasyonu SQL'i.
- .env.example → yalnızca boş/sahte olmayan environment alanları ve kapalı flag.
- package.json; package-lock.json → sadece geliştirme/test PostgreSQL motoru.
- tests/{legal,payment,payment-database}.test.cjs; tests/source-loader.cjs → frontend/server/provider/SQL/RLS testleri.
- scripts/check-payment-{ui,readiness}.cjs; Raporlar/NRS_PAYMENT_* → tekrar üretilebilir kontroller ve rapor.

Önceki çalışma dosyaları (8 route, legal bileşenleri, Footer, Navigation, redirects, profile OrderHistory, sitemap, contact config ve WhatsApp contact test düzeltmesi) korunmuştur. Korunan çekirdek dosyalar için git diff HEAD boş: src/lib/products.ts, src/store/useCart.ts, src/lib/whatsapp-order.ts, CartWhatsappOrder, BankTransferInfo, AuthContext, middleware ve mevcut admin RLS migration'ı. Ürün verisi/fiyat/stock/customer tablosu veya canlı veritabanı değiştirilmedi. Gelecekte açılan online akışın rezervasyon RPC'si stock_quantity'yi transactional olarak değiştirecektir.

## G) Bankaya özgü kalanlar

Gerçek provider/banka adı, merchant ID, API key/secret, API/sandbox URL'leri, ödeme başlatma formatı, callback imza yöntemi, 3DS/return protokolü, callback acknowledgement, idempotency/reconciliation davranışı. Bunlar gelince adapter doldurulur ve bankanın sandbox testleri yapılır. Checkout'u yeniden yazma gerektiren banka bağımlılığı component içine gömülmedi.

## H) Final status

**PARTIALLY_READY — READY_FOR_BANK_API durumuna henüz ulaşılmadı.**

Bankadan bağımsız açık engeller:
1. Yetkili canlı Supabase bağlantısıyla gerçek şema/RLS/constraints/defaults denetlenmeli; SQL uyarlaması gerekiyorsa yapılmalı; iki migration uygulanmalı ve gerçek customer/admin/guest/transaction/RLS testleri çalıştırılmalı. PAYMENT_DATABASE_VERIFIED ancak bundan sonra true.
2. İşletme kargo bedeli ve teslimat politikası kesinleştirmeli.
3. Gerçek veri envanteri/aktarım ve saklama politikası işletmece teyit edilmeli.
4. Bu değişiklikler canlı domaine deploy edilmedi; deployment sonrası smoke test gerekli.

Ödeme kapalıdır. Gerçek banka entegrasyonu, sandbox para işlemi, üretim tahsilatı veya canlı migration yapılmış gibi raporlanmamıştır.

## Başvurulan kaynaklar

- [Supabase database functions](https://supabase.com/docs/guides/database/functions): transaction fonksiyonları, security definer ve search_path.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): owner/RLS ve servis rolleri.
- [KVKK çerez rehberi](https://www.kvkk.gov.tr/Icerik/7353/Cerez-Uygulamalari-Hakkinda-Rehber): ayrı, isteğe bağlı çerez tercihleri.
- [KVKK açık rıza](https://www.kvkk.gov.tr/Icerik/2037/Acik-Riza-Alirken-Dikkat-Edilecek-Hususlar): sözleşme/aydınlatma ile açık rızanın ayrılması.
