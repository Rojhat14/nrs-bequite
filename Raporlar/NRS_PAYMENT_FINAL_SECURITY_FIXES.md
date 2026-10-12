# NRS — son güvenlik denetimi düzeltmeleri

Tarih: 09.10.2026. Önceki bağımsız rapor: `NRS_PAYMENT_FINAL_SECURITY_REVIEW.md`. Bu ek rapor yalnız F-01 HIGH, F-02 MEDIUM ve F-03 MEDIUM düzeltmelerini kapsar; önceki rapor tarihsel kanıt olarak korunmuştur.

**Sonuç: FIXES_VERIFIED — üç bulgu düzeltilmiş migration zinciri ve uygun yerel PostgreSQL testleriyle doğrulandı. Canlı Supabase/PayTR doğrulaması değildir.**

## Geçmiş, migration durumu ve sınırlar

- İşe başlamadan `git status --short` ve Git geçmişi okundu. Branch `main`, son commit `de8f4e5`. Kullanıcının mevcut kapsamlı değişiklikleri korundu.
- İki hardening migration'ı çalışma ağacında untracked; `git log --all -- ...` içinde geçmişleri bulunmadı. Bu, canlıya uygulanmadıklarını kanıtlamaz. Canlı migration history okunmadı; canlı uygulanma durumu **bilinmiyor**.
- Bu nedenle eski migration dosyaları değiştirilmedi; ayrı `supabase/migrations/20261009140000_final_security_review_fixes.sql` hazırlandı. Eski admin RPC tanımlarının yerini bu migration alır; yalnız eski iki dosyayı uygulamak bulguları çözmez.
- Gerçek Supabase'e bağlantı/SQL, canlı migration, deploy, commit/push yapılmadı. Secret dosyaları okunmadı. Test verisi yalnız sentetik/yereldir.
- `PAYMENT_ENABLED=false`, `PAYMENT_DATABASE_VERIFIED=false` örnek varsayılanları ve boş provider registry korundu. Production env değerleri okunmadığından gerçek canlı değerler hakkında iddia yoktur.

## F-01 HIGH — belirsiz ödeme sırasında admin iptali

**Önce:** Admin `initiating/pending` online siparişi cancelled yapabiliyordu; sonradan doğrulanmış paid sonucu ve aynı finalize kullanan reconciliation reddediliyordu. Stok rezervasyonu ve ödeme kaydı belirsiz kalıyordu.

**Düzeltme:** Yeni migration'daki `nrs_admin_update_order_status()` önce payment_orders satırını, sonra orders satırını `FOR UPDATE` kilitler. Bu sıra mevcut `nrs_finalize_payment()` ile aynıdır. Online payment state `paid/failed` dışında ise bütün operasyon değişiklikleri DB katmanında reddedilir. Callback'ten önce admin gelirse iptal başarısız olur; callback önce gelirse admin commit edilmiş paid durumunu görür. Aktif admin kontrolü, boş search_path ve EXECUTE sınırı korunur.

Admin formuna server'dan dar ödeme metadata'sının state'i iletilir; belirsiz ödemede iptal/durum formu yerine açıklama gösterilir. Metadata okunamasa veya eski UI kullanılsa da DB kontrolü zorunludur. Online ödeme kaydı olmayan mevcut offline/WhatsApp siparişlerinin geçiş kuralları korunur.

`nrs_finalize_payment()` ve provider doğrulama katmanı yeniden yazılmadı. Bunların mevcut doğrulanmış paid/failed transaction'ı; event idempotency, tek stok rezervasyonu ve failed halinde tek stok iadesi davranışları yeni testlerle doğrulandı. Admin iptali hiçbir rezervasyonu serbest bırakmaz. Paid durumda stok tüketilmiş rezervasyon olarak korunur; yalnız kesin failed sonucunda released olur.

**Regresyonlar:**

- initiating ve pending sırasında iptal reddi, sipariş/ödeme/event/stok durumunun değişmemesi;
- gecikmeli paid, aynı event replay'i ve yeni event ID ile aynı paid sonucu: ikinci stok düşümü yok;
- kesin failed sonucu, aynı/ikinci failed event: stok yalnız bir kez geri gelir; ardından çelişkili paid reddi;
- `reconcilePayment()` → sentetik provider-authenticated sonuç → gerçek SQL finalize ile belirsiz işlemin paid olması; bozuk 3DS reddi;
- native PostgreSQL'de bağımsız authenticated admin ve service_role callback bağlantılarıyla yarış: hem admin-first hem callback-first. `pg_stat_activity` üzerinden ikinci bağlantının gerçekten Lock beklediği doğrulandı; ardından gerçek RPC çağrıları ve COMMIT çalıştırıldı. Test helper'ının ilk kilidi superuser ile alınır, RPC çağrısından önce gerçek caller rolüne dönülür; müşteriye yeni tablo izni verilmez.

**Açık risk / canlı öncesi:** Yeni preflight, geçmiş cancelled/NULL/diğer order status ile initiating/pending payment çelişkisi varsa **durur**. Bu kayıtları otomatik paid veya pending yapmaz. Gerçek provider sonucuyla manuel uzlaştırma planı gerekir; mevcut SQL reconciliation'ın böyle tarihsel çelişkileri tek başına çözebildiği iddia edilmez. Gerçek refund ve PayTR settlement protokolü hâlâ eksiktir.

## F-02 MEDIUM — NULL/bilinmeyen durumlarda fail-open

**Önce:** `current_status NOT IN (...)` karşılaştırması NULL döndüğünde kontroller atlanabiliyordu. NOT NULL fixture bu sınırı göstermiyordu.

**Düzeltme:** Yeni RPC, eski durum NULL veya bilinen eski durum allowlist'i dışında ise açıkça hata üretir. Yeni durum da önce mevcut operasyon allowlist'iyle doğrulanır; NULL/unknown/paid yeni durum olarak kabul edilmez. Geçerli paid → processing ve offline hazırlık/kargo/teslimat geçişleri korunur. Eski migration'lar değiştirilmeden son tanım güvenli biçimde yerine geçirilir.

Preflight yalnız NULL/bilinmeyen eski kayıtların **sayısını NOTICE ile bildirir**. Kayıt değeri veya müşteri bilgisi loglamaz; otomatik veri düzeltmesi yapmaz. Canlı kayıt sayısı bu görevde tespit edilmedi.

**Regresyonlar:** Nullable status fixture'ı üzerinde eski NULL ve unknown text, yeni NULL/unknown/paid, unpaid → shipped, terminal durumdan geçiş ve geçerli offline geçişler gerçek PostgreSQL engine kullanan PGlite ile sınandı. Reddedilen işlem sonrası status/stock/event/reservation snapshot'ının değişmediği kontrol edildi. Mevcut paid → preparation/delivery regresyonları da yeni migration ile yeniden çalıştı.

**Açık risk / canlı öncesi:** Gerçek eski NULL/unknown kayıtlar varsa ilgili ödeme ve operasyon kanıtıyla manuel incelenmelidir; tahmini backfill yapılmamalıdır.

## F-03 MEDIUM — eksik status preflight

**Önce:** Sadece payment_pending/paid/cancelled CHECK uyumu test ediliyor, adminin yazdığı processing/shipped/delivered doğrulanmıyordu.

**Düzeltme:** Yeni migration önce bağımlı RPC'leri, merchant_id hardening ön koşulunu, gerekli kolon tiplerini, user_id NOT NULL ve payment_orders order PK/FK ilişkisini doğrular. Create/finalize/admin akışlarının yazdığı bütün durumlar (`pending`, `payment_pending`, `paid`, `processing`, `shipped`, `delivered`, `cancelled`) gerçek pg_constraint ifadeleri üzerinden değerlendirilir. Composite status CHECK güvenli şekilde değerlendirilmek üzere açık hata ile durur. Beklenmeyen enum/domain tipleri körlemesine genişletilmez; explicit schema review hatası üretilir.

Fonksiyon replacement'ı ancak bütün preflight kontrollerinden sonra yapılır. Migration BEGIN/COMMIT içindedir; hata durumunda ROLLBACK gerekir. Status constraint/enum/default değiştirilmez, satır güncellenmez. Uyumlu şemada tekrar çalıştırma aynı fonksiyon/izin tanımını üretir ve veri değiştirmez.

**Regresyonlar:** Uyumlu CHECK ve tekrar çalıştırma; processing, shipped, delivered veya pending eksik CHECK; composite CHECK; enum ve text-domain uyuşmazlığı. Başarısız preflight'ın RPC gövdesini veya sipariş verisini değiştirmediği kontrol edildi. Native PostgreSQL yarış fixture'ında da tam migration zinciri başarıyla kuruldu.

**Açık risk / canlı öncesi:** Temsilî şema gerçek Supabase şeması değildir. Gerçek CHECK/enum/domain/default/trigger, function owner ve effective grants staging'de incelenmelidir. Eski migration preflight'ı tarihsel olarak eksik kalır; yeni corrective migration dahil tüm zincir tamamlanmadan hazır sayılmaz.

## Bu görevde değiştirilen/eklenen dosyalar

| Dosya | Değişiklik |
| --- | --- |
| `supabase/migrations/20261009140000_final_security_review_fixes.sql` | Ayrı düzeltme migration'ı; kapsamlı preflight ve güvenli admin RPC replacement. |
| `src/components/admin/OrderStatusForm.tsx` | Belirsiz online ödeme için operasyon formunu kapatan açıklama. |
| `src/app/admin/(protected)/orders/[id]/page.tsx` | Mevcut server metadata state'ini forma iletme. |
| `tests/payment-database.test.cjs` | Önceki DB regresyonlarını yeni migration zinciri üzerinde çalıştırma. |
| `tests/payment-security-fixture.cjs` | Nullable status ve sentetik müşteri/stok içeren izole ortak test fixture'ı. |
| `tests/payment-security-fixes.test.cjs` | 15 ek SQL/servis/UI regresyonu. |
| `tests/payment-security-race.test.cjs` | 2 native PostgreSQL, iki bağlantılı transaction/kilit yarışı testi. |
| `Raporlar/NRS_PAYMENT_FINAL_SECURITY_FIXES.md` | Bu ek rapor. |

Git diff'in diğer dosyaları önceki kullanıcı çalışmalarına aittir; bu görevde geri alınmadı. Ürün/fiyat/stok uygulama mantığı, profiller/favoriler, WhatsApp, checkout/provider/callback kodu ve geçmiş migration dosyaları değiştirilmedi. Yeni migration tablo/RLS/kolon grant'lerini değiştirmez; yalnız mevcut admin RPC EXECUTE sınırını yeniden belirtir.

## Yeni test sonuçları

| Komut | Gerçek sonuç |
| --- | --- |
| `NRS_LOCAL_POSTGRES_PACKAGES=/private/tmp/nrs-isolated-postgres-review npm test` | **97/97 PASS, 0 FAIL, 0 skipped**. Önceki 80 test + 17 yeni regresyon; son tam koşu ~8 saniye. |
| `npm run lint` | PASS, exit 0. |
| `./node_modules/.bin/tsc --noEmit --incremental false` | PASS, exit 0. |
| `python3 scripts/check-payment-build-isolated.py` | PASS, exit 0; script geçici secret-free kopyada `npm run build` çalıştırdı, 42 statik sayfa üretildi. Sentetik LOCAL katalog; production bağlantısı/yayını değildir. |
| `git diff --check` | PASS. |

Log'lar: `/tmp/nrs-security-fixes-all-tests.log`, `/tmp/nrs-security-fixes-race.log`, `/tmp/nrs-security-fixes-lint.log`, `/tmp/nrs-security-fixes-types.log`, `/tmp/nrs-security-fixes-build.log`. Build ayrıntı log'u: `/var/folders/2p/mlth1ghn0j51crxn2rfmzlwc0000gn/T/nrs-security-build-ex6ytrkm/verification-build.log`.

Native paketler yalnız `/private/tmp/nrs-isolated-postgres-review` altında kuruldu (`embedded-postgres`, `pg`); repo package/lock dosyaları değiştirilmedi. Native engine PostgreSQL 18.4; canlı engine sürümü doğrulanmadı. Test kendi geçici kümesini 127.0.0.1 üzerinde oluşturup durdurur; harici DB URL'si kabul etmez. Normal `npm test` paket-root değişkeni verilmezse bu iki test açıkça skip olur; raporlanan son koşuda değişken verildi ve **ikisi de çalıştı**.

İlk sandbox koşularında localhost bind engeli yaşandı; izinli yerel koşularla tekrarlandı. İlk native yarış denemesinde test helper'ı authenticated rolle doğrudan payment_orders kilidi almaya çalıştığı için permission denied verdi; helper düzeltildi, browser rolüne izin eklenmedi, sonra bütün testler tekrarlandı. Erken boş test dosyası sonucu başarı kanıtı sayılmadı; son log'da iki adlandırılmış yarış testi ve tam 97 test açıkça mevcuttur. Önceki 80/80 raporu kopyalanmadı.

## Staging / canlı migration öncesi ve kurtarma

1. Ayrı yetkili işlemde gerçek migration history, schema/constraints/owners/grants ve mevcut NULL/unknown veya cancelled-unresolved kayıtları inceleyin; güvenli backup/metadata export alın. Bu görev bunları yapmadı.
2. Sıra: mevcut foundation/admin → 20261008120000 legal → 20261008130000 transactions → 20261009120000 access → 20261009130000 transaction hardening → **20261009140000 fixes**. Zaten uygulanmış migration'ları körlemesine tekrar çalıştırmayın.
3. Yeni migration geçmezse ROLLBACK yapın; önceki dosyaların commit'i tüm zincir için otomatik geri alınmaz. Uyumsuz constraint/enum veya tarihsel ödeme çelişkilerini açık inceleme ile çözün. Kurulum sırasında admin durum yazımlarını da bakım süresince durdurun; eski unsafe RPC ile yeni RPC arasındaki geçici aralığı kullanıcı işlemlerine açmayın.
4. Staging'de gerçek RLS/ACL/customer ownership ve bu negatif/race testlerini gerçek engine sürümünde tekrar çalıştırın. Yeni migration'ı tek başına geri alıp eski güvensiz fonksiyonu yeniden etkinleştirmeyin; hata varsa ödeme kapalı ve operasyon bakımı açık kalsın, yeni forward correction hazırlayın. Veri silme/stock backfill kurtarma planı değildir.
5. Gerçek PayTR adapter/protokol/signature/3DS ve sandbox testleri hâlâ eksiktir. Buradaki sentetik verified sonuçlar gerçek sağlayıcı doğrulaması yerine geçmez. Kart ödemesi ve DB-verified flag kapalı kalmalıdır.

**FIXES_VERIFIED**
