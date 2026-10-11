# İlk migration: yerel geri yükleme ve hedefli kurtarma

Tarih: 2026-10-10. Kapsam: `20261009120000_order_access_hardening.sql`.
Canlı bağlantı/SQL, push, deploy veya migration değişikliği yapılmadı.

## Guard kanıtlarının eşleştirilmesi

İstenen `Raporlar/NRS_A01_A24_ILK_MIGRATION_KANIT.md` dosyası bu çalışma sırasında belirtilen yolda yoktu. Önceki sohbet doğrulamaları tekrar sorgulanmadı; aşağıdaki eşleştirme bunları yeni canlı gözlem gibi sunmaz.

| Kanıt | İlk migration'ın gerçek guard koşulu | Bu çalışmadaki kanıt durumu |
|---|---|---|
| A15 | anon/authenticated superuser, BYPASSRLS, CREATEROLE, CREATEDB, REPLICATION yetkilerinin olmaması; public USAGE olup CREATE olmaması; service_role BYPASSRLS | Sohbette BYPASSRLS ve şema izinleri doğrulandı. Diğer rol bayraklarının istenen dosyadaki kayıtları okunamadı. |
| A16/A22 | Tarayıcı rollerinin üyeliklerinin ve service_role'un tarayıcı rollerine doğrudan/transitif bağımlılığının olmaması | Önceki canlı sonuçlar kullanıcı tarafından iletildi; tekrar sorgulanmadı. |
| A17/A19 | admin_users RLS açık; anon/authenticated için tüm sütunlarda INSERT/UPDATE olmaması; DELETE/TRUNCATE/TRIGGER olmaması | Sahip/RLS ve anon tablo izni yokluğu doğrulaması sohbetten mevcut. authenticated SELECT=true, tek başına diğer izinlerin yokluğunu kanıtlamaz. İstenen ayrıntılı dosya okunamadı. |
| A13 | Admin RPC: SECURITY DEFINER, function/void/plpgsql, tam `search_path=""`, güvenli owner, iki kabul edilen gövde hash'inden biri; anon EXECUTE yok, authenticated EXECUTE var | Sohbette canlı gövde eşleşmesi iletildi. Yedekteki RPC owner=postgres, SECURITY DEFINER=true, search_path ve hash `c1ece8f8401ea641f9e6b716df1eb69db8ce4fb8b7975c7c49a87cb13095bf9c` eşleşiyor. Yedek tarihi itibarıyla metadata kanıtıdır; eksik canlı dosyanın yerine geçirilmedi. |
| A13 | Active-admin predicate: SECURITY DEFINER, function/boolean/sql, tam search_path, güvenli owner, hash `b13925b08fe9c02ca430c6f941888aa9aee3f97466a2a37bb5a28140ded5ba80`; anon EXECUTE yok, authenticated EXECUTE var | Yedekte predicate owner, SECURITY DEFINER, search_path ve hash eşleşiyor. Canlı ayrıntılı kayıt dosyası okunamadı. |
| A20/A21/A23/A24 ve şema/PK/politika | PUBLIC/service grant bağımlılığı, wishlist sequence, ownership NOT NULL, müşteri sütun/default/PK koşulları | Önceki doğrulamalar yeniden istenmedi. Yedek kurtarma kontrolü yeni canlı guard denetimi değildir. |
| History | History tablosu yoksa kabul; varsa `20261009120000` kaydı bulunmamalı | Kullanıcı canlı history tablosunun olmadığını bildirdi; migration bu durumu kabul eder. |

Yeni dosyaya dayalı guard doğrulaması: **BLOCKED — belirtilen kanıt dosyası yok**. Bu, canlıda yeni bir uyumsuzluk bulunduğu anlamına gelmez. Önceki PASS beyanı, dosyanın okunarak tüm metadata'nın bağımsız doğrulandığı anlamına gelmemelidir.

## Yerel geri yükleme: PASS

Yedek: `/Users/rojhatmaman/Documents/NRS-Backups/2026-10-10_12-22-16/`.

- Yeni, izole PostgreSQL 18.4 cluster; yalnız `127.0.0.1:55479`. Canlı URL/env kullanılmadı. Test sonunda PostgreSQL durduruldu.
- PostgreSQL 17.11 `pg_restore`, PostgreSQL 17.6 kaynaklı custom-format dump'ları okudu.
- `nrs_core.dump`: yeni boş veritabanında owner ve ACL kayıtları dahil `--exit-on-error --single-transaction` ile hatasız geri yüklendi. Supabase rol adları yalnız yerel ortamda önkoşul olarak oluşturuldu; dump cluster-global rol niteliklerinin yedeği olarak değerlendirilmedi.
- `nrs_public.dump`: ikinci boş veritabanında, core dump'tan auth şeması ve verileri sağlandıktan sonra aynı hata/transaction seçenekleriyle hatasız geri yüklendi. Public dump tek başına auth bağımlılıklarının yedeği değildir.
- Core geri yüklemesinde orders=0, order_items=0, profiles=3, wishlist=4; her tablonun sayısı dump COPY yüküyle eşleşti. Bu, yedek sonrası canlı kayıtları veya tüm satır içeriklerini karşılaştıran test değildir.
- Dump SHA-256 değerleri işlem öncesi/sonrası aynı:
  - core: `33d67594dc3f9351f416b9d2859b7811b316cfcddf79898fa148990869a7db86`
  - public: `72245fea0768908caae9ac00b0d705457161c5825d52f821c2362b450600c229`
- Özel test çıktıları: `/private/tmp/nrs-recovery-proof-ZFFHGN/result.json`; özel restore logları aynı dizinde. Yedekler değiştirilmedi. Yerel test dosyaları müşteri verisi içerdiğinden paylaşılmamalıdır.

## Hedefli kurtarma prosedürü

### COMMIT öncesi hata

1. Dosya hata/lock timeout verirse parçalar halinde devam etmeyin, guard kaldırmayın, migration'ı yeniden çalıştırmayın.
2. Aynı SQL Editor oturumunda açık/aborted transaction varsa yetkili operatör yalnız `ROLLBACK` ile kapatsın. Bağlantı zaten kapanmışsa transaction geri alınır; başarılı COMMIT olmadığı teyit edilmeden sonuç varsayılmasın.
3. Hata ve transaction sonucu özel kayıtta tutulsun. Veri restore veya tablo silme gerekmez: migration'ın BEGIN/COMMIT sınırı içindeki metadata değişiklikleri geri alınır.

### Başarılı COMMIT sonrası sorun

1. Başarılı COMMIT'i `ROLLBACK` geri alamaz. İlk migration'ı tekrar uygulamayın; eski dump'ı canlı veritabanına geri yüklemeyin. Yedek sonrası sipariş/profil/favori kayıtları böylece korunur.
2. Operatör etkilenen sipariş/profil/favori/admin yazma akışını geçici olarak durdursun; güvenliği gevşeterek çalıştırmaya devam etmesin. Kart ödeme kapalı kalsın. Geçici durdurma bu görevde uygulanmadı.
3. Hatanın etkilediği nesneyi belirleyin. Yedek metadata'sını yalnız karşılaştırma kaynağı olarak kullanın. Dört müşteri tablosunda RLS açık, müşteri sahiplik kontrolleri ve aktif admin sınırı korunmalı; anon erişimi veya geniş authenticated yazma yetkisi yeniden açılmamalı.
4. Yalnız kanıtlanan sorun için ileri yönde düzeltme hazırlayın:
   - Sipariş/kalem okuma sorunu: yalnız ilgili SELECT politikası/izin yolu; sahibi olan kullanıcı ve aktif admin sınırı korunur.
   - Profil/favori sorunu: yalnız mevcut izin verilen sütunlar, sahiplik politikası veya bağlı wishlist sequence USAGE. Tablo düzeyinde geniş INSERT/UPDATE/ALL verilmez; sequence SELECT/UPDATE açılmaz.
   - Admin durum RPC sorunu: yalnız ilgili fonksiyonun doğrulanmış düzeltmesi. Aktif-admin kontrolü, order-row lock ve ödeme/operasyon durum geçişi korumaları kalır. Yedekteki eski kilitsiz RPC gövdesi geri konmaz; anon EXECUTE açılmaz.
   - service_role sorunu: yalnız kanıtlanan eksik doğrudan nesne yetkisi; PUBLIC/browser role bağımlılığı veya rol yükseltmesi oluşturulmaz.
5. Düzeltme DML, veri restore, DROP TABLE, TRUNCATE, ownership/NOT NULL dönüşümü içermemeli. Dokunulacak nesnelerin beklenen mevcut metadata'sı ve güvenli hedefi açıkça tanımlanmalı. Beklenmeyen durum işlem başlamadan durdurulmalı.
6. Somut düzeltmeyi önce ayrı yerel kopyada prova edin; müşteri verisinin değişmediğini, yetkilerin genişlemediğini ve ilgili hata senaryosunun düzeldiğini kontrol edin. Başarısız prova canlı uygulama yetkisi oluşturmaz.
7. Provası geçmiş düzeltme, ayrıca yetkilendirilmiş operatör tarafından tek transaction içinde uygulanır; hedefli sonuç kontrolü COMMIT öncesi yapılır. Hata halinde aynı oturumda ROLLBACK; başarılı COMMIT sonrası ilgili akış kontrollü açılır.

Bu prosedür hazırdır; olayın nesnesi ve nedeni belli olmadan çalıştırılabilir bir geri dönüş SQL'i üretilemez. Henüz kanıtlanmamış düzeltme/geri dönüş otomatik uygulanmadı. Yerel tam restore başarısı, canlıya tam dump restore önerisi değildir. PostgreSQL 18.4 yerel testinin kaynak PostgreSQL 17.6 üzerindeki olay düzeltmesini kanıtlamadığı da korunur.

## Kalan gerçek engeller

- İstenen canlı kanıt dosyası workspace'te mevcut değil; dosyadaki A15/A17/A19/A13 ayrıntıları bu çalışmada eşleştirilemedi. Aynı denetimi tekrar yürütmek gerekmez; mevcut dosyanın belirtilen konuma getirilmesi yeterlidir.
- Belirli bir COMMIT sonrası arıza henüz olmadığı için olaya özel düzeltmenin provası yoktur. Hazır prosedür otomatik geri dönüş yetkisi değildir; somut düzeltme ancak tanımlandıktan ve yerelde doğrulandıktan sonra uygulanabilir.
