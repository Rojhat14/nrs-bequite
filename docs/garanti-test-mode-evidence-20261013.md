# Garanti TEST Mode bağlamı ve gözlem tanısı — 13 Ekim 2026

## Kaynak ve karar

Resmî sipariş sorgulama sayfasının Cevap Yapısı tablosu Mode için PROD/TEST
biçimini tanımlar; alanın zorunlu/dolu olmasını veya kardinalitesini belirtmez.
Bu eksiklik, Mode alanının bankaca opsiyonel olduğu garantisi değildir.
Aynı kaynak TEST ve PROD için farklı HTTPS VPServlet endpointleri tanımlar.
https://dev.garantibbva.com.tr/sanalpos-sorgulama-siparis-sorgulama

Uygulama kararı yalnızca TEST gözlem moduna sınırlıdır. Mode absent/empty ise:
- seçili config TEST olmalı; credential'lar TEST kümesinden seçilir;
- istek yalnızca https://sanalposprovtest.garantibbva.com.tr/VPServlet adresine gönderilir;
- XML Mode TEST olur; TLS doğrulaması korunur, redirect:error kullanılır;
- cevapta terminal, merchant ve sipariş kimliği birebir doğrulanır;
- DB TRY/949 tutarı ve imzalı dönüşteki authcode sorgu ile karşılaştırılır.
Bu ortam kanıtı mode_evidence=test_endpoint_and_request olarak kaydedilir.
Dolu TEST response değeri response olarak kaydedilir. PROD/bilinmeyen/non-scalar
Mode conflict olur; kimlik doğrulanmış sayılmaz. Yanlış endpoint ağ çağrısından
önce reddedilir. Production ve settlement akışının eski sıkı Mode kontrolü korunur.
Bu bir banka onaylı nullable Mode sözleşmesi değil, TEST gözlemine sınırlı
endpoint bağlamı çıkarımıdır. ReasonCode boşluğu başarı kodu olarak uydurulmaz.

## Gözlem ile hata ayrı

Tanı yoksa ekran TEST — Gözlem modu der ve tanı kaydı olmadığını açıklar.
Geçerli imza + request/terminal/sipariş/tutar/TRY eşleşmesi ayrı gösterilir.
Sorgu matched/mismatch/unavailable olarak ayrı saklanır. Eşleşmiş sorguda
Status, ChargeType ve Code değerleri gösterilir; semantiği tahmin edilerek paid
üretilmez. Her sonuçta otomatik sipariş onayının test politikası nedeniyle
kapalı olduğu açıkça yazılır. Gerçek imza/alan/sorgu hataları ayrı metinlerle
belirtilir. Tam authenticated mdstatus=1 dışındaki dönüşler approval sayılmaz.

## Kalıcı kayıt

TEST-only extension: dzuxhwtbuojnhibzfxqy-garanti-diagnostics-evidence.sql.
Mevcut signature_verified, order_match, amount_match, currency_match,
terminal_match, request_match alanları korunur. Yeni validation_stage,
query_stage ve whitelist'li query_evidence JSONB sütunları eklenir.
Ayrıştırma başarısızlıkları artık legacy boş kontrollerle aynı projeksiyon değildir.
İmzalı/eşleşen dönüşler yalnızca bir orderinq çağrısı yapar; handler ikinci sorgu
veya finalize çağrısı yapmaz. İmzasız/eşleşmeyen dönüşten banka sorgusu başlatılmaz.
Sorgu başarısız olsa bile imza/eşleşme kanıtı unavailable tanısıyla saklanır.
Ham banka POST, kart/CVV, IP/müşteri, hash, şifre, StoreKey, authcode ve banka
referans değerleri saklanmaz. Sorgu authcode/ref alanlarında sadece presence ve
signed authcode match boole değerleri tutulur. Tanı kaydı sipariş sahibine gösterilir.

## Doğrulama

100 ilgili test, lint, izole build ve 22 local production HTTP kontrolü başarılı.
TEST DB extension uygulandı; RLS açık, anon read/browser write kapalı.
Service_role sentetik signature=true ve tüm return match=true + query kanıtını
transaction içinde yazıp okudu; rollback kaldırdı. Bu sentetik depolama kanıtıdır,
gerçek imzalı banka dönüşü değildir. orders=2, events=0, stok=36 korundu.
Branch main, HEAD f975fd1fe8b22e9a2ab9e57e9a7a208b9a13e0a0,
stash 5b55965a760cfe0580f61f7baf23fd15689d3e0f korunur; commit/push yok.

## Yeni kullanıcı denemesi

Sabit site: https://nrs-bequite-garanti-test.vercel.app.
Pending siparişi olmayan ayrı TEST hesabıyla test ürününü seçin, checkout
onaylarını tamamlayın ve bankaya geçin. Kart/CVV ve OTP yalnızca bankanın TEST
sayfasında girilir. Resmî kart listesinin Simülatör / 3D:Evet kaydı kullanılmalıdır:
https://dev.garantibbva.com.tr/test-kartlari
Eski işlemin tüketilmiş handoff'u açılmaz; pending koruması kaldırılmaz.
Yeni deneme sonrasında bu siparişin DB tanısı + aynı referans orderinq sonucu
ile uygulama state birlikte raporlanır. Kullanıcı denemesi gerçekleşmeden
banka doğrulaması tamamlandı denmez.

## Yayın ve mevcut işlem kontrolü

Preview https://nrs-bequite-q6l2lr2ul-ro-j.vercel.app; sabit TEST alias bu sürümde.
Remote build PASS; deployed source copy adapter/diagnostics/query-evidence/result
bileşeni ile yerel dosyalar birebir aynı. Test ürün/checkout 200, oturumsuz create
401, sentetik JSON success/failure POST 303; sonuç sayfalarında TEST — Gözlem modu
ve otomatik onay kapalı açıklaması doğrulandı. Production ödeme API'leri 503.
Eski 95ca710a-8367-49ea-b1de-5d83f28b7a7a yalnızca orderinq ile tekrar sorgulandı:
HTTP 200, APPROVED/S/00, identity_match=true, amount_match=true,
mode_evidence=test_endpoint_and_request, auth_match=null (eski signed authcode yok).
Bu sorgu geçmiş dönüş imzasını kurtarmıyor; finalize kapalı ve eski sipariş pending.
Yeni kullanıcı denemesi henüz gerçekleştirilmiş sayılmıyor.

Son ek kayıt düzeltmesi: siparişle ilişkilendirilemeyen her dönüşe ham POST'tan
bağımsız rastgele receipt fingerprint verilir; eski boş probe ile birleşip yeni
dönüş zamanını kaybetmez. Associated aynı güvenli kanıt dedupe edilir.
11 hedefli tanı testi ve lint tekrar geçti; son Preview remote build PASS:
https://nrs-bequite-hh58cr6hi-ro-j.vercel.app.

Son alias hh58cr6hi yayınına bağlı; anonim HTTP/result kontrolleri tekrar geçti.
Yayın öncesi iki siparişin DB state/updated_at değerleri değişmedi. Kalıcı yeni
content_type tanı kayıtları gerçek TEST DB'den geri okundu (sentetik probe).
Henüz yeni kullanıcı banka denemesi yok; kullanıcıdan yeni sipariş/saat bilgisi istendi.
