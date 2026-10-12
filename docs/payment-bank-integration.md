# Banka adaptörü bağlantı hazırlığı

Kartla ödeme kapalıdır. Gerçek banka adaptörü kayıtlı değildir; banka protokolü,
test erişimi ve banka test sonuçları olmadan açılmaz. Yerel test sağlayıcıları
banka entegrasyonunun doğrulandığı anlamına gelmez.

## Mevcut bağlantı noktaları

`src/lib/payment/types.ts` içindeki `PaymentProvider` arayüzü kullanılacaktır.
Doğrulanan adaptör `src/lib/payment/provider.ts` kayıt listesine eklenecektir.
Sahte adaptör, tahmin edilen imza algoritması veya genel API URL'si eklenmez.

| İşlem | Mevcut bağlantı noktası | Banka protokolünden gereken |
| --- | --- | --- |
| Başlatma | `initiate` | Kimlik doğrulama, kuruş/tutar formatı, idempotency ve izinli yönlendirme alan adları |
| Bildirim | `verifyCallback`, `callbackResponse` | Ham gövde imzası, yeniden oynatma koruması, banka durum sorgusu ve kabul yanıtı |
| 3D Secure dönüş | `verifyReturn` | İmzalı sonuç veya sunucudan durum sorgusu; tarayıcı parametreleri başarı kanıtı olamaz |
| Mutabakat | `reconcile` | Sipariş referansı ile kimliği doğrulanmış işlem/durum sorgusu |

Doğrulanmış başarılı, başarısız veya iptal edilmiş banka sonuçları mevcut
`VerifiedPayment` durumlarına bankanın belgelenmiş kurallarıyla çevrilir.
İptal/başarısızlık `paid` olamaz; belirsiz işlem `pending` kalır ve sorgulanır.
`finalizeAtomic` mevcut tutar, para birimi, referans ve benzersiz işlem
kontrollerinden sonra güncelleme yapar. Mevcut SQL/RLS ve stok kuralları değiştirilmez.
Uygulama kart numarası/CVV toplamaz veya saklamaz; kart girişi banka onaylı
yönlendirme/hosted ekranında yapılır.

## Test ve canlı ortam ayrımı

- `PAYMENT_MODE=sandbox`: yalnızca ayrı test Supabase projesi ve banka test
  kimlik bilgileri bulunan izole Preview/yerel ortam. Vercel Production'da reddedilir.
- `PAYMENT_MODE=live`: banka testleri tamamlandıktan sonra gerçek banka uç noktaları
  ve canlı kimlik bilgileriyle kullanılabilir. Mod tek başına etkinleştirme değildir.
- Adaptör kendi `mode` değerini bildirir; yapılandırma ile eşleşmezse ödeme kapalı kalır.
- Her iki ortamda `PAYMENT_ENABLED` ve `PAYMENT_DATABASE_VERIFIED` başlangıçta `false`
  kalır. Veri tabanı doğrulaması ilgili hedef proje için ayrıca yapılır; migration/GRANT
  değişikliği veya otomatik etkinleştirme yapılmaz.
- Test sonuçları başarılı, reddedilen, iptal edilen, geçersiz/tekrarlanan bildirim,
  değişmiş tutar/para birimi ve gecikmiş sonuç senaryolarını kapsar. Gerçek tahsilat yapılmaz.
- Sandbox ödemeleri canlı Supabase siparişlerine yazılmaz. Production yayını için
  banka adaptörü, canlı izin ve güvenli ortam yapılandırması ayrıca doğrulanır.

## Bankadan gereken bilgiler

1. Banka/sağlayıcı adı, kullanılan sanal POS ürünü, entegrasyon yöntemi ve resmi teknik doküman sürümü/bağlantısı.
2. Sandbox başlatma, 3D Secure, durum sorgusu ve iptal sonuçlarının resmi uç noktaları; canlı karşılıkları ayrı olarak.
3. Gerekli kimlik bilgisi alanlarının adları (ör. merchant/terminal/mağaza kullanıcı kimlikleri) ve yetkileri. Gizli değerler yalnızca Vercel'in ilgili ortamına girilir.
4. İstek ve bildirim imza/hash kuralları, alan sırası, karakter kodlaması, ham gövde doğrulaması ve başarı/başarısızlık/iptal durum kodları.
5. Onaylanacak callback ve 3D Secure dönüş URL'leri, izinli yönlendirme alan adları ve varsa IP/TLS/sertifika koşulları.
6. Bankanın verdiği test senaryoları/test araçları, beklenen sonuçlar ve banka sandbox erişimi. Test kart bilgileri uygulamaya veya rapora kaydedilmez.
7. Tutar/para birimi formatı, idempotency/tekrar bildirim, zaman aşımı ve mutabakat kuralları; varsa iptal/iade protokolü.
8. Ayrı test Supabase projesi ve hedef ortam ödeme işlem/RPC doğrulaması; canlıya açılış için bankanın canlı kullanım onayı.

`PAYMENT_API_KEY` / `PAYMENT_API_SECRET` genel yer tutucu isimlerdir. Bankanın
belgeleri gelmeden Garanti BBVA veya PayTR alanlarıyla eşleştirme yapılmaz.
Gizli değerler kaynak koduna, sohbet çıktısına veya bu belgeye yazılmaz.
