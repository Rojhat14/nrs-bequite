# NRS Supabase migration denetimi — 09.10.2026

## İncelenen tablolar ve gerçek ilişkiler

**Canlı şema bu oturumda doğrulanamadı.** Aşağıdakiler repository'deki kaynak/migration tanımlarıdır; gerçek veritabanı DDL/FK/RLS sonucu olarak değerlendirilmemelidir.

| Kaynakta görülen yapı | Kaynak kanıtı / doğrulama sınırı |
|---|---|
| public.orders | Profile OrderHistory orders.user_id = authenticated user.id filtresi kullanıyor. Admin RPC UUID order_id alıyor. orders CREATE TABLE/PK/customer FK/customer owner policy DDL'i mevcut migration dosyalarında bulunmuyor. |
| public.order_items | Admin ve ödeme kodu order_id/product_id/quantity/price_at_purchase kullanıyor. Gerçek id default'u, PK/FK, kolon tipleri ve RLS bilinmiyor. |
| public.profiles, public.wishlist | Auth/profile/favori kodları mevcut. Admin migration bu tabloların önceden var olmasını şart koşuyor; müşteri owner policy ve gerçek FK tanımları bu kaynaktan doğrulanamıyor. |
| public.products | Foundation SQL: id text PK, price_amount numeric(12,2), compare_at_price numeric, in_stock boolean, status text. Bu dosyanın canlıda uygulandığı doğrulanmadı. |
| public.product_variants | Foundation SQL: id UUID PK, product_id text FK products.id, stock_quantity integer >= 0, is_active boolean. Canlı karşılığı doğrulanmadı. |
| auth.users / public.admin_users | Payment SQL yeni user_id FK'sini auth.users.id'ye kuruyor. Mevcut admin predicate auth.uid() + aktif admin_users kaydı kullanıyor. orders.user_id'nin canlıda auth.users veya profiles ile gerçek ilişkisi bilinmiyor. |

Mevcut migration'ların tamamında şema, RLS ve grants tanımları incelendi. Ürün public-read/admin policies ve customer/order tablolarına eklenen admin SELECT policy'leri kaynakta mevcut; bunların canlı politika envanteriyle eşleşmesi doğrulanamadı.

## Migration'ların uygulanma durumu

**BU OTURUMDA UYGULANMADI.** Canlıda daha önce uygulanmış olup olmadıkları da bilinmiyor; canlı migration geçmişi okunamadı.

- supabase/migrations/20261008120000_order_legal_records.sql
- supabase/migrations/20261008130000_payment_order_transactions.sql

Bağlantı denetimi:
- PATH'te Supabase CLI, psql veya docker yok; node_modules/.bin/supabase yok.
- supabase/config.toml ve supabase/.temp/project-ref yok; doğrulanmış bağlı proje bulunmuyor.
- .env.local'da public Supabase URL/anon key ile eski PAYTR alanları var; service-role/DB connection bilgisi yok. Mevcut process environment'ta da yetkili Supabase/DB bağlantı değişkeni yok.
- Kullanılabilir yetkili Supabase/PostgreSQL connector bulunmadı.
- Secret değerleri terminale yazdırılmadı; sadece environment alanlarının isimleri kontrol edildi.
- Önceki anonim 401 şema doğrulaması sayılmadı; bu oturumda anonim API ile müşteri/sipariş sorgusu yapılmadı.

Doğru proje kimliği ve canlı şema doğrulanamadığından apply adımına geçilmedi. Öncesi/sonrası canlı migration durumu için başarı iddiası yok.

## Eklenen tablo, fonksiyon ve RLS politikaları

**Bu oturumda canlıya hiçbir nesne eklenmedi.** Hazır SQL dosyalarının oluşturmayı planladığı nesneler:

- order_legal_records: UUID order_id PK/FK → orders.id, ON DELETE RESTRICT; kabul, sürümler, zaman, document/summary hash ve JSON özet.
- nrs_prevent_legal_record_update() + nrs_order_legal_records_immutable trigger: UPDATE ve DELETE engeli.
- nrs_order_legal_records_owner_read: orders.user_id = auth.uid() üzerinden SELECT.
- nrs_order_legal_admin_read: mevcut nrs_is_active_admin() üzerinden SELECT.
- payment_orders: sipariş FK, auth.users FK, hash'lenmiş misafir capability, expiry, idempotency, tutar/para birimi/ödeme state.
- payment_stock_reservations: order + variant FK, miktar, bir kez serbest bırakma durumu.
- payment_events: provider + event_id unique; callback tekrar kontrolü.
- nrs_create_payment_order(), nrs_store_payment_redirect(), nrs_finalize_payment(), nrs_read_payment_order(): PUBLIC/anon/authenticated EXECUTE iptal, service_role EXECUTE grant; SECURITY DEFINER ve boş search_path.
- Üç yeni payment tablosunda RLS açık, doğrudan browser grants iptal. Mevcut profiles/wishlist/products/orders policies için DROP/yeniden yazma yok.

İki dosyada DROP/TRUNCATE veya migration çalışırken müşteri verisi silen bir DML yok. Yeni tabloların RLS ayarları dışında mevcut tabloya ALTER yapılmıyor. Ancak ileride RPC çağrıldığında orders.status/payment_id ve product_variants.stock_quantity değiştiriliyor; bu migration'ın canlıya uygulanmasıyla ödeme işlemi başlatılması aynı şey değildir.

### Uygulamadan önce doğrulanması gereken uyumluluk

Mevcut SQL guard'ları **eksiksiz canlı schema audit yerine geçmez**:

1. orders.id gerçekten UUID PK/unique olmalı; orders.user_id UUID olmasının yanında gerçek customer FK ve auth.uid() eşleşmesi teyit edilmeli.
2. order_items.order_id UUID, product_id tip uyumu, id/default, quantity/price_at_purchase ve tüm required/generated kolonlar incelenmeli.
3. orders.payment_id mevcut olmalı; ikinci migration preflight kolon listesinde payment_id yok ama callback bunu UPDATE ediyor.
4. orders.status tipi/check/enum payment_pending, paid ve cancelled değerlerini kabul etmeli. Misafir akışı için orders.user_id NULL kabul etmeli. Bunlar mevcut guard tarafından tam doğrulanmıyor.
5. ürün/variant gerçek kolon tipleri, stok constraints ve mevcut trigger davranışı incelenmeli.
6. orders üzerindeki RLS owner politikasının legal SELECT EXISTS sorgusunu doğru kullanıcıya izin verecek şekilde çalıştığı doğrulanmalı. Admin predicate ve grants de gerçek tanımlarla kontrol edilmeli.
7. SQL GRANT ifadelerinden bağımsız olarak canlı default privileges/effective ACL'ler incelenmeli. Özellikle service_role üzerinde varsayılan geniş yetkiler kalıp kalmadığı yalnızca dosyadan kesinleştirilemez.
8. İsim çakışmaları, mevcut legal alan/tablo, function overload ve migration history kontrol edilmeli; guard hatası varsa mevcut tablo silerek aşılmamalı.

Bu bilgiler olmadan migration dosyalarına tahminle müdahale edilmedi ve SQL Editor için "koşulsuz güvenli" onayı verilmedi.

### Sipariş ve sözleşme entegrasyonu

Kaynak bağlantısı mevcut:
checkout → payment/create → initiatePayment → repository.createAtomic → nrs_create_payment_order RPC.

RPC aynı transaction içinde order, items, legal record, payment kaydı ve stok rezervasyonu oluşturuyor. Legal insert başarısızsa önceki order insert de rollback oluyor; bu davranış yerel PostgreSQL'de doğrulandı. Callback ayrı transaction'da doğrulanmış referans/tutar/para birimi ile state değiştiriyor ve tekrar callback/stock iadesini kontrol ediyor.

**Canlı uçtan uca entegrasyon doğrulanmadı ve aktif değil.** Payment create kapalı gate'te 503 dönüyor; gerçek provider registry boş; DB verified/service-role ayarları eksik. WhatsApp/havale iletişim akışları bu online RPC'ye zorla bağlanmadı. Gerçek order INSERT'leri veya müşteri verileriyle deneme yapılmadı.

## Test sonuçları

- npm test: **65/65 PASS**, skipped 0.
- Yerel PostgreSQL (mevcut PGlite bağımlılığı): 12 test PASS. Temsilî fixture şeması kullanıldı; gerçek müşteri verisi yok.
- Kapsam: atomik order+legal, legal insert rollback, orphan/duplicate FK, kendi/diğer customer/admin SELECT, müşteri INSERT/UPDATE/DELETE/RPC engeli, privileged UPDATE/DELETE trigger, last-stock koruması, callback amount/currency, tekrar callback ve bir kez stok iadesi, guest capability/expiry.
- npx tsc --noEmit: PASS.
- npm run lint: PASS.
- npm run build: PASS.
- Yeni salt okunur audit SQL: boş yerel PostgreSQL'de sözdizimi PASS; canlıya çalıştırılmadı.
- Yeni bağımlılık yüklenmedi; package.json/lock/test dosyaları değiştirilmedi.

Yerel tests/payment-database.test.cjs müşteri/admin policy'leri için temsilî tanım oluşturuyor. Bu, gerçek admin_users veya canlı customer RLS'nin doğrulandığı anlamına gelmez. Çok bağlantılı canlı concurrency ve effective production role grants testi yapılmadı.

## Yapılan dosya değişiklikleri

Yalnızca yeni denetim belgeleri eklendi:
- Raporlar/NRS_SUPABASE_SCHEMA_AUDIT_20261009.sql → salt okunur metadata, FK/PK/constraints/enum/RLS/grants/trigger/function/default ACL sorguları.
- Raporlar/NRS_SUPABASE_MIGRATION_AUDIT_20261009.md → bu rapor ve güvenli uygulama sırası.

İki hedef migration, uygulama kodu, environment dosyaları ve mevcut kullanıcı değişiklikleri değiştirilmedi. Başlangıçta mevcut tüm dosyaların SHA-256 hashleri kaydedildi. Build-generated next-env.d.ts ve tsconfig.tsbuildinfo içerikleri bu oturumun başlangıç kopyalarına döndürüldü; HEAD üzerinden kullanıcı değişikliği geri alınmadı.

## Canlı veritabanında doğrulanamayan noktalar

Doğru proje kimliği; gerçek order/customer PK/FK; required/default/status/generated alanlar; stok trigger/constraints; mevcut owner/admin RLS; etkin/default grants; mevcut migration history; yeni tabloların canlı varlığı; gerçek customer izolasyonu/immutability; atomic RPC'nin production ortamında çalışması. Bunların hiçbirine "tamamlandı" denmedi.

## Kartla ödeme durumunun hâlâ kapalı olduğu

PAYMENT_ENABLED değiştirilmedi. Yerel config'te etkin ödeme ayarı yok; API create/callback 503 testleri geçti. Gerçek sağlayıcı bağlantısı, banka isteği veya para çekme yapılmadı. WhatsApp, havale, katalog, fiyat, stok, sepet, profil ve favori mantığı değiştirilmedi.

## Sonraki gerekli adımlar

1. Yetkili Supabase Dashboard'da doğru NRS projesinin project ref'ini sitenin yapılandırılmış Supabase URL'siyle karşılaştırın. Gizli anahtarları bu rapora veya sohbet içine kopyalamayın.
2. SQL Editor'da **önce Raporlar/NRS_SUPABASE_SCHEMA_AUDIT_20261009.sql** dosyasını çalıştırın. Salt okunur transaction kullanır; müşteri/sipariş/ürün satırlarını okumaz. Sonuçları güvenli şekilde saklayın.
3. Migration history tablosu gerçekten varsa audit dosyasının sonunda yorum olarak verilen version sorgusunu ayrı çalıştırın. İki hedef version ve mevcut nesnelerin önceden oluşturulup oluşturulmadığını belirleyin.
4. Yukarıdaki sekiz uyumluluk maddesini gerçek sonuçlarla eşleştirin. Fark varsa iki SQL dosyasını canlı şemaya göre yeniden incelemeden çalıştırmayın. Önceden uygulanmış dosyayı yeniden çalıştırmayın; mevcut nesneleri silmeyin.
5. Uyumluluk ve doğru proje kesinleşince önce isolated staging/test ortamında sentetik kullanıcı/ürünlerle owner/RLS/transaction testlerini çalıştırın. Üretimde gerçek müşteri siparişleriyle test yapmayın.
6. Ardından SQL Editor'a dosyaları **tam içerikleriyle, ayrı ayrı ve şu sırayla** yapıştırın:
   - supabase/migrations/20261008120000_order_legal_records.sql
   - supabase/migrations/20261008130000_payment_order_transactions.sql
   Her dosyanın kendi BEGIN/COMMIT'i vardır. Hata olursa ikinciye geçmeyin; gerekiyorsa yalnızca ROLLBACK ile açık transaction'ı kapatın ve nedeni inceleyin. DROP/TRUNCATE/reset kullanmayın.
7. Uygulama sonrası aynı metadata audit'i tekrar çalıştırıp önceki snapshot ile karşılaştırın: mevcut policies/grants/constraints korunmuş mu, sadece beklenen yeni nesneler eklenmiş mi, FK doğru mu, trigger enabled mı? Customer yetkilerini yetkili sentetik test ortamında kontrol edin.
8. CLI bağlantısı sonradan sağlanırsa `supabase migration list` ile local/remote history'yi karşılaştırın. `db push` öncesi pending listesini inceleyin; eski migration'ların topluca yeniden uygulanmasına izin vermeyin. SQL Editor çalıştırılması CLI migration history'yi otomatik kaydetmez; history repair ancak gerçek uygulama kanıtlandıktan sonra ayrı değerlendirilmelidir. [Supabase migration dokümanı](https://supabase.com/docs/guides/deployment/database-migrations).
9. Bu işlem için PAYMENT_ENABLED veya PAYMENT_DATABASE_VERIFIED ayarını true yapmak gerekmiyor; ödeme kapalı kalmalı. Canlı doğrulama tamamlanmadan DB verified ayarını da değiştirmeyin.
