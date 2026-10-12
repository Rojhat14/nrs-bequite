# NRS — bağımsız son güvenlik denetimi

09.10.2026. Kapsam: mevcut çalışma ağacı, önceki denetim raporu, Git diff’i ve özellikle `20261009120000_order_access_hardening.sql` / `20261009130000_payment_transaction_hardening.sql`.

## Sonuç

**FIXES_REQUIRED.** 1 HIGH ve 2 MEDIUM bulgu yerel PostgreSQL senaryolarında yeniden üretildi. İncelenen erişim modelinde anonim/müşteri yetki aşımı veya secret sızıntısı gösteren CRITICAL bulgu bulunmadı; bu, canlı şemanın güvenli olduğuna ilişkin bir garanti değildir.

Bu çalışma yeni geliştirme değildir. Uygulama kodu, migration’lar, önceki rapor ve kullanıcı değişiklikleri değiştirilmedi. Yalnızca bu bağımsız rapor eklendi; ek senaryolar `/tmp/nrs-final-review-probes.cjs` üzerinden sentetik, bellek içi PGlite veritabanında çalıştırıldı. Canlı Supabase’e bağlanılmadı; gerçek/veri kalıcı proje veritabanına migration uygulanmadı. Deploy, commit, push yapılmadı. Secret dosyaları okunmadı. Ödeme açılmadı.

## F-01 — HIGH: Belirsiz online ödeme admin tarafından iptal edilebiliyor; sonraki gerçek paid sonucu kaydedilemiyor

**Dosya/satırlar:**
- `supabase/migrations/20261009130000_payment_transaction_hardening.sql:202` — pending/payment_pending durumunda yalnızca cancelled geçişine izin veren kontrol, online payment state’ine bakmıyor.
- Aynı dosya `:143` — cancelled siparişe ilk paid settlement gelince finalize işlemi hata veriyor.
- Aynı dosya `:144` — doğrulanmış event ancak bu kontrolden sonra kaydedildiğinden çatışmalı paid olayı da saklanmıyor.
- `supabase/migrations/20261009120000_order_access_hardening.sql:82` — ara migration’daki admin RPC’de aynı iptal yaklaşımı var.
- `src/components/admin/OrderStatusForm.tsx:36` — pending/payment_pending için iptal eylemi gösteriliyor.
- `src/lib/payment/service.ts:60` — reconciliation da aynı finalize RPC’sini çağırıyor.

**Teknik gerekçe:** Satır kilidi eski okumanın yeni paid durumunu ezmesini engelliyor; fakat admin iptali önce commit ederse orders.status cancelled olurken payment_orders.state initiating/pending kalıyor. Sonradan sağlayıcı tarafından doğrulanmış paid sonucu SQL tarafından reddedilir. Aynı sonuçla reconciliation tekrar çağrıldığında da durum çatışması değişmez. Hata mesajındaki “reconcile” yönlendirmesi mevcut reconciliation fonksiyonuyla çözülemez.

**Yeni yerel kanıt:**
1. Atomik RPC ile giriş yapmış sentetik müşteri için sipariş, sözleşme ve son stok rezervasyonu oluşturuldu.
2. Aktif admin RPC’siyle cancelled yapıldı.
3. Doğru reference, tutar, TRY currency, transaction ve authenticated 3DS içeren sentetik doğrulanmış paid sonucu iki kez finalize’a verildi.
4. İki deneme de `order state conflict; reconcile` ile reddedildi.
5. Sonuç: `orders.status=cancelled`, `payment_orders.state=initiating`, `stock_quantity=0`, `payment_events count=0`.

Bu test bir bankanın imzasını doğrulamaz ve gerçek para hareketi yapmaz; güvenilir adapter sonucundan sonraki SQL davranışını gösterir.

**Müşteri/veri etkisi:** İleride ödeme açıldığında bankada tahsil edilmiş tutar uygulamada paid olarak kaydedilemeyebilir; sipariş iptal görünür, stok rezervasyonu ve aynı kullanıcı için unresolved ödeme engeli devam eder. Finansal kayıt/operasyon tutarsızlığı oluşur. Şu an boş registry ve kapalı ödeme sayesinde bu senaryo gerçek tahsilat üretmiyor.

**Önerilen çözüm:** Online initiating/pending ödeme için provider sonucu bilinmeden adminin kesin iptal geçişini kapatın; gerekiyorsa ayrı bir iptal talebi işleyin. Gerçek başarısızlık/iptal sonucunu güvenilir provider reconciliation belirlesin. İptal-talebi/settlement yarışında doğrulanmış mali sonuç kaybolmamalı, fulfillment ve refund gerekliliği ayrıca korunmalı. Banka refund protokolünü uydurmayın. Hem RPC hem UI kontrolü ve cancel-before-paid regresyon testi gerekli.

**Engellenen dosyalar:** Transaction hardening migration’ının bu akışı; access hardening içindeki ara admin RPC; admin status UI. En az bu düzeltme olmadan mevcut ödeme akışını staging için onaylamıyorum.

## F-02 — MEDIUM: NULL eski status, admin geçiş kontrolünde fail-open

**Dosya/satırlar:**
- `supabase/migrations/20261009120000_order_access_hardening.sql:91`
- `supabase/migrations/20261009130000_payment_transaction_hardening.sql:211`
- `tests/payment-database.test.cjs:37` — mevcut fixture status alanını NOT NULL yaparak bu sınırı test etmiyor.

**Teknik gerekçe:** Fonksiyon siparişin bulunmasını kontrol ediyor, fakat `current_status IS NULL` kontrolü yapmıyor. PostgreSQL’de NULL için IN/NOT IN ve eşitlik karşılaştırmaları NULL döndürür; IF bunu true saymaz. Böylece tüm geçiş kontrolleri atlanır ve allowed p_status değerlerinden biri yazılır. Kullanıcı tarafından bildirilen eski şemada status için NOT NULL garantisi verilmemiştir; migration preflight da bunu şart koşmaz.

**Yeni yerel kanıt:** Temsilî orders.status alanı NULL kabul edecek şekilde oluşturuldu. İki migration başarıyla çalıştı. `status=NULL` olan sentetik eski sipariş, aktif admin RPC’siyle doğrudan `shipped` durumuna geçirilebildi.

**Müşteri/veri etkisi:** Ödeme veya hazırlık durumu bilinmeyen eski sipariş yanlışlıkla sevk edilmiş gösterilebilir. Bu yalnızca aktif-admin yoludur; normal müşteri/anon yetki aşımı değildir. Canlıda NULL kayıt bulunduğu iddia edilmez.

**Önerilen çözüm:** Satır okunduktan sonra NULL/bilinmeyen status için açık hata üretin. Var olan NULL kayıtları ödeme/fulfillment bilgisi olmadan otomatik paid/processing yapmayın. Nullable eski şemayı temsil eden negatif test ekleyin. İki RPC tanımı da aynı güvenli kuralı kullanmalı.

**Engellenen dosyalar:** İki hardening migration’ındaki admin status fonksiyonları; test fixture’ının bu güvenlik varsayımı.

## F-03 — MEDIUM: Status preflight yeni fulfillment geçişlerini doğrulamıyor

**Dosya/satırlar:**
- `supabase/migrations/20261009130000_payment_transaction_hardening.sql:20` — yalnız payment_pending, paid, cancelled deneniyor.
- Aynı dosya `:193` — processing yazılıyor.
- Aynı dosya `:205` / `:208` — shipped/delivered geçişleri destekleniyor.

**Teknik gerekçe:** Migration sadece ödeme status değerlerinin mevcut CHECK ile uyumunu doğruluyor. İçerdiği admin fonksiyonunun yazdığı processing/shipped/delivered değerleri mevcut CHECK tarafından reddedilebilir; migration yine başarıyla kurulabilir. Fonksiyon gövdesinin kurulması tüm çalışma zamanı UPDATE constraint’lerini sınamaz.

**Yeni yerel kanıt:** Status CHECK yalnız pending/payment_pending/paid/cancelled kabul edecek şekilde sentetik şemada değiştirildi. Migration’ın preflight DO bloğu bu şemayı kabul etti; processing/shipped/delivered desteği yoktu. Gerçek Supabase’de bu CHECK bulunduğu iddia edilmez.

**Müşteri/veri etkisi:** Şema uyumlu sanılırken doğrulanmış siparişin hazırlık/kargo/teslimat güncellemesi çalışma zamanında bozulabilir. Hata transaction’ı geri alır; veri silmez.

**Önerilen çözüm:** Kullanılan bütün durumları mevcut enum/CHECK/NULL/default yapısıyla doğrulayın; uyumsuzlukta açık preflight hatası verin. İşletmenin gerçek eski statülerini sebepsiz değiştirmeyin. Desteklenmeyen fulfillment CHECK için negatif migration testi ekleyin.

**Engellenen dosya:** Transaction hardening migration’ının eksik status preflight’ı.

## 12 maddelik denetim sonucu

| Kontrol | Yerel kanıt / sınır |
| --- | --- |
| PostgreSQL sözdizimi ve sıra | İki migration mevcut test suite’inde gerçek PostgreSQL engine kullanan PGlite içinde yürütüldü. Syntax hatası yok. Foundation/admin ön koşulları → 20261008 legal → 20261008 transactions → access hardening → transaction hardening sırası gerekli. |
| Eski kolon/FK/constraint/index/fonksiyonlar | UUID order/user/variant, text product ID, numeric tutarlar ve FK hedefleri temsilî şemada uyumlu. orders.payment_id bağımlılığı yeni finalize’da yok. F-03 nedeniyle status uyumu eksik. Canlı ilave kolon/default/trigger/index/ACL doğrulanmadı. |
| NOT NULL kullanıcı / guest | UI’de yeni guest kart seçeneği yok; quote/create API getUser, service/repository ve create RPC signed-in gerektirir. orders.user_id NOT NULL korunur. WhatsApp hesapsız talep bağımsızdır. |
| Tablo izinleri | PUBLIC/anon/authenticated ALL kaldırılıyor; authenticated SELECT, service_role CRUD veriliyor. Service_role’un önceki ek izinleri otomatik temizlenmez; gerçek effective ACL/role membership staging’de okunmalı. |
| Kolon grant’leri | Bağımsız SELECT/INSERT/UPDATE/REFERENCES kolon grant’leri ayrıca revoke ediliyor; yalnız tablo REVOKE’ına güvenilmiyor. Yerel negatif testler bu eski kolon izni senaryosunu içeriyor. |
| RLS / admin / müşteri | orders/order_items eski permissive policy’leri değiştirilerek owner veya mevcut aktif-admin predicate ile SELECT sağlanır. Authenticated doğrudan yazımı ve anon CRUD yerel testte reddediliyor; başka müşteri okuyamıyor. |
| Eski akış / doğrudan yazım | İncelenen checkout/payment yolları orders/order_items için doğrudan client INSERT/UPDATE yapmıyor; server repository RPC kullanıyor. Admin status mevcut secured RPC; profile SELECT user_id filtreli. WhatsApp mesaj/link üretir, online order/paid yazmaz. Diğer profile/favorite/product yazımları kapsam dışı tablolardadır ve değiştirilmedi. |
| SECURITY DEFINER / EXECUTE | İki migration’ın definer fonksiyonları boş search_path kullanıyor; tablo isimleri qualified. Create/finalize ile eski read/redirect RPC’leri anon/authenticated/Public EXECUTE’a kapalı, service_role’a açık. Admin RPC’leri authenticated tarafından çağrılabilir ama mevcut auth.uid + aktif admin tablosu predicate’iyle korunur. Canlı function owner, inherited grants ve predicate gövdesi ayrıca doğrulanmalı. |
| Para / callback / stok | DB quote + kilit altında RPC kontrolü; legal/order/items/reservation atomik. NULL 3DS ve bozuk tutar/currency/provider/event replay reddediliyor; unique transaction ve bir kez stok iadesi testleri geçiyor. F-01 cancel-before-paid kontrolü başarısız. Çok bağlantılı race/yük testi yapılmadı. |
| Legal sürüm / hash | Frontend/server merkezi kaynakta v1.1; SQL v1.1 kabul ediyor. v1.0 arşivi korunur. Hash ve zaman server’da hazırlanır; client price/hash metadata’sı doğrudan sipariş kaydı yapılmaz. SQL hash’i bağımsız yeniden hesaplamaz: service-only, server-verified payload güven sınırı vardır. |
| Guest erişimi / IDOR / token | 32 random byte token, DB’de SHA-256 hash ve expiry; server getUser + cookie capability ile service-only read RPC. ID tek başına yetki vermez. Müşteri legal SELECT’i owner RLS ile korunur; admin ayrı predicate kullanır. Yeni guest token/cookie oluşturma yolu kapalı olduğundan yeni issuance/cookie davranışı tamamlanmış guest checkout olarak raporlanamaz. |
| Varsayılan flags / tekrar / veri kaybı | `.env.example:17` false ve `:27` false; config’de açık true olmadan ödeme/DB kullanımı yok. provider.ts registry boş: env true olsa da açılmıyor. İki migration BEGIN/COMMIT; hata aynı dosyada rollback ister, rerun marker’ları abort eder. DROP TABLE/TRUNCATE/veri DELETE yok; DROP yalnız policies üzerinde. Dosyalar arası tüm paket tek transaction değildir; ikinci dosya başarısızsa birincisi commit edilmiş olabilir. Flags kapalı tutulmalı ve history kontrol edilmelidir. |

## Bu denetimde yeniden çalıştırılan kontroller

- `npm test`: **80 test, 80 PASS, 0 FAIL, 0 skipped**. Bu yeni çalıştırmanın log’u `/tmp/nrs-final-review-tests.log`; önceki sonuç kopyalanmadı.
- `npm run lint`: PASS, exit 0; `/tmp/nrs-final-review-lint.log`.
- `./node_modules/.bin/tsc --noEmit --incremental false`: PASS, exit 0; `/tmp/nrs-final-review-types.log`.
- `node /tmp/nrs-final-review-probes.cjs`: üç ek yerel senaryo F-01/F-02/F-03’ü yeniden üretti. Script gözlemleri raporlar; exit 0 olması bu iş akışlarının güvenli geçtiği anlamına gelmez.
- `git diff --check`: PASS. Git durumu/diff ve ilgili yeni dosyalar incelendi.
- Production build, Chrome/mobile ve HTTP testleri **bu denetimde yeniden çalıştırılmadı**; önceki rapordaki sonuçlar yeni kanıt olarak sunulmuyor.

80 mevcut testin geçmesi bulguları ortadan kaldırmaz: mevcut testler cancel-before-paid durumunu, nullable legacy status’u ve fulfillment CHECK preflight sınırını kapsamıyor.

## Doğrulanamayanlar ve korunan sınırlar

Gerçek Supabase şeması, production RLS/grants/role inheritance, function owners/body/ACL, migration history, gerçek müşteri kayıtları ve çok bağlantılı eşzamanlılık doğrulanmadı. Doğru projeye uygulanabilirlik yalnız bu fixture’dan çıkarılamaz; staging doğrulaması gerekli.

Gerçek PayTR adaptörü, banka/merchant bilgileri, gerçek callback imza doğrulaması, 3DS protokolü, sandbox ve reconciliation/refund entegrasyonu eksik kalmıştır. Testlerdeki sentetik verified result gerçek banka doğrulaması değildir. Yeni provider kaydı yapılmadı. Gerçek production environment dosyaları okunmadığından production değerleri hakkında iddia yoktur; kaynak/örnek varsayılanları kapalı ve registry boş kaldı.

Yeni migration oluşturulmadı: görev yalnız denetimdir. Düzeltme çalışmasında F-01/F-02/F-03 için ayrı, açıklamalı migration ve regresyon testleri hazırlanmalı; geçmiş dosyalar sessizce değiştirilmemeli. Bu rapor staging uygulaması, deployment veya ödeme açma onayı vermez.

**Nihai karar: FIXES_REQUIRED.**
