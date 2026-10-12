# NRS Supabase canlı uyumluluk denetimi

**Durum: CANLIYA HAZIR DEĞİL.** Bu çalışma denetim SQL'ini ve değerlendirme çerçevesini hazırladı. Üretim Supabase'ine bağlanılmadı; üretim SQL'i uygulanmadı. Canlı denetim sonuçları henüz yok.

Denetim dosyası: [NRS_SUPABASE_LIVE_COMPATIBILITY_AUDIT.sql](NRS_SUPABASE_LIVE_COMPATIBILITY_AUDIT.sql).

İncelenen uygulama dosyaları [NRS_SUPABASE_SECURITY_APPLY.sql](NRS_SUPABASE_SECURITY_APPLY.sql) ve [prepare-customer-security-sql.py](../scripts/prepare-customer-security-sql.py) değiştirilmedi. Denetim, bu dosyalardaki güncel sekiz RPC manifestine dayanır; migration'ların canlıda uygulanmış olduğunu varsaymaz.

Ana tablo kapsamı: `orders`, `order_items`, `payment_orders`, `payment_stock_reservations`, `payment_events`, `order_legal_records`. RPC/müşteri bağımlılıkları için ayrıca `profiles`, `wishlist`, `admin_users`, `products`, `product_variants` metaverisi ve `auth.users` FK hedefi incelenir. Hiçbir tablonun satırları denetim SQL'inde okunmaz.

## Güvenli çalışma sınırı

- Tek dosya, tek `REPEATABLE READ READ ONLY` transaction; son komut `ROLLBACK`.
- Yalnız `pg_catalog` metaverisi ve PostgreSQL'in katalog yardımcı fonksiyonları kullanılır. Müşteri/sipariş/favori/ödeme/ürün satırları, satır sayıları, örnekler veya sequence değerleri okunmaz.
- Denetlenen RPC'ler, trigger fonksiyonları, default ve CHECK ifadeleri **çağrılmaz/değerlendirilmez**. Yalnız tanımları veya gövde hash'leri gösterilir.
- DDL, DML, ACL/RLS değişikliği, migration çalıştırma/geçmiş okuma veya değiştirme, otomatik onarım, deploy ve ödeme etkinleştirme yoktur.
- Eksik nesneler sonuç satırlarında `STOP`/`ABSENT_REVIEW` olarak görünür; ilk eksikte hata verip kalan envanteri gizlemez. Eksikler giderilmiş sayılmaz.
- `statement_timeout=20s`, `lock_timeout=5s`. Hata/zaman aşımında açık transaction için yalnız `ROLLBACK`; parçaları ayrı çalıştırarak denetim sınırını aşmayın.

Bu dosya henüz canlıda çalıştırılmadı. Yetkili kişi ileride doğru Dashboard proje referansını ayrıca doğrulayıp dosyanın tamamını salt okunur denetim olarak çalıştırabilir. `current_database()` Supabase proje kimliğinin kanıtı değildir. Tüm sonuç setleri birlikte ve özel olarak saklanmalıdır; politika/default/trigger tanımları ve ACL envanteri herkese açık paylaşılmamalıdır. Denetimi uygulama SQL'iyle birleştirmeyin.

## Sonuç setlerinin değerlendirilmesi

| Bölüm | Gösterilen kanıt / gereken değerlendirme |
|---|---|
| A00_CONTEXT | Veritabanı, çalıştıran rol, PostgreSQL sürümü, `transaction_read_only=on`, `repeatable read`; genel karar daima `NOT READY`. |
| A01_LEGACY_POLICIES | Dört eski politika için tablo, ad, permissive/restrictive, roller, komut, USING, WITH CHECK ve tanım fingerprint'i. Eksik politika açıkça `ABSENT_REVIEW`. |
| A02_ALL_REPLACED_POLICIES | `orders`, `order_items`, `profiles`, `wishlist` üzerindeki bütün politikalar; dört eski ad dışındaki politikalar da incelenir. |
| A03_TABLES | İstenen altı tablo ve müşteri/RPC yardımcı tablolarının varlığı, nesne türü, sahibi, RLS/FORCE RLS. Eksik/yanlış nesne veya tarayıcı/service-role sahibi `STOP`. RLS/owner ayrıntıları ayrıca incelenir. |
| A04_COLUMNS | Tüm sütunların formatlanmış ve temel türü, domain/enum bilgisi, nullable/NOT NULL, default, identity ve generated özellikleri. |
| A05_REQUIRED_COLUMNS | Güncel akışın gerektirdiği sütun/tür/NOT NULL karşılaştırması. Eksik, domain/enum veya tür farkı `STOP`; varchar/text gibi farklar otomatik dönüştürülmez. |
| A06_INSERT_COMPATIBILITY | Akışın sağlamadığı default'suz zorunlu sütunlar ve akışın sağladığı generated/IDENTITY ALWAYS sütunlar `STOP`; default ifadeleri manuel incelenir. |
| A07_CONSTRAINTS | Altı tablonun tüm PK/UNIQUE/FK/CHECK/diğer constraint tanımları, validasyon, FK eylemleri ve deferral bilgileri. CHECK'ler müşteri satırları üzerinde çalıştırılmaz. |
| A08_REQUIRED_KEYS | Constraint adına bağımlı olmayan PK/UNIQUE/FK şekil karşılaştırması. Eksik veya `NOT VALID` anahtar/FK `STOP`; FK eylemleri A07 ile incelenir. |
| A09_INDEXES | Tüm index tanımları, unique/primary, valid/ready ve partial predicate. Geçersiz/hazır olmayan index `STOP`. |
| A10_TRANSACTION_UNIQUENESS | `(provider,transaction_id)` üzerinde valid/ready partial unique index varlığı. Yoksa `STOP`; bulunan predicate'in anlamı ayrıca incelenir. |
| A11_TRIGGERS | Kullanıcı ve internal trigger'lar; tanım, enablement, fonksiyon imzası/sahibi/SECURITY DEFINER/search_path/gövde hash'i. Trigger etkileri manuel incelenir. |
| A12_LEGAL_IMMUTABILITY | Yasal kayıtta beklenen etkin BEFORE UPDATE OR DELETE ROW trigger'ı ve doğru fonksiyon bağlantısı. Eksik/devre dışıysa `STOP`; trigger gövdesinin anlamı A11 ile incelenir. |
| A13_EXPECTED_RPC | Sekiz tam RPC imzası, tam argümanlar, sonuç türü, SECURITY DEFINER, sahip, dil, search_path/proconfig, tam UTF-8 gövde hash'i ve etkili anon/authenticated/service_role EXECUTE izinleri. Eksik veya sapma `STOP`. |
| A14_RPC_SURFACE | Public overload'lar/fonksiyonlar ve başka şemalarda tarayıcıların erişebildiği SECURITY DEFINER yüzeyi. Beklenmeyen imza/definer ayrıca incelenir. |
| A15_ROLES | Üç rolün varlığı ve tehlikeli yetenekleri; service_role BYPASSRLS ve public şema USAGE/CREATE bilgisi. Tarayıcı CREATE yetkisi kabul edilmez; ayrı inceleme gerekir. |
| A16_ROLE_MEMBERSHIPS | Doğrudan rol üyelikleri ve admin option. Tarayıcıların başka rollere üyeliği uygulama guard'ıyla uyumsuzdur. |
| A17_EFFECTIVE_TABLE_ACL | Altı tablo + profiles/wishlist/admin_users için üç rolün etkili tablo yetkileri. Eksik nesne/rol izni `NULL`; `FALSE` gerekli yetki olarak kabul edilmez. |
| A18_EXPLICIT_TABLE_ACL | PUBLIC dahil açık grant'lar, grantor ve grant option; service_role baseline'ının karşılaştırılabilir kaydı. |
| A19_COLUMN_ACL | Tablo yetkilerine ek olarak bağımsız sütun grant'ları ve etkili sütun izinleri. |
| A20_PUBLIC_SERVICE_DEPENDENCY | Değiştirilecek dört tabloda PUBLIC yetkisi için eşdeğer doğrudan service_role grant'ı yoksa `STOP`. |
| A21_PUBLIC_COLUMN_SERVICE_DEPENDENCY | PUBLIC sütun grant'ına service_role bağımlılığı; eşdeğer doğrudan tablo/sütun grant'ı yoksa `STOP`. |
| A22_SERVICE_ROLE_INHERITANCE | service_role'un anon/authenticated üyeliği üzerinden yetki kaybetme riski; transitif üyelik de `STOP`. |
| A23_SEQUENCES | Tablo sütununa bağlı serial/identity sequence ACL'leri ve üç rolün USAGE/SELECT/UPDATE izinleri. `wishlist.id` sequence'inde PUBLIC grant varsa uygulama guard'ıyla uyumsuz `STOP`. Sequence değerleri okunmaz. |
| A24_OWNERSHIP_NOT_NULL | `public.orders.user_id` gerçekten temel `uuid` ve `NOT NULL` olmalı. Eksik, nullable veya yanlış tür `STOP`. |
| A25_DECISION_BOUNDARY | Müşteri satırlarının doğrulanmadığı, service ACL baseline'ının incelenmesi gerektiği ve kararın `NOT_READY` olduğu açıkça belirtilir. |

A16/A20/A21 gibi bölümlerin boş olması, ilgili üyelik/PUBLIC grant bulunmadığını gösterebilir; tek başına bütün nesnelerin mevcut veya bütün yetkilerin uygun olduğunu kanıtlamaz. A03/A15/A17 ile birlikte değerlendirin. `PASS_*` yalnız ilgili yerel metaveri kontrolünün sonucudur; bütün sistemi canlıya hazır sayan bir sonuç değildir.

### Dört eski politikanın karşılaştırılması

İsimler: `orders_insert_policy`, `orders_access_policy`, `order_items_access_policy`, `order_items_policy`.

Gerçek eski tanımları repoda yoktur; bu denetimde beklenen USING/WITH CHECK ifadeleri uydurulmadı. A01 bunları canlı katalogdan görünür hale getirir. Fingerprint, tablo/ad/permissive/roller/komut/USING/WITH CHECK alanlarının `jsonb` gösterimine SHA-256 uygulanarak üretilir; anlam eşdeğerliğinin kanıtı değildir ve PostgreSQL sürümleri arasında metin gösterimi değişebilir. Değişiklikleri gerçek ifadelerle değerlendirin.

Özellikle `PUBLIC`, `ALL`, `USING(true)` veya geniş INSERT/UPDATE izinleri; restrictive politikalar; service_role'a özel iş kuralları; başka müşteriye erişim ve admin yazma yolları incelenmelidir. Uygulama SQL'i bilinen adları kontrol eder, ardından dört tablodaki bütün politikaları kaldırıp yeni müşteri/admin politikalarını kurar. Adın allowlist'te bulunması, tanımın güvenli olduğunu veya kaldırılmasının uyumlu olduğunu kanıtlamaz. Bilinmeyen adlar uygulama guard'ını durdurur.

Yeni politika hedefi: müşteri kendi profilini kaydeder/okur ve yalnız ad/soyad/telefonu günceller; kendi favorisini ekler/siler/okur; kendi sipariş ve kalemlerini okur. Aktif admin dört tabloyu okur. Tarayıcıya doğrudan sipariş yazma veya admin kayıtlarını değiştirme hakkı verilmez.

## Korunması gereken şartlar ve kanıt sınırı

1. **orders.user_id NOT NULL:** A24'te `PASS_ORDERS_USER_ID_UUID_NOT_NULL` gerekir. A08'de auth.users FK'sı ve A07'de FK eylemleri ayrıca incelenir. Denetim NULL müşteri/sipariş satırı aramaz ve ownership dönüşümü yapmaz.
2. **Müşteri verisi:** Denetim yalnız katalog SELECT'lerinden oluşur ve read-only transaction içinde çalışır. Sentetik testte mevcut satırlar, sequence değerleri, şema, politikalar, RPC'ler ve ACL'ler denetim öncesi/sonrası aynı kaldı. Canlı satır içeriklerinin/eşitliğinin veya geçmiş ödeme durumlarının doğrulandığı iddia edilmez; üretim verisi okunmadan böyle bir kanıt verilemez. Gelecekteki uygulama SQL'i müşteri DML'i, sütun/NOT NULL dönüşümü veya RPC gövde değişikliği yapmamalıdır.
3. **service_role:** BYPASSRLS tek başına tablo yetkisi değildir. A13'te dört ödeme RPC'si anon/authenticated için kapalı, service_role için açık olmalıdır. A17-A19/A23 baseline'ı korunmalıdır; A20-A22'de bağımlılık `STOP`'ları bulunmamalıdır. Sequence/default erişimleri ve fonksiyon sahibinin bağımlı tablolara erişimi ayrıca incelenir. Bu denetim hiçbir grant/revoke yapmaz; gelecekte yetki korunması kararı yalnız baseline ve planlanan değişiklik beraber değerlendirilerek verilebilir.

Sipariş yolu kaynakta `POST /api/payment/create` → doğrulanmış kullanıcı → service_role istemcisi → `nrs_create_payment_order` şeklindedir. `orders`/`order_items` yazmalarını SECURITY DEFINER fonksiyonunun sahibi yapar. Denetim bu fonksiyonu çağırmaz. Şema/default/CHECK/trigger uyumu ve fonksiyon sahibi uygun olmadan başarılı canlı sipariş iddiası verilemez. WhatsApp talebi DB sipariş kaydı oluşturmaz; denetim ödeme bayraklarını açmaz.

## Sentetik PostgreSQL testi

Son paket: **29 geçti, 0 başarısız — PostgreSQL 18.4**. Gerçek bir yerel PostgreSQL çalıştırıcısı kullanıldı; salt metin eşleştirme testiyle yetinilmedi. Üretim URL'si/anahtarı/env dosyası kullanılmadı; ödeme sağlayıcısı çağrılmadı; eski migration dosyaları topluca uygulanmadı.

Test düzeneği: `/tmp/nrs-live-audit-tests.mjs`; çalıştırma: `node /tmp/nrs-live-audit-tests.mjs`. Bu geçici dosya teslim edilen repo değişikliklerinden biri değildir; geçici dizin temizlenirse test düzeneği yeniden kurulmalıdır. Kapsamı aşağıda açıkça kayıtlıdır.

- Denetimin tamamının gerçek PostgreSQL'de çalışması; read-only/repeatable-read durumunun görülmesi; A00-A25 sonuç setlerinin kontrolü.
- Müşteri tablolarında SELECT hakkı olmayan bir metaveri okuyucu rolüyle de bütün denetimin çalışması; aynı rolün müşteri SELECT'inin reddedilmesi.
- Dört sentetik eski politika tanımı/rol/komut/USING/WITH CHECK/fingerprint; eksik politika ve ifade farkının görünmesi. Sentetik tanımlar canlı tanımların yerine geçmez.
- Altı tablo envanteri, yardımcı bağımlılıklar, sütun/default/constraint/index/trigger metaverisi ve sekiz gerçek repo RPC gövdesinin hash/ACL karşılaştırması.
- Müşteri/ödeme/ürün satırları, sequence değerleri, şema, constraint'ler, politikalar, fonksiyonlar ve ACL'lerin her denetim öncesi/sonrası değişmemesi.
- Eksik tablo (altı hedef tablo da yokken dahil), eksik sütun/RPC/rol/FK/index/trigger; nullable ownership, yanlış tür, sağlanmayan zorunlu sütun, generated sütun, NOT VALID FK, devre dışı trigger için açık durdurma bulguları.
- RPC execute/search_path sapması; PUBLIC tablo/sütun grant'ına service_role bağımlılığı; tarayıcı rolü üzerinden service_role üyeliği; PUBLIC wishlist sequence grant'ı.
- Raporun bölüm kapsamı, karar sınırı, sabit kaynak hash'leri ve canlıya hazır olmama beyanının çalıştırılan denetimle tutarlılığı.

Read-only SQL'in bozulmuş nesneleri onarmadığı her senaryoda ayrıca doğrulandı. Trigger/default/CHECK ifadeleri ve RPC'ler denetim içinde yürütülmedi. Tam sipariş/sağlayıcı uçtan uca testi bu yeni metaveri paketinin kapsamı değildir.

## Canlı çıktı gelmeden verilemeyecek kararlar

- Dört eski politikanın ve kaldırılacak diğer politikaların güvenle değiştirilip değiştirilemeyeceği.
- Canlı sütun türleri, required/default/generated alanları, FK eylemleri, CHECK durumları, index predicate'leri ve trigger etkilerinin gerçek sipariş RPC'leriyle uyumu.
- RPC sahibinin ve tüm bağımlılıklarının uygunluğu; bilinmeyen/overloaded SECURITY DEFINER yüzeyinin kabul edilebilirliği.
- service_role yetkilerinin gelecekteki uygulamada aynen korunacağı ve `orders.user_id NOT NULL` şartının karşılandığı.
- Uygulama SQL'inin canlıda çalıştırılmasına onay. Salt okunur metaveri çıktılarının hepsi uygun olsa bile ödeme etkinleştirme/deploy onayı oluşmaz; ödeme durumlarının ve operasyonel ön koşulların incelenmesi bu görevin dışındadır.

`STOP` varsa işlem yapılmaz. `REVIEW`/`ABSENT_REVIEW` çözülmeden hazır kararı verilmez. Eksik nesne için migration çalıştırılmaz, politika/table/ACL değiştirilmez ve onarım önerisi otomatik uygulamaya dönüştürülmez.

## Sabit kaynak sürümü

- `Raporlar/NRS_SUPABASE_SECURITY_APPLY.sql` SHA-256: `4cf4b6abbedb7a7470f377279466d384920e27a2dbb773960425b691379af9b2`
- `scripts/prepare-customer-security-sql.py` SHA-256: `3a9d84a4b04426162768b38b9e6ef5589f20d2a1d8bee707ac26f67d69652d2f`

Bu kaynaklar değişirse denetimdeki beklenen RPC hash/sütun/constraint manifesti ve rapor tekrar doğrulanmalıdır. Bu rapor canlı gözlem raporu değildir; canlı çıktıların değerlendirilmesi için hazırlanmıştır.
