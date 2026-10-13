# Garanti BBVA Güvenli Ortak Ödeme Sayfası

13 Ekim 2026. Adaptör uygulanmıştır; **canlı etkinleştirme BLOCKED**.
Model: tek çekim TRY, `sales`, `3D_OOS_PAY`. Ön otorizasyon veya yerel kart girişi yok.

## Resmî kaynaklar

- [Peşin ortak ödeme](https://dev.garantibbva.com.tr/sanal-pos-ortak-odeme-pesin)
- [Sipariş sorgulama](https://dev.garantibbva.com.tr/sanalpos-sorgulama-siparis-sorgulama)
- [İlk kurulum PDF](https://garantibbvapos.com.tr/assets/uploads/pdf/sanalposilkadimlar.pdf)
- [Banka hata kodları](https://dev.garantibbva.com.tr/hata-kodlari)

Peşin dokümanı API 512, 3D ortak ödeme ve POST dönüşünü tanımlar. Başlatmada
SHA1 ile provision password + dokuz haneli terminal; ardından SHA512 ile
terminal, sipariş, kuruş tutarı, 949, başarı/hata URL, sales, taksit, StoreKey ve
ilk hash bağlanır. Hash metni ISO-8859-9 kodlanır; hex büyük harftir.
Dönüşte `hashparams` isimleri sırayla gerçek alanlardan okunur, StoreKey eklenip
SHA512 hesaplanır. `hashparamsval` doğrulama kaynağı değildir.

İstek ve XML sorgusu banka tarafından tanımlanan sabit hedeflerle sınırlıdır.
Test form hedefi `https://sanalposprovtest.garantibbva.com.tr/servlet/gt3dengine`,
test sorgusu `https://sanalposprovtest.garantibbva.com.tr/VPServlet`;
canlı XML sorgusu `https://sanalposprov.garanti.com.tr/VPServlet` olarak belgelenir.
Canlı form hedefi için varsayılan yoktur; banka teyidiyle açıkça yapılandırılır.
Kod yalnızca aynı resmî canlı hosttaki `/servlet/gt3dengine` yolunu kabul eder.
Başka hedef verilirse banka belgesi incelenmeden izin listesi genişletilmez.

## Çelişkiler ve güvenli kararlar

- Ortak form örneğinde kart alanları ve 3D'siz varsayılan vardır. Kopyalanmadı:
  NRS formunda kart/CVV alanı yoktur ve güvenlik seviyesi daima `3D_OOS_PAY` olur.
- Resmî ortak ödeme TEST formunda tek çekim taksit alanı boştur. İzole test
  yayını bu belgelenmiş boş değeri kullanır; aynı boş değer hash'e girer.
  Hash yardımcı örneğinin tamsayı kullanması not edilir, 3DS testiyle teyit edilir.
- Resmî TEST formu `terminalprovuserid=PROVAUT`, `terminaluserid=GARANTI`
  gösterir. TEST yayını bu değerlerle hazırlanmıştır. Önceki salt okunur sorgu
  PROVAUT ile HTTP 200 / 0110 döndü. Bu belgelenmiş test bilgileri kullanıcıdan
  tekrar istenmez; canlı terminal/kullanıcı onayı ayrı koşuldur.
- C#/Java terminalin başına `0` ekler; PHP dokuz haneye doldurur. Sekiz haneli,
  başında sıfır olmayan terminalde eşleşirler. Diğer biçimler otomatik kabul edilmez.
- PDF canlı StoreKey temsili ile kamuya açık test StoreKey'i farklı kurulumlar
  gösterir. Panelde/bankada kullanılan tam temsil girilir; otomatik hex dönüşümü yoktur.
- `orderinq` cevap şeması Status/ChargeType/Code anlamlarını tam listelemez.
  Banka teyitli tahsilat durumu/işlem tipi/sonuç kodu zorunludur; tahminî varsayılan yoktur.
- Query cevap şeması para birimi alanı göstermiyor. TRY, orijinal istek hash'i,
  dönüş alanı, sorgu isteği ve DB kaydıyla bağlanır; hayalî XML cevap alanı eklenmez.
- Banka dokümanı dönüş hash kontrolünü `00` sonucuyla sınırlar. İmzasız ret/iptal
  DB'yi iptal etmez, stok serbest bırakmaz; teyit gelene kadar belirsiz kalır.

## Mevcut altyapıya bağlantı

`PaymentProvider` kayıt adı `garanti-oos` olur. `initiate` bankada tahsilat çağırmaz;
15 dakikalık sunucu imzalı geçiş URL'si oluşturur. Mevcut checkout bu URL'yi açar.
GET yalnızca geçiş düğmesini gösterir. POST kullanıcı sahipliği ve aynı origin'i
kontrol eder; `payment_orders.redirect_url` üzerinde karşılaştırmalı atomik update
ile tek kullanımlık geçişi tüketir. Banka formu sunucuda üretilir ve POST edilir.
Şifre, StoreKey, query şifresi ve kart alanları tarayıcıya aktarılmaz.

Tüketilmiş URL `used=1` işareti taşır; tekrar oluşturma/yeniden gönderim bankaya
ikinci form üretmez. Yanıt kaybolursa otomatik yeniden tahsilat yapılmaz.
Hedef DB'de service_role'un mevcut payment_orders update yetkisi ve ödeme RPC'leri
ayrıca doğrulanmalıdır; bu iş için SQL/RLS/GRANT/migration değiştirilmedi.

Banka dönüşleri `/api/payment/garanti/success` ve `/failure` altında POST-only'dir;
oturum çerezine ve origin başlığına bağımlı değildir. Hash, terminal/merchant,
referans, tutar, para birimi, mod, sürüm ve ilk istek hash'i doğrulanır.
Sonrasında `orderinq` ile gerçek satış tutarı, onay kodu ve banka teyitli tahsilat
statüsü kontrol edilir. Tam 3DS doğrulaması (`mdstatus=1`) olmadan paid üretilmez.

`finalizeAtomic` mevcut DB kilitleri, tutar/ref/provider ve benzersiz event kontrolüyle
kayıt yapar. Terminal+bankaya verilen sipariş referansı sabit transaction kimliğidir;
sonuç için sabit event kimliği tekrar bildirimde değişmez. Yeni sipariş oluşturulmaz.
Mevcut stok rezervasyonu, beden/ölçü, müşteri ve hukuki kayıt doğrulamaları korunur.

Kesin banka iptal/ret statüsü ve sıfır tahsilat doğrulandığında `failed` kaydedilir.
Bilinmeyen durum, sorgu hatası, zaman aşımı veya çelişki ödenmiş/iptal sayılmaz;
rezervasyon korunur. Sadece kaybolmuş dönüşü sorgulayan `reconcile`, bankada satış
bulsa da imzalı 3DS kanıtı yoksa paid üretmez. Böyle durumlar banka sonucunun
tekrar iletilmesi veya operatör mutabakatı gerektirir; otomatik scheduler eklenmedi.

## Sunucu değişkenleri — tek kurulum listesi

Bütün değerler `.env.example` içinde boş tanımlıdır. Gizli değerler yalnızca ilgili
Vercel ortamına girilir; hiçbir `GARANTI_*` alanı `NEXT_PUBLIC_*` değildir.
`TEST` ve `LIVE` kümeleri farklıdır; aktif olmayan kümeden credential okunmaz.

Aşağıdaki `GARANTI_{TEST|LIVE}_...` adları iki ayrı gerçek değişkeni ifade eder.

| Değişken | Girilecek bilgi |
| --- | --- |
| PAYMENT_PROVIDER | `garanti-oos` |
| PAYMENT_ENABLED | Testler/izinler tamamlanana kadar `false` |
| PAYMENT_DATABASE_VERIFIED | Hedef DB ve tek kullanımlık update/RPC kontrolleri sonrası etkinleştirme |
| SUPABASE_SERVICE_ROLE_KEY | Yalnızca ilgili hedef projenin sunucu anahtarı |
| GARANTI_MODE | İzole Preview/yerel için `TEST`; banka onayı sonrası Production için `PROD` |
| GARANTI_TEST_SETUP_ONLY | DB henüz yokken yalnızca Preview kurulum yayını; doğrulama bayrağı değildir. Production, canlı DB veya açık yazma bayraklarıyla çalışmaz |
| GARANTI_SITE_ORIGIN | Ortamın sabit HTTPS origin'i; Production: `https://nrsbequiteluminous.com` |
| GARANTI_SUCCESS_URL | Aynı origin + `/api/payment/garanti/success` |
| GARANTI_ERROR_URL | Aynı origin + `/api/payment/garanti/failure` |
| GARANTI_HANDOFF_SECRET | Ortama özel, secret manager'da üretilen 32 rastgele baytın 64 haneli hex değeri |
| GARANTI_OOS_VERIFIED | Terminalin tek çekim TRY ve 3D ortak ödeme yetkisi banka tarafından doğrulanınca `true` |
| GARANTI_LIVE_APPROVED | Canlı kullanım bankaca onaylanınca `true` |
| GARANTI_SANDBOX_PASSED | Gerçek banka sandbox senaryoları tamamlanınca `true` |
| GARANTI_LIVE_QUERY_FIELDS_CONFIRMED | Garanti başarılı Production orderinq yanıtındaki Mode/AuthDate/Transaction.Response.ReasonCode ve Status/ChargeType/OrderInqResult.Code eşleştirmelerini yazılı doğrulayınca `true` |
| GARANTI_TEST_DATABASE_ISOLATED | Ayrı test Supabase projesi doğrulanınca `true` |
| GARANTI_TEST_SUPABASE_URL | Ayrı test projesi; TEST'te NEXT_PUBLIC_SUPABASE_URL ile eşleşmeli |
| GARANTI_SINGLE_INSTALLMENT | Banka testinde onaylanan boş veya `0` |
| GARANTI_CAPTURED_STATUS | orderinq Status alanında kesin başarılı tahsilat değeri |
| GARANTI_CAPTURED_RESULT_CODE | orderinq OrderInqResult.Code alanında başarılı tahsilat kodu |
| GARANTI_SALE_CHARGE_TYPE | orderinq ChargeType alanında normal satış değeri |
| GARANTI_FINAL_FAILED_STATUSES | Bankanın kesin/nihai ret veya iptal Status değerleri; virgülle ayrılmış; belirsiz/zaman aşımı eklenmez |
| GARANTI_{TEST\|LIVE}_MERCHANT_ID | Bankanın ilgili ortama ait üye işyeri numarası |
| GARANTI_{TEST\|LIVE}_TERMINAL_ID | Ortama ait sekiz haneli terminal numarası |
| GARANTI_{TEST\|LIVE}_USER_ID | Bankada tanımlı işlem yapan kullanıcı/agent |
| GARANTI_{TEST\|LIVE}_PROVISION_USER | Bu hosted modele yetkili PROVAUT veya PROVOOS; banka teyidi gerekir |
| GARANTI_{TEST\|LIVE}_PROVISION_PASSWORD | Seçilen provizyon kullanıcısının şifresi |
| GARANTI_{TEST\|LIVE}_QUERY_USER | orderinq yetkili PROVAUT/PROVOOS/PROVRFN kullanıcısı |
| GARANTI_{TEST\|LIVE}_QUERY_PASSWORD | Sorgu kullanıcısının şifresi |
| GARANTI_{TEST\|LIVE}_STORE_KEY | Banka panelindeki 3D Secure Key/StoreKey'in tam değeri/temsili |
| GARANTI_{TEST\|LIVE}_FORM_URL | İlgili ortamın bankaca onaylı gt3dengine hedefi |
| GARANTI_{TEST\|LIVE}_QUERY_URL | İlgili ortamın VPServlet hedefi |
| GARANTI_LIVE_CONTROLLED_ONLY | Yalnızca kontrollü Production denemesi hazırlanırken `true`; başka hesapları açmaz |
| GARANTI_LIVE_ALLOWED_USER_ID | İzin verilecek tek Supabase Auth kullanıcı UUID'si; yalnızca Vercel Production'da girilir |
| GARANTI_LIVE_MAX_AMOUNT_MINOR | Kuruş cinsinden üst sınır; en fazla `50000` (500 TL), küçük deneme için daha düşük seçilir |

Genel PAYMENT_API_KEY/API_SECRET alanları bu adaptörde kullanılmaz; Garanti
şifreleri bu alanlara tahminî olarak eşleştirilmez. TEST modu Production'da
reddedilir. Canlı mod ayrıca sandbox kabulü ve canlı onayı olmadan çalışmaz.

## Dönüş URL'leri ve banka tanımları

Production adayları:

- Başarı: `https://nrsbequiteluminous.com/api/payment/garanti/success`
- Başarısızlık: `https://nrsbequiteluminous.com/api/payment/garanti/failure`

İzole testte bu yollar sabit HTTPS Preview/test origin'inde kullanılmalıdır.
POST endpoint'leri banka ve müşterinin tarayıcısından erişilebilir olmalı; Vercel
Preview erişim koruması bankayı engellememelidir. Production endpoint'leri henüz
deploy edilmedi; aşağıdaki izole Preview yolları yayınlandı ve kontrol edildi.
Bankaya merchant/terminal için 3D OOS yetkisi, PROV/sorgu kullanıcı yetkileri,
canlı form hedefi, dönüş domain/URL ve varsa sunucu çıkış IP allowlist/TLS koşulları
teyit ettirilir. Bildirim URL'si yalnızca banka ayrıca bu kanalı tanımlıyorsa
`/api/payment/callback` olarak verilir; kamuya açık doküman bağımsız webhook
aboneliği garanti etmez. Bankada otomatik değişiklik yapılmadı.

## Banka test kurulumu ve doğrulama

1. Ayrı test Supabase ve sabit HTTPS test origin'i kurun. TEST credential'larını
   yalnızca bu ortamda girin; gerçek sipariş veya canlı veritabanı kullanmayın.
2. Kullanıcı/taksit/status eşleştirmelerini resmî test sonucu ve banka teyidiyle
   doğrulayın. Hedef DB'de mevcut ödeme işlemlerinin yetkilerini doğrulayın.
3. Başarılı satış, ret, kullanıcı iptali, 3DS başarısızlığı, dönüşün kaybolması,
   timeout, gecikmiş/tekrar bildirim ve tutar/terminal oynama senaryolarını çalıştırın.
   Kart bilgileri yalnızca bankanın sayfasında girilir.
4. Testler ve banka onayı sonrası LIVE değerlerini Production'a ayrı girin;
   hedef DB doğrulamasından sonra etkinleştirin. Gerçek tahsilat başlatmayın.

Salt okunur resmî test kontrolü:
`node scripts/check-garanti-sandbox.cjs --official-test --document <resmi-html-dosyasi>`
Resmî sayfanın test credential tablosu bellekte okunur; kaynak koduna veya loglara
kopyalanmaz. Rastgele, mevcut olmayan sipariş için yalnızca orderinq gönderilir.
12 Ekim 2026 sonucu: HTTP 200, güvenli kod 0110 (işlem bulunamadı). Sipariş/tahsilat yok.
Bu sonuç bağlantı ve sorgu kontrolüdür; başarılı 3DS satış testi değildir.

Gerçek TEST ret ve kullanıcı iptali senaryoları tamamlanmadı. Garanti'nin resmî
TEST kartı sayfası bir simülatör kartı ve 3DS OTP yayımlar; kesin ret üreten
belgelenmiş bir seçenek/girdi tanımlamaz. Rastgele kart/OTP ile ret simüle edilmez.
Bu iki test tamamlanmış gibi raporlanamaz.

## Kontrollü Production hazırlığı — 13 Ekim 2026

Canlı ödeme yolu, Production `moiynemxthkmgpgnfajd` Supabase URL'si, tek izinli
Auth UUID'si ve kuruş cinsinden tutar tavanı olmadan fail-closed kalır. Checkout
yalnızca oturumdaki izinli kullanıcıya kart seçeneğini gösterir; `/api/payment/quote`
ve `/api/payment/create` aynı yetkiyi sunucuda tekrar kontrol eder. Sipariş özeti,
kullanıcı banka ekranına gönderilmeden önce toplamı gösterir. TEST gözlem izinleri
ve SQL kurulumları `supabase/test-setup/` altında kalır; Production migrasyonlarına
eklenmez. TEST'te doğrulanan bir sipariş Production'a taşınmaz.

Canlı orderinq doğrulaması bilinçli olarak sıkıdır. Sorgu isteğinde `Mode=PROD`
gönderilir. Başarılı kabul şu anda yanıt `Mode=PROD`,
`OrderInqResult.Status=GARANTI_CAPTURED_STATUS`, `ChargeType=...`,
`OrderInqResult.Code=...`, eşleşen `AuthAmount`, `AuthDate` için YYYYMMDD ve
`Transaction.Response.ReasonCode=00` koşullarını gerektirir. Resmî sorgu şeması
bu alanları listeliyor ancak başarılı her yanıtta hepsinin dolu olacağını veya
ReasonCode değerinin mutlaka `00` olacağını açıkça söylemiyor. Bu nedenle canlı
başarıda boş Mode/AuthDate/ReasonCode mevcut bir engeldir; bu koşullar kaldırılmaz.
Status, ChargeType, OrderInqResult.Code ve nihai ret Status eşleştirmeleri de TEST
değerlerinden varsayılmaz. Bankadan Production başarılı/ret/iptal yanıtlarının
örnekleri veya bu alanlar için kesin kural alınana dek `GARANTI_LIVE_QUERY_FIELDS_CONFIRMED`,
`GARANTI_LIVE_APPROVED` ve `PAYMENT_DATABASE_VERIFIED` etkinleştirilmemelidir.
Kontrollü tek-hesap canlı denemesi `GARANTI_SANDBOX_PASSED` değerini doldurmaz;
ret/iptal testleri eksiktir, bu yüzden geniş müşteri açılımı yapılmaz.

## Son doğrulama sonucu

- Yerel: 107 hedefli test başarılı (15 Garanti testi ve 92 mevcut regresyon testi);
  lint ve production build başarılı. Garanti POST dönüş/geçişleri dahil 22 yerel
  production HTTP kontrolü başarılı. Yeni kapalı Garanti endpoint'leri 503 döndü.
- Resmî banka TEST: yalnızca var olmayan siparişin salt okunur sorgusu çalıştırıldı;
  HTTP 200 / 0110. Tam 3DS tahsilat/ret/iptal senaryoları doğrulanmış sayılmaz.
- Canlı: Vercel nrs-bequite Production değişken adları kontrolünde GARANTI_*
  alanı ve PAYMENT_PROVIDER yok. PAYMENT_ENABLED ve PAYMENT_DATABASE_VERIFIED
  adları mevcut; gizli değerler okunup raporlanmadı. Canlı ödeme API'leri 503,
  ürün/checkout ve sözleşme sayfaları 200; WhatsApp ve banka onayı açıklaması mevcut.
- Kod Production'a deploy edilmedi; yeni dönüş URL'leri henüz canlı doğrulanmadı.
  Ödeme bayrakları veya database verileri değiştirilmedi; commit/push/deploy yok.
  İlgisiz yerel dosyalar ve stash yedeklerine dokunulmadı.

## İzole HTTPS kurulum yayını — 12 Ekim 2026

Sabit adres: https://nrs-bequite-garanti-test.vercel.app
Mevcut proje: ro-j / nrs-bequite; hedef ortam Preview.
Deployment: https://nrs-bequite-tkqr2zd0q-ro-j.vercel.app

- Bankanın yayımladığı TEST merchant/terminal/şifre/StoreKey bilgileri yalnızca
  bu deployment'ın test değişkenlerine aktarıldı; çıktıya veya Git'e yazılmadı.
  Canlı banka erişim değerleri kullanılmadı. Resmî sayfa tablo alanları bellekte okundu.
- NEXT_PUBLIC_SUPABASE_URL yapılandırılmamış `.invalid` test adresidir; sunucu
  anahtarı boştur. Canlı Supabase bağlantısı veya mevcut proje env değerleri değiştirilmedi.
- PAYMENT_ENABLED, PAYMENT_DATABASE_VERIFIED, ORDER_DATABASE_VERIFIED,
  GARANTI_OOS_VERIFIED, GARANTI_TEST_DATABASE_ISOLATED, GARANTI_LIVE_APPROVED ve
  GARANTI_SANDBOX_PASSED bu yayında false. Hiçbir doğrulama yapılmış gibi gösterilmedi.
- Sadece sabit test alias'ına `alias-protection-override` uygulandı. Proje genelindeki
  Vercel Authentication ayarı aynı kaldı; diğer Preview adreslerinin koruması kapatılmadı.
- Dışarıdan, çerez veya protection-bypass anahtarı olmadan GET `/` 200;
  POST `/api/payment/garanti/success`, `/failure`, `/handoff` 503 ve JSON döndü.
  Vercel login yönlendirmesi yok. 503 uygulamanın kapalı ödeme yanıtıdır;
  banka sonucunun işlenmeye hazır olduğu anlamına gelmez.
- 16 Garanti testi, lint ve Production davranışını kapsayan yerel build geçti;
  22 yerel HTTP kontrolü başarılı. Gerçek Preview remote production build de başarılı.
- Production deploy edilmedi. Mevcut canlı ödeme API'lerinin kapalı durumu
  ayrıca kontrol edildi. Tam 3DS başarı/ret/iptal testleri henüz çalıştırılmadı.

Belirsiz kalan tek banka konusu: orderinq `Status`, `ChargeType` ve
`OrderInqResult.Code` alanlarının kesin tahsilat ve nihai ret/iptal değerleri.
Kamuya açık sorgu dokümanı bunları tanımlamıyor. Tahminî değer veya sahte onay yoktur.

### Kullanıcının tek sonraki adımı: ayrı, boş Supabase test projesi oluşturmak

1. Supabase Dashboard'da New project seçin; adını `nrs-garanti-test` koyun.
2. Uygun organizasyon ve bölgeyi seçin. Veritabanı parolasını güvenli parola
   yöneticisinde tutun; sohbet veya Git'e yazmayın.
3. Proje Ready olana kadar bekleyin. Canlı projenin verisini/backup'ını taşımayın;
   mevcut projeyi veya mevcut Vercel Supabase değişkenlerini değiştirmeyin.
4. Connect ekranından yalnızca yeni Project URL'sini paylaşın. Bu aşamada anahtar,
   parola, StoreKey veya canlı banka bilgisi paylaşmanız gerekmiyor.

Yeni proje oluşturulunca, test şeması ve sentetik katalog hazırlanıp yalnızca bu
Preview deployment'ına bağlanır. Repodaki ödeme migration'ları önceden mevcut
orders/order_items tabanını beklediğinden boş projede körlemesine toplu çalıştırılmaz.
Şema/izin ve test terminali doğrulanmadan ödeme bayrakları açılmaz. Bankanın
durum eşleştirmesi açıklığa kavuşunca tam 3DS senaryolarına devam edilir.

## Yeni test projesine bağlantı tamamlandı

Hedef: `dzuxhwtbuojnhibzfxqy` / https://dzuxhwtbuojnhibzfxqy.supabase.co.
Vercel Production'daki yalnızca public Supabase URL'si okunarak canlı referansın
`moiynemxthkmgpgnfajd` olduğu ayrıca doğrulandı. Referanslar farklıdır.

Mevcut yetkili Supabase CLI oturumu yeni projeye erişebildi; kullanıcıdan anahtar
veya parola istenmedi. Kurulum öncesi public uygulama tablo sayısı sıfırdı.
`supabase/test-setup/dzuxhwtbuojnhibzfxqy-bootstrap.sql` yalnızca bu boş test
projesine uygulandı. Bu dosya Production migration klasörüne eklenmedi.
`scripts/apply-garanti-test-bootstrap.py` hedef referansı sabit tutar, mevcut
bağlı proje dosyasını kullanmaz ve dolu public şemada işlemi reddeder.

Kurulum paketi mevcut admin/katalog/collections, sipariş/hukuki kayıt, ödeme
işlemleri ve güvenlik migration'larını tekrar kullanır. Eksik orders/order_items,
profiles/wishlist ve collections tabanı test için oluşturulur. Kişisel kullanıcı
ve admin kaydı, sipariş veya başarılı ödeme eklenmez. İki sentetik ürün oluşturuldu:
Garanti TEST Aksesuar (1 TRY) ve Garanti TEST Elbise (2 TRY), her biri 20 adet stok.

Doğrulanan sonuçlar:

- Bütün uygulama tablolarında RLS açık; RLS'siz tablo sayısı 0.
- products: 2; orders: 0; payment_events: 0.
- anon products ve product_variants limit=0: HTTP 200.
- anon orders limit=0: HTTP 401 / PostgreSQL 42501; erişim reddediliyor.
- service_role orders limit=0: HTTP 200.
- anon finalize RPC EXECUTE: false; service_role EXECUTE: true.
- Otomatik tablo erişimi/RLS proje ayarları değiştirilmedi. Yalnızca gereken
  tablo/kolon/RPC izinleri ve RLS politikaları kurulum SQL'inde açıkça tanımlandı.

Test anahtarları yalnızca yeni projenin yetkili API'sinden bellekte alındı ve
yalnızca Preview deployment env/build env'ine aktarıldı. Dosyaya, loga, Git'e
veya sohbet çıktısına gizli değer yazılmadı. Production ve diğer deployment
değişkenleri güncellenmedi. Yeni deployment:
https://nrs-bequite-5kv45vviw-ro-j.vercel.app; sabit test alias'ı bu deployment'a bağlı.
Ödeme, sipariş ve banka doğrulama bayrakları false kaldı.

Yalnızca bu test projesinin Auth site_url ve additional_redirect_urls alanları
sabit test origin'ine ayarlandı. Config diff ile iki değişiklik kontrol edildi;
diğer Auth/API/DB/RLS ayarları korunarak uygulandı.

Sabit adreste iki ürün sayfası ve checkout HTTP 200; test ürünleri görüntülendi.
Banka success/failure/handoff POST yolları anonim erişimde 503 JSON ve giriş
yönlendirmesi olmadan erişilebilir. İstisna mevcut alias üzerinde korunuyordu;
yeniden oluşturma denemesi başarısız olsa da anonim HTTP kontrolü PASS döndü.
Bu 503 uygulamanın ödeme kapalı durumudur; 3DS sonuç işlemesi açılmış değildir.

110 hedefli yerel test başarılı; lint ve Preview remote production build başarılı.
Garanti resmî TEST orderinq kontrolü yine HTTP 200 / 0110; hiçbir banka satışı
başlatılmadı. Kesin tahsilat durum eşleştirmesi doğrulanmadan paid üretilmez.

Kalan kullanıcı adımı: Garanti teknik destekten orderinq `Status`, `ChargeType`,
`OrderInqResult.Code` alanlarının tek çekim tahsilat, kesin ret ve iptal karşılıklarını
resmî doküman/anonim örnek cevapla teyit ettirmek. Canlı şifre veya StoreKey gerekmez.
Bu cevap olmadan tam 3DS başarı/ret/iptal testleri BLOCKED kalır.

## Kullanıcının deneyebileceği TEST gözlem akışı

Yönlendirme ve 3DS ekranı denemesi hazır; tahsilat doğrulaması hâlâ kapalıdır.
Yeni Preview: https://nrs-bequite-db59tcjgb-ro-j.vercel.app.
Sabit adres: https://nrs-bequite-garanti-test.vercel.app.

`GARANTI_TEST_OBSERVATION_ONLY=true` yalnızca şu koşullarda kabul edilir:
VERCEL_ENV=preview, GARANTI_MODE=TEST, sabit test origin'i, yalnızca
dzuxhwtbuojnhibzfxqy test Supabase URL'si, doğrulanmış ayrı DB ve bankanın
yayımladığı TEST merchant/terminal çifti. Production veya başka origin/DB/terminal
bu modu açamaz. Canlı erişim alanları boş tutulur; yalnızca yayımlanan TEST erişimi kullanılır.

Bu mod tahsilat eşleştirmesi veya terminal onayı yapılmış gibi davranmaz:
GARANTI_OOS_VERIFIED, GARANTI_LIVE_APPROVED ve GARANTI_SANDBOX_PASSED false kalır.
Eksik tahsilat eşleştirmeleri yalnızca bu gözlem modunda başlangıcı engellemez.
Adaptör bankadan başarılı sorgu sonucu alsa da settlement DTO'su üretmez.
`settlementDisabled` kontrolü callback/return/reconcile sonuçlarının DB'de
sonuçlandırılmasını ayrıca reddeder. Gözlem dönüş handler'ı hiçbir durumda
finalizeAtomic çağırmaz; imzasız ret/iptal de bekleme ekranına gider.

Preview'da PAYMENT_ENABLED=true yalnızca mevcut checkout yönlendirmesini açar.
PAYMENT_DATABASE_VERIFIED ve GARANTI_TEST_DATABASE_ISOLATED gerçek test kanıtları
sonrasında true yapıldı: hedef proje/rol/izinler, mevcut RPC'ler ve sipariş oluşturma,
rezervasyon, redirect kaydetme ve tek kullanımlık update işlemleri test DB'de
transaction içinde denenip ROLLBACK edildi. Sonrasında orders=0, events=0, stok=20.
ORDER_DATABASE_VERIFIED false kalır; manuel ödeme onayı açılmaz.

Kullanıcı denemesi gerçek TEST sipariş kaydı, hukuki snapshot ve stok rezervasyonu
oluşturur. Sipariş payment_pending/pending olarak kalır; paid/failed'e çevrilmez,
stok otomatik serbest bırakılmaz. Tek kullanımlık geçiş ve mevcut kullanıcı başına
belirsiz ödeme koruması geçerlidir; aynı denemeyi tekrar tahsilata göndermeyin.
Tam mutabakat doğrulanana kadar otomatik temizlik/yeniden ödeme eklenmedi.

IPv6 istemcilerde sadece gözlem modunda resmî TEST örneğinin IP alanı kullanılır;
normal/canlı ödeme bu fallback'i kullanmaz. Kart/CVV yine yalnızca bankanın ekranına girilir.

Kontroller: 113 hedefli test, lint, production build ve 22 yerel HTTP kontrolü PASS.
Bankanın TEST formuna kart göndermeden yapılan probe HTTP 200 / hosted kart giriş
ekranı döndürdü. Kart veya OTP gönderilmedi; tam 3DS tamamlanmış sayılmaz.
Sabit adreste ürün/checkout 200, oturumsuz payment/create 401, bankanın success ve
failure POST dönüşleri 303 ile bekleme ekranına gidiyor. Sahte status=paid parametresi
bile 'TEST — Doğrulama bekliyor' ekranını gösteriyor; ödeme doğrulandı sonucu yok.
Production ödeme API'leri ayrıca 503 olarak doğrulandı; Production değiştirilmedi.

Kullanıcı adımları:

1. https://nrs-bequite-garanti-test.vercel.app/product/garanti-test-aksesuar adresini açın.
2. Sağ üst hesap alanından yalnızca test ortamında kayıt olun; e-posta onayını
   tamamlayıp giriş yapın. Canlı sitenin hesabı bu ayrı projede mevcut olmayabilir.
3. Bir adet ürünü sepete ekleyip checkout'a geçin; gerekli müşteri alanları,
   sunucu özeti ve zorunlu sözleşme onaylarını tamamlayın.
4. Kartla ödeme düğmesi ardından 'Banka Ödeme Sayfasına Geç' ile Garanti TEST'e gidin.
5. https://dev.garantibbva.com.tr/test-kartlari sayfasındaki 3D destekli simülatör
   kartını kullanın; kart/CVV ve test OTP'sini yalnızca banka ekranında girin.
6. Dönüşte 'TEST — Doğrulama bekliyor' beklenir. Banka sonucu başarılı olsa da
   uygulamadaki sipariş ödenmiş sayılmaz. Gerçek kart veya canlı banka bilgisi kullanmayın.

## TEST geçişindeki “Geçersiz istek” düzeltmesi

Son iki denemede uygulama logları handoff GET 200, ardından handoff POST 403
gösterdi. Hata bankadan değil, form bankaya üretilmeden önce uygulamanın
same-origin kontrolünden geldi. Geçiş HTML'inin `Referrer-Policy: no-referrer`
başlığı tarayıcı form POST'unda `Origin: null` üretiyordu. Gerçek Chrome ile
izole form kontrolünde eski politika reddedildi; `strict-origin` ile gerçek
origin taşındı ve kontrol geçti. Bu politika Referer içinde yol/sorgu/token taşımaz.

Handoff yanıtları `strict-origin` kullanır; origin kontrolü, hesap sahipliği,
HMAC, 15 dakikalık süre ve atomik tek kullanımlık geçiş korunur. TEST gözlem
modunda sipariş sahibi bekleyen ve bankaya gönderilmemiş bağlantıyı sonuç
ekranından yenileyebilir. Bu işlem sipariş veya banka işlemi oluşturmaz;
gönderilmiş bağlantı, başka kullanıcı ve eşzamanlı değişiklik reddedilir.

Vercel GitHub'da bulunmayan test dalına değişken kaydetmeyi reddettiği için
kalıcı anahtar Preview kapsamında ayrı, şifreli `GARANTI_TEST_HANDOFF_SECRET`
olarak saklanır. İzole test yayın betiği bunu yalnızca kendi deployment'ının
`GARANTI_HANDOFF_SECRET` değerine aktarır. Production değişkeni oluşturulmaz;
diğer Preview'ların runtime anahtarı değiştirilmez. Anahtar çıktıya/Git'e yazılmaz.
Önceki imza anahtarıyla oluşmuş veya süresi dolmuş, henüz gönderilmemiş
bağlantılar hesap sahibinin bu yenileme yolu üzerinden tekrar açılır.

Yerel doğrulama: 118 hedefli test, lint, production build ve 22 HTTP kontrolü PASS.
Tam banka 3DS başarı/ret/iptal doğrulaması bu düzeltmenin kanıtı değildir;
gözlem modu ödeme sonucunu yine yalnızca doğrulama bekliyor olarak tutar.

Düzeltme yayını: https://nrs-bequite-inxs7i4mp-ro-j.vercel.app;
sabit TEST alias'ı bu yayına bağlandı. Yayın sonrası ürün/checkout HTTP 200,
oturumsuz payment/create 401, banka success/failure POST 303 ve yalnızca bekleme
ekranı PASS. Yenileme endpoint'i oturumsuz kullanıcıyı 409, null/yabancı origin'i
403 ile reddetti. Mevcut TEST alias koruma istisnası korundu. Production'ın
create/quote/callback/return API'leri HTTP 503; Production yayını yapılmadı.
Kullanıcının tam 3DS denemesi tekrarlanmadı; kart/OTP gönderilmedi, tahsilat yapılmadı.

## Checkout ödeme başlatma: bekleyen TEST siparişi

Handoff'dan bağımsız checkout incelemesinde son tamamlanmış istekler
`POST /api/payment/quote` HTTP 200 ve `POST /api/payment/create` HTTP 409 idi.
Eski catch hata kodu/aşamasını kaydetmiyordu; geçmiş isteğin SQLSTATE'i logdan
geri alınamaz. TEST veritabanında 1 sipariş, 1 pending ödeme, 1 rezervasyon,
1 v1.4 hukuki kayıt ve 0 ödeme olayı vardı. İlk kaydın handoff'ı tüketilmemişti.
Sonraki 409 denemeleri bu sayıları artırmadı.

`nrs_create_payment_order` aynı kullanıcının pending ödemesi varken yeni anahtarla
çağrıldığında `P0001 / Unresolved payment exists; reconcile before a new attempt`
ürettiği rollback korumalı TEST transaction'ında doğrulandı. Önce READ ONLY
denenmiş, RPC'deki SELECT FOR UPDATE bu modu reddettiği için transaction kontrolüne
geçilmiştir. Yeni sipariş/ödeme/rezervasyon kalıcı olarak oluşturulmadı.

Checkout yeni sayfa/özet onayında yeni idempotency anahtarı üretirken önceki ödeme
beklemede kalıyordu. Koruma kaldırılmadı: sadece tam olarak izole TEST gözlem
modunda, aynı kullanıcı + provider + null guest sahipliği ve aynı request_hash
(ürün/varyant/adet/ölçü, müşteri, quote hash, belge sürümleri) eşleşirse mevcut
bankaya gönderilmemiş pending siparişin uygulama bağlantısı atomik yenilenir.
İşlem banka çağrısı, yeni sipariş veya ek stok rezervasyonu oluşturmaz. Tüketilmiş
handoff ve initiating kayıt yenilenmez. Değişen içerikte HTTP 409 /
UNRESOLVED_PAYMENT ile yalnızca sahibinin mevcut siparişine devam bağlantısı verilir.
Normal/Production akışı farklı idempotency anahtarlarını birleştirmez.

Yeni sunucu tanısı yalnızca sabit endpoint/HTTP, uygulama kodu, aşama ve güvenli
SQLSTATE/PostgREST kodu içerir. Ham hata, istek gövdesi, müşteri, sipariş kimliği,
token ve banka bilgileri loglanmaz. START_FAILED aşamaları request, lookup, quote,
create_rpc, handoff, store_redirect olarak ayrılır.

Gerçek TEST DB ile mevcut siparişin tam isteği bellek içinde yeniden doğrulanıp
checkout handler'ı çağrıldı: başlatma 200, HMAC/süre geçerli, handoff GET 200.
Bu kontrollü integration testinde hesap sahibi oturum doğrulayıcısı taklit edildi;
uzaktaki kullanıcının tarayıcı oturumu veya 3DS adımı çalıştırılmış sayılmaz.
Önce/sonra kayıt sayıları 1 sipariş, 1 ödeme, 1 rezervasyon, 0 ödeme olayı olarak
aynı kaldı. Bankaya form/kart gönderilmedi. 124 hedefli test, lint ve production
build + 22 yerel HTTP kontrolü PASS.

Son sürüm: https://nrs-bequite-risse5vdz-ro-j.vercel.app;
sabit nrs-bequite-garanti-test.vercel.app alias'ı bu yayına bağlandı.
Bekleyen sipariş bağlantısının ödeme adımında görünmesi ayrıca checkout render
testiyle doğrulandı; son hedefli koşuda toplam 125/125 PASS, lint ve build PASS.
Yayınlanan kaynak kopyasıyla gerçek TEST DB integration kontrolü tekrarlandı:
başlatma 200, handoff GET 200 ve geçerli imza; mevcut kayıt yeniden kullanıldı.
Önce/sonra sipariş=1, ödeme=1, rezervasyon=1, hukuki kayıt=1, ödeme olayı=0,
iki test varyantının toplam stok adedi=39. Ek stok hareketi yok.
Production create/quote/callback/return HTTP 503 olarak tekrar doğrulandı.

## Güvenli TEST dönüş tanılaması

Yalnızca dzuxhwtbuojnhibzfxqy projesinde `garanti_test_return_diagnostics`
tablosu kurulur; SQL normal migration dizinine dahil değildir. Kurulum betiği
projeyi açıkça sabitler, mevcut sipariş/ödeme olayı/stok değerlerini önce/sonra
karşılaştırır. Yeni tabloda RLS açık, anon/authenticated erişimi yoktur;
service_role yalnızca SELECT/INSERT kullanır. Mevcut tablo/RPC/izinler değiştirilmez.

Kayıt mevcut payment_orders order_id ve idempotency_key (payment_attempt_id) ile
ilişkilidir. İmzasız oid yalnızca `association=claimed` iddiasıdır; geçerli imza
ve sipariş/tutar/TRY/terminal/istek-hash eşleşmelerinin hepsi geçerse verified olur.
Sipariş bulunamaz veya form ayrıştırılamazsa unassociated kaydı oluşur;
bir siparişe sahte eşleştirme yapılmaz. Sahibi doğrulanmadan tanı ekranı okunmaz.

Saklanan alanlar: mdstatus (tek rakam), response (approved/declined/error/failed),
procreturncode (iki rakam), sınırlı güvenli hata açıklamaları, imza/eşleşme
boole değerleri, güven seviyesi ve tanılama sonucu. Tanınmayan kod değerleri null
olur. Serbest hata metni saklanmaz: tanınan açıklamalar sabit güvenli ifadeye
çevrilir, diğerleri gizlilik mesajı ile değiştirilir (en fazla 160 karakter).
Açıklamalar ayrıca hashparams içinde imzalanmadıysa güvenilir kabul edilmez.
Ham POST, kart/CVV, şifre, StoreKey, callback hash/rnd/md/cavv/eci, handoff token,
IP/e-posta/adres/ad-soyad saklanmaz veya loglanmaz. Tekrarlanan aynı güvenli
projeksiyonun fingerprint'i deduplikasyon içindir; ham POST/token özeti değildir.

verified_failure yalnızca imza/eşleşmeler doğru ve banka declined/error/failed
ile non-00 bildirmişse gösterilir. İmzasız başarısız dönüş ayrıca doğrulanamadı
olarak gösterilir. Tam signed Approved/00/mdstatus=1 bile yalnızca tahsilat
doğrulaması bekliyor olur; kısmi/çelişkili 3DS doğrulanamadı olarak kalır.
Tanı hiçbir yoldan finalizeAtomic çağırmaz, sipariş state veya stoğu değiştirmez.
Sonuç ekranında doğrulanmış tanı kayıtları güvenilmeyenlerin önünde tutulur;
bankaya gönderilmiş handoff tekrar açılmaz, yenileme düğmesi gösterilmez.

Önceki denemenin alanları geriye dönük üretilemez. Son salt okunur orderinq'de
0110 (işlem bulunamadı), Response.Code=92, boş Status/ChargeType/OrderInqResult.Code
ve boş Mode görüldü; başarılı satış veya doğrulanmış tutar kanıtı yoktu. Bu tek
örnek bir tahsilat durum eşleştirmesi değildir; eski sipariş pending olarak korunur.

Yeni kullanıcı testi: eski bankaya gönderilmiş siparişi yeniden açmayın. Aynı
hesaptaki unresolved koruması korunur. Ayrı bir TEST hesabıyla, aynı izole sitede
test ürününü seçip mevcut checkout ve v1.4 onaylarını tamamlayabilirsiniz. Resmî
https://dev.garantibbva.com.tr/test-kartlari sayfasındaki Simülatör — 3D:Evet
satırını kullanın; son kullanma 08/2027. Kart/CVV ve kaynağın belirttiği TEST OTP
yalnızca sanalposprovtest.garantibbva.com.tr bankanın TEST ekranına girilir.
Bu kullanıcı denemesi ayrı bir TEST siparişi/rezervasyonu oluşturur; gerçek satış
ve Production kullanılmaz. Ajan kart/OTP girmez veya ödeme başlatmaz.

Yayın: https://nrs-bequite-3pyp0sv9u-ro-j.vercel.app; sabit Garanti TEST alias'ı
bu sürüme bağlandı. 132 hedefli test, lint, production build ve 22 yerel HTTP
kontrolü PASS. TEST DB'de service_role INSERT/dedupe rollback denemesi PASS;
ardından yayınlanan success/failure POST'larına imzasız boş kontrol gönderildi.
İki kayıt yalnızca unassociated / signature_verified=false tanı kaydıdır;
gerçek banka sonucu veya önceki denemenin alanları değildir. Yeni sipariş/ödeme
oluşturulmadı: orders=1, payment_orders=1, reservations=1, payment_events=0,
toplam varyant stok adedi=39 kaldı. Gerçek banka satışı veya kart/OTP girişi yok.
Yayında failure POST 303 -> checkout/failure, ekranda sonuç doğrulanamadı;
success POST 303 -> verify, sahte paid URL'sinde de sonuç doğrulanamadı PASS.
Production ödeme API'leri 503 olarak korundu. Tam banka 3DS denemesi kullanıcı
tarafından yeni TEST hesabıyla yapılmalıdır; bu kontroller banka kabul testi değildir.

## TEST Mode ve gözlem ayrımı — 13 Ekim 2026

Güncel çalışma ve kaynak kararı: [TEST Mode kanıtı](garanti-test-mode-evidence-20261013.md).
Boş/eksik Mode yalnızca TEST gözlem sorgusunda sabit TEST endpoint + outgoing TEST
request bağlamıyla ele alınır; çelişen Mode/kimlik/tutar kabul edilmez. Production
kontrolleri korunur. Sonuç ekranı artık gözlem nedeniyle finalize'ın kapalı olduğunu
teknik imza/sorgu hatasından ayrı gösterir. Kalıcı validation_stage/query_stage
ve güvenli query_evidence yalnızca izole TEST tanı tablosuna eklenmiştir.

## Tekrarlanan TEST dönüş alanları — 13 Ekim 2026

00:14:07 success POST için duplicate_field tanısı alınmıştır; eski POST
saklanmadığından gerçek tekrar adı/sayısı/eşitliği geçmiş kayıttan çıkarılamaz.
Yeni duplicate_fields yalnızca allowlist alan adı, tekrar sayısı ve same/different
saklar. Bilinmeyen adlar unrecognized olur; hiçbir alan değeri veya ham POST
saklanmaz. TEST gözlem ayrıştırıcısı yalnızca TÜM decoded değerleri birebir
eşit olan tekrarları tekilleştirir. Farklı tekrarlar reddedilir; hashparams
adlarının benzersizliği, SHA512 imzası ve bütün ödeme eşleşmeleri korunur.
Production/default ayrıştırıcı tekrarları kabul etmez.
Resmî sözleşmede tekrar alanları ayrıca tanımlanmaz; tekilleştirme güvenliği
imza ve eşleşmenin aynı tekil değer haritasını kullanmasına dayanır.
35 ilgili test, lint, TypeScript kontrolü ve remote build geçti. TEST yayını:
https://nrs-bequite-kvgiim2ce-ro-j.vercel.app, sabit test alias buna bağlıdır.
Sentetik terminalid repeat=2 same/different POST'ları yalnızca kayıt mekanizması
kontrolüdür; gerçek banka onayı kanıtı değildir. Yeni bir kullanıcı TEST denemesi
gerçek tekrar alanını ve imza/eşleşme sonucunu belirlemek için gereklidir.

## Aynı hesapta ayrı TEST denemesi — 13 Ekim 2026

Önceki cross-key pending resume checkout'tan kaldırıldı. Yeni idempotency anahtarı
eski pending siparişe bağlanmaz. Yalnızca garantiObservationOnly() tam izole TEST
koşulları sağlandığında nrs_create_garanti_test_observation_order kullanılır.
TEST-only SQL dosyası mevcut hardened RPC'nin kodunu kopyalar; yalnızca per-owner
pending yasağına bu ayrı RPC'de istisna getirir. Normal RPC değiştirilmez.
Yeni RPC service_role-only, sabit TEST policy marker ve sentetik ürün kontrolü
ister. Aynı-key ownership/content lock ve replay, fiyat/hukuki kayıt/stok kontrolleri,
atomik rezervasyon ve owner lock korunur. Tüketilmiş handoff yeniden açılamaz.
Eski pending kayıtlar veya rezervasyonlar silinmez/serbest bırakılmaz.
37 ilgili test, lint ve TypeScript kontrolü PASS. Gerçek test DB'de 00:14 hesabı
ile ayrı yeni key/order ve same-key replay rollback içinde PASS; normal RPC hâlâ
pending sahibinde yeni key'i reddeder. Rollback sonrası orders=3, payments=3,
reservations=3, events=0, stock=33 korunur. Banka isteği gönderilmedi.
Mevcut tüm TEST hesapları, 30a6d0de-b56e-4b8b-a738-c2381ae87fae siparişinin
hesabı dahil, checkout'ı yenileyip özeti/onayları tamamlayarak ayrı TEST denemesine
başlayabilir. Aynı-key POST tekrarını yeni deneme saymak için otomatik key değiştirilmez.
Production yolu normal RPC ve mevcut pending engelini kullanmaya devam eder.

Yeni TEST Preview: https://nrs-bequite-ii09vy3wy-ro-j.vercel.app; sabit alias
bu sürüme bağlandı. Remote build PASS, yayımlanan repository kaynak kopyası
yerel dosyayla birebir aynı. Checkout 200; oturumsuz create 401 kontrolü PASS.
Production deploy yapılmadı; main/HEAD/stash korundu.

## Dönüş imzası: eksik ve boş alanlar — 13 Ekim 2026

Son a480dfba-e653-4619-bcf4-f9a678e6e2d3 tanısı: terminalid x2 same;
imza false, beş eşleşme true, mdstatus=1/approved/00 güvenilmeyen bildirim.
İmzasız sonuçtan orderinq/finalize başlatılmadı. Mevcut POST ve hash alanları
saklanmadığı için aynı dönüşün hash'i yeniden hesaplanamaz.
Java `Secure3DSuccessRequest.generateHashForValidate()` dönüş doğrulaması
SHA1, ISO-8859-9 ve standart Base64 kullanır; `OOSSuccess.jsp` hashparams
sırasındaki POST değerlerini birleştirip literal StoreKey ekler. Dönüş hesabı
giden `secure3dhash` hesabından ayrıdır: istek SHA512 HEX olarak kalır, dönüş
20 bayt SHA1 digest'in 28 karakterlik Base64 biçimidir. Dönüş digest'i sabit
zamanlı karşılaştırılır; Base64 case-sensitive ve canonical olmalıdır.
Java örneğinde bulunmayan POST parametresi boş string olarak birleştirilir.
Hashparams gerekli adları ve benzersizliği ile bütün ödeme eşleşmeleri korunur.
Hashparams sırası gelen listedeki sıradır; trailing boş token sıfır byte katkıdır.
Form + boşluk, %2B artı, %25 yüzde olarak bir kez çözülür. Alan değerleri trim
veya case-normalize edilmez. StoreKey literal metindir; hex/base64 dönüşümü yok.
Request secure3dhash dönüş hash hesabında kullanılmaz; hashparamsval yalnızca
yeniden birleştirilmiş metinle eşitlik boole tanısıdır, verification kaynağı değildir.
Bu kod farkı kesindir; son işlemin imza reddinin bundan kaynaklandığı kanıtlı değildir.
return_signature_evidence sabit result nedeni, algoritma/kodlama, form charset,
hash formatı, hash uzunluğu ve strict HEX/Base64 uygunluğu, decode edilen bayt
uzunluğu, güvenli parametre sırası ve missing/empty alan adlarını saklar.
Hash/input/StoreKey veya kart değeri saklanmaz. Hash biçimi tanılaması SHA1
Base64 doğrulayıcısını seçmez; yalnızca sabit protokol denetlenir.
