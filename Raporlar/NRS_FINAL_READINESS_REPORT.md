# NRS — Supabase güvenlik tamamlama teslimatı

Hedef proje: `moiynemxthkmgpgnfajd` · Tarih: 09.10.2026

## Tamamlananlar — TAMAM (yerel kapsam)

- Mevcut rapor, salt okunur audit ve yerel migration/fonksiyon tanımları karşılaştırıldı; yeni genel denetim başlatılmadı. Canlıya bağlanılmadı. Canlı history/fonksiyonların incelendiği veya açıkların canlıda kapandığı iddia edilmez.
- Tek uygulanabilir dosya hazırlandı: `Raporlar/NRS_SUPABASE_SECURITY_APPLY.sql`. Başlangıçta mevcut metadata audit'i ve varsa migration history'yi salt okunur transaction içinde gösterir; sonra güvenlik guard'ları, dar ACL/RLS düzeltmesi ve COMMIT öncesi etkin izin kontrollerini yürütür.
- Dosya **eski migration'ları çalıştırmaz**, migration history yazmaz ve hiçbir RPC'yi CREATE/REPLACE etmez. Mevcut son repo gövdeleri için 8 SECURITY DEFINER imzası ve normalize edilmiş SHA-256 gövde karşılaştırması içerir. İsim aynı olsa bile eski/değişmiş gövdede durur. Bu karşılaştırma bir sır veya sağlayıcı imzası değildir; kaynak uyumluluğu kontrolüdür.
- Önceki `20261008… / 20261009…` migration'ları, ödeme API'si ve PayTR/feature flag ayarları değiştirilmedi. Kartlı ödeme kapalı tutuldu. `.env`/`.env.local`, anahtarlar ve parolalar açılmadı; ağ/üretim SQL/push/deploy yapılmadı. Yeni bağımlılık yüklenmedi.
- Hazırlama kaynağı: `scripts/prepare-customer-security-sql.py`; yalnız repository SQL kaynaklarını okuyup teslim SQL'ini üretir. Test: `tests/security-apply.test.cjs`. Eski audit dosyası ve mevcut migration dosyaları bu takipte değiştirilmedi.

Her SQL değişikliğinin veri koruma etkisi:

| Değişiklik | En az yetki sonucu | Mevcut verinin korunması |
|---|---|---|
| Dört tabloda PUBLIC/anon/authenticated tablo ve bağımsız kolon REVOKE | Browser ALL/TRUNCATE/REFERENCES/TRIGGER ve geniş yazma hakları kaldırılır. Anon erişim verilmez. | ACL metadata değişir; müşteri satırı INSERT/UPDATE/DELETE edilmez, hiçbir kolon/type/constraint/default değiştirilmez. |
| orders/order_items authenticated SELECT | Yalnız sahip veya aktif admin RLS kapsamında okuyabilir; browser sipariş oluşturamaz, kalem/fiyat/status/paid yazamaz. | Siparişler ve kalemler korunur; orders.user_id NOT NULL yalnız doğrulanır, dönüştürülmez. Guest WhatsApp talebi etkilenmez. |
| profiles authenticated SELECT; dar INSERT(id,first_name,last_name,phone,email), UPDATE(first_name,last_name,phone) | Sahip profil oluşturma/düzenleme korunur; ID, role gibi ek alanlara yazma ve profil DELETE yasak. | Migration mevcut profilleri değiştirmez. Signup upsert/profil düzenleme alanları korunur. SELECT mevcut uygulamadaki select('*') ile uyumlu kalır; satır erişimi RLS ile sınırlandırılır. |
| wishlist authenticated SELECT; INSERT(user_id,product_id), sahip DELETE | Favori ekleme/silme korunur; başka kullanıcının favorisine yazılamaz; UPDATE yok. | Migration mevcut favorileri silmez veya değiştirmez; kullanıcı sonradan kendi favorisini uygulama üzerinden silebilir. |
| Bilinen dört tablo politikalarını sahip/aktif-admin politikalarıyla uzlaştırma; RLS etkinleştirme | Eski permissive genel politikalar OR yoluyla erişim açamaz. Bilinmeyen politika adına müdahale edilmeden STOP verilir. | Yalnız policy metadata değişir; kullanıcı/admin kayıtları, sahiplik değerleri ve siparişler korunur. Admin predicate/fonksiyonlar değiştirilmez. |
| Varsa wishlist ID sequence authenticated USAGE; browser geniş sequence hakları kaldırılır | Mevcut serial/identity ID üretimi çalışır; sequence UPDATE verilmez. PUBLIC sequence grant'ında tahminle değişiklik yerine durur. | ID/default/sequence değerleri yeniden yazılmaz, mevcut favoriler dönüştürülmez. |
| service_role, RPC ve admin guard'ları | Browser bypass/role membership, public CREATE, admin registry yazımı, bilinmeyen definer, değişmiş gövde veya beklenmeyen RPC EXECUTE izinlerinde STOP. PUBLIC'e bağlı service erişiminde durur. | service_role tablo grant'ları, RPC gövdeleri/ACL ve admin yetki kayıtları değiştirilmez. Testte bunların ve bütün müşteri kayıtlarının önce/sonra aynı kaldığı doğrulandı. |
| COMMIT öncesi etkin tablo/kolon/sequence izin kontrolü | İstenen dar izinler gerçekten oluşmadıysa exception. | Başarısız düzeltme transaction'ı COMMIT edilmez; önceki izinleri/kayıtları tahminle onarmaya devam etmez. |

## Canlıda yapmanız gereken tek işlem — BEKLİYOR

Supabase Dashboard'da **`moiynemxthkmgpgnfajd`** projesini seçin. Kullanılabilir backup ve mevcut metadata snapshot'ı hazır, kart ödeme kapalı olacak şekilde SQL Editor'da **`Raporlar/NRS_SUPABASE_SECURITY_APPLY.sql` dosyasının tamamını tek Run ile çalıştırın**. Proje kimliğini SQL otomatik olarak kanıtlayamaz; Dashboard hedefi sizin doğrulamanız gerekir.

Dosyanın kendi sırası: **salt okunur audit/history → uyumluluk/izin guard'ları → dört tablo ACL/RLS uzlaştırması → etkin izin doğrulaması → COMMIT**. Ayrı migration zinciri veya ayrıca çalıştırılacak kontrol SQL'i yoktur. Eski migration'ları yeniden uygulamayın; SQL Editor history'yi otomatik kaydetmez ve bu dosya elle history değiştirmez.

Başarı ölçütü: tek Run tamamen hatasız bitmeli, `Verified ACL/RLS metadata; COMMIT must complete without error…` NOTICE'i görülmeli ve son COMMIT başarılı olmalıdır. Bu yalnız uygulanan metadata düzeltmesinin sonucudur; canlı kullanıcı/ödeme uçtan uca testinin yerine geçmez. Sonucu ve başlangıç metadata çıktısını özel olarak saklayın; fonksiyon tanımlarında olası gizli bilgileri sohbet/loga taşımayın.

`STOP`, SQL hatası veya 5 saniyelik lock timeout halinde **durun**. Dosyayı parçalara ayırıp devam etmeyin, guard kaldırmayın, eski migration çalıştırmayın. Açık/aborted transaction kalmışsa yalnız `ROLLBACK;` ile kapatın. Başlangıç read-only transaction'ın bitmesi güvenlik düzeltmesinin uygulanmış olduğu anlamına gelmez. Hiçbir tabloyu veya kaydı silerek engeli aşmayın.

## Engeller — ENGELLİ / BEKLİYOR

- **BEKLİYOR:** Canlı şema, history, fonksiyon gövdeleri ve etkin yetkiler; otomatik bağlantı/SQL yasak olduğu için bu oturumda doğrulanmadı. Hedef project ref kullanıcı bilgisidir, bağlantı kanıtı değildir.
- **ENGELLİ, guard görülürse:** Nullable/uyumsuz orders.user_id; bilinmeyen erişilebilir SECURITY DEFINER veya overload; son repo gövdesinden farklı RPC/search_path/language/owner; browser'a açık payment RPC; beklenmeyen admin registry yazımı/rol üyeliği/bypass; bilinmeyen policy; PUBLIC'e bağlı service/sequence erişimi; eksik profil/favori kolon/default/PK veya kısmi payment schema. Dosya bunları tahminle değiştirmez. Bildirilen nesne için dar ileri düzeltme gerekir; eski migration yeniden uygulaması çözüm değildir.
- **BEKLİYOR:** Bu dosya dört müşteri tablosu ACL/RLS kapsamındadır. Bütün hosting/ödeme/yasal üretim hazırlığının tamamlandığını veya bütün public katalog/storage yetkilerinin düzeltildiğini göstermez. Beklenmeyen envanter sonucunu güvenli biçimde incelemeden genel üretim onayı vermeyin.
- **ENGELLİ:** Gerçek PayTR entegrasyonu ve doğrulama olmadan kart ödeme açılması; bu dosyada hiçbir ödeme etkinleştirmesi yoktur.

## Son doğrulama sonucu

| Durum | Kontrol | Gerçek sonuç |
|---|---|---|
| TAMAM | Tam test paketi **bir kez**: `NRS_LOCAL_POSTGRES_PACKAGES=/private/tmp/nrs-isolated-postgres-review npm test` | 116 test yürütüldü: **113 geçti, 3 başarısız, 0 atlanan**. Eski testler ve 4 native PostgreSQL yarış testi geçti. Yeni guard'daki `t` değişken/alias çakışması 3 yeni testi bozdu; hata gizlenmedi. |
| TAMAM | Hata düzeltmesi sonrası yalnız 3 başarısız senaryo | Alias nitelendirilerek düzeltildi. `node --test --test-name-pattern='Single SQL: data\|unexpected policy\|Single SQL reads history' tests/security-apply.test.cjs`: **3/3 geçti, 0 başarısız, 0 atlanan**. Tam paket ikinci kez çalıştırılmadı; son dosya için “116/116 tek tam tur geçti” iddiası yoktur. |
| TAMAM | Doğrulanan veri koruması | Sentetik PostgreSQL'de orders/items/profiles/wishlist/admin/legal/payment/stock kayıtları, order NOT NULL/kolon şeması, RPC gövdeleri/ACL ve service_role grant'ları birebir korunuyor. Sahip profil/favori işlevleri çalışıyor; anon erişimi/paid yazımı/başkasının favorisi engelleniyor; admin pasifleştirme okunabilir kayıtları sınırlandırıyor. History okunuyor, yazılmıyor; önceki migration'lar çalışmıyor. |
| TAMAM | Güvenli durma senaryoları | Bilinmeyen/değişmiş definer, bilinmeyen policy, nullable owner, admin kolon yazımı, browser payment EXECUTE ve rol üyeliği durumlarında metadata değişmeden durma testleri yürütüldü. |
| BEKLİYOR | Canlı uygulama ve sonuç | Canlı bağlantı, SQL/migration uygulaması, deploy, push veya gerçek ödeme yapılmadı. Supabase güvenliğinin canlıda tamamlandığı işaretlenmedi. |

Loglar: `/tmp/nrs-final-tests.log` (tek tam tur), `/tmp/nrs-security-apply-correction.log` (3 hata senaryosunun doğrulaması). TypeScript/ESLint/production build bu SQL takibinde yeniden çalıştırılmadı; uygulama kodu/dependencies değişmedi. Önceki rapordaki geçişler bu takipte yeni çalıştırılmış sonuç gibi kullanılmadı.
