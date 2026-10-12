# Garanti TEST — onaylanan denemenin incelemesi

Hedef yalnızca https://nrs-bequite-garanti-test.vercel.app ve dzuxhwtbuojnhibzfxqy.
Sağlayıcı garanti-oos; 3D_OOS_PAY, sales, tek çekim TRY. Kart girişi bankada.

## Korunan çalışma durumu

Başlangıç branch main; HEAD f975fd1fe8b22e9a2ab9e57e9a7a208b9a13e0a0.
Stash 5b55965a760cfe0580f61f7baf23fd15689d3e0f korunur. Commit/push/switch/reset yapılmadı.
Repo ve üst dizinlerde AGENTS.md bulunmadı. Mevcut commit edilmemiş dosyalar korundu.
Alternatif garanti-3d.patch uygulanmadı; strict-origin handoff politikası korundu.

## Son denemenin ilişkisi

Son sipariş: 95ca710a-8367-49ea-b1de-5d83f28b7a7a; oluşturma 2026-10-12 20:38:37 UTC
(23:38:37 Türkiye), tutar 300 kuruş, TRY, pending, tüketilmiş handoff.
Aynı deployment log zinciri: create 20:38:36 / 200, handoff POST 20:38:40 / 200,
success POST 20:39:47 / 303, tüketilmiş handoff GET 20:40:02 / 409.
Orderinq aynı UUID ve tutarı doğruladı. Bu zincir son banka onayına ilişkin en güçlü
mevcut kanıttır; geçmiş POST saklanmadığı için imzalı dönüşün birebir UUID ilişkisi kanıtlanamaz.
Önceki b93eeaf6-6963-4dd5-8c28-abca496febd9 19:10:23 UTC / 100 kuruş denemesidir.

| Aşama | Gerçek sonuç |
| --- | --- |
| Banka dönüşü mdstatus/response/procreturncode/açıklamalar | Son denemeye bağlı kayıt yok; bilinmiyor. Önceki boş sentetik kontroller banka kanıtı değildir. |
| Dönüş imzası | Yeniden doğrulanamaz; ham POST ve imza saklanmamış. İmza geçersiz diye sonuç çıkarılamaz. |
| Dönüş sipariş/terminal/tutar/TRY/istek hash eşleşmeleri | Son dönüş için bilinmiyor. |
| Orderinq HTTP | 200, yalnızca TEST VPServlet, satış gönderilmedi. |
| Orderinq kimlik/tutar | Sipariş, terminal, merchant ve AuthAmount=300 eşleşti. |
| Orderinq banka alanları | Response.Code=00, Response.ReasonCode boş, Status=APPROVED, ChargeType=S, OrderInqResult.Code=00. |
| Orderinq ek alanlar | Mode boş; AuthCode ve RetrefNum dolu (değerleri tutulmadı/raporlanmadı). Cevapta para birimi alanı yok; sorgu TRY/949 gönderildi. |
| Mevcut reconcile | blocked_query_identity; gerçek boş Mode mevcut doğrulamaya takılıyor. |
| Finalize RPC | Çağrılmadı; DB hatası kanıtı yok. Gözlem modu zaten settlement kapatıyor. |
| DB | 2 sipariş, 2 pending ödeme, 2 rezervasyon, 0 payment_events; toplam varyant stok 36. |

## Kesin bulgular ve sınırlar

Pending sonucunun kesin nedeni test gözlem modunun bilerek finalize yapmamasıdır.
Bunun dışında sonuç ekranının doğrulanamadı demesinin tekil ayrıştırma/imza nedeni
geçmiş kayıtlarla belirlenemiyor: tanı tablosunda sadece 20:26 UTC boş endpoint
kontrolleri mevcut. Ayrıştırma başarısızlıkları aynı boş projeksiyona dönüşüp dedupe
edilebiliyordu; istisna nedeni kayboluyordu. Loglarda success POST 303 olması imza
veya tahsilat doğrulamasını kanıtlamaz.

İkinci kanıtlı teknik engel: gerçek orderinq boş Mode döndürüyor; mevcut query
kimlik kontrolü TEST beklediğinden reconcile reddediyor. ReasonCode da boş.
Kamuya açık sorgu dokümanı Mode için TEST/PROD tanımlar; Status/ChargeType/Code
karşılıklarını listelemez. APPROVED/S/00 gözlenmiş bir kombinasyondur; bunun bütün
koşullarda kesin tahsilat anlamına geldiği varsayılmadı. Boş Mode/ReasonCode kabul
edilmedi; GARANTI_OOS_VERIFIED veya sandbox/settlement bayrakları değiştirilmedi.

İlk regex şüphesi araç çıktısının kaçış gösteriminden kaynaklandı. Gerçek dosyada
tek ters eğik çizgi vardı; mevcut kod doğruydu, regex düzeltmesi yapılmadı.

## Yapılan değişiklik

- Form ayrıştırma retleri sabit güvenli aşama kodlarıyla ayrılır: content_type,
  charset, text_encoding, percent_encoding, duplicate_field vb.
- TEST runtime tanısı ayrıştırma, sipariş arama, imza ve alan eşleşmesi aşamalarını
  kaydeder. Ham değerler, alan adları, sipariş ID, kimlik bilgileri, hash ve kart verileri loglanmaz.
- TEST orderinq güvenli durum/kod ve eşleşme projeksiyonunu sıkı kontrol öncesinde
  kaydeder. Boş Mode veya eksik alanlar artık yutulmuş bir hata olarak kaybolmaz.
- Bunlar tanı iyileştirmesidir; geçmiş banka imzasını kurtarmaz ve ödeme onayı açmaz.

97 ilgili test, lint, izole build ve 22 yerel production HTTP kontrolü geçti.
Gerçek mevcut sipariş salt okunur sorgulandı; reconcile engeli doğrulandı.
Yeni satış gönderilmedi, sipariş failed/paid yapılmadı, kayıt silinmedi.
Pending aynı kullanıcı için yeni ödeme girişimini engellemeye devam eder; bankaya
henüz gönderilmemiş bağlantı yenileme istisnası tüketilmiş bağlantıya uygulanmaz.

## Tek sonraki kullanıcı adımı

Garanti teknik desteğine bu TEST sipariş referansı ve 23:38–23:40 Türkiye zamanını
ileterek aynı işlemin imzalı success dönüşünün yeni satış olmadan tekrar iletilmesini,
APPROVED/S/00 karşılıklarını ve sorguda boş Mode/ReasonCode dönüşünü teyit etmelerini isteyin.
Şifre, StoreKey, kart/CVV veya ham POST sohbet üzerinden paylaşılmamalı.
İmzalı 3DS kanıtı ve sorgu semantiği açıklığa kavuşmadan otomatik paid güvenli değildir.

Kaynaklar:
- https://dev.garantibbva.com.tr/sanal-pos-ortak-odeme-pesin
- https://dev.garantibbva.com.tr/sanalpos-sorgulama-siparis-sorgulama
- https://dev.garantibbva.com.tr/destek-merkezi

## Yayın doğrulaması

Yeni Preview: https://nrs-bequite-5hs454und-ro-j.vercel.app. Sabit TEST alias
bu sürüme bağlandı; alias koruma istisnası korundu. Remote build PASS.
Deploy kaynak kopyasındaki protocol/adapter/diagnostics dosyaları yerel dosyalarla aynı.
Test ürün/checkout 200, oturumsuz create 401, boş sentetik success/failure POST
303 ve sahte paid URL yalnızca doğrulanamadı gösteriyor. Bunlar banka kabul testi değildir.
Production create/quote/callback/return 503; canlı ödeme kapalı.
Yayın sonrası HEAD, main branch ve stash hash başlangıçla aynı.

Yeni deployment runtime loglarında iki sentetik JSON POST için content_type
aşama kodu ve 303 doğrulandı. Bu kayıtlar son banka dönüşünün nedeni değildir;
yeni güvenli tanının yayında çalıştığının kanıtıdır. Yayın sonrası iki mevcut
siparişin tutar/state/updated_at/handoff bilgileri ve önceki tanı kayıtları değişmedi.
