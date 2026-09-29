# Supabase Bağlantı Teşhisi

Bu teşhis, `.env.local` değerlerini yazdırmadan ve yalnızca salt okunur GET istekleriyle yapıldı. Herhangi bir kaynak dosya, migration, tablo veya Supabase kaydı değiştirilmedi. URL ve anahtar değerleri bu raporda yer almıyor.

## A) Environment variables durumu

- `.env.local` mevcut.
- `NEXT_PUBLIC_SUPABASE_URL`: mevcut, boş değil, HTTPS Supabase URL biçiminde.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: mevcut, boş değil. Değerin biçimi modern Supabase publishable key biçimine benziyor; gerçek değer raporlanmadı.
- `src/lib/supabase.ts`, bu iki değişkeni doğrudan `process.env.NEXT_PUBLIC_...` üzerinden `createClient(url, key)` çağrısına veriyor. Bu değişkenler Next.js tarafından istemci bundle'ına derleme zamanında aktarılır; mevcut kod doğru değişken adlarını kullanıyor.
- Kaynak kod ve Next config içinde ayrıca hard-code edilmiş Supabase URL bulunmadı.
- Çalışan Next.js dev server olup olmadığı ve `.env.local` son değişikliğinden sonra yeniden başlatılıp başlatılmadığı doğrulanamadı.

## B) Supabase URL bağlantı durumu

- HTTPS Supabase host'una erişilebildi; host kök yolu HTTP `404` döndürdü. Kök yolun `404` olması tek başına erişim hatası değildir.
- Aynı host üzerindeki Auth health endpoint'i API key başlığıyla HTTP `200` döndürdü. Bu, ağ/host erişiminin çalıştığını gösteriyor.

## C) REST/Auth test sonucu

- Auth health: API key ile `200`; API key olmadan `401`.
- REST OpenAPI endpoint'i: API key başlığıyla `401`. API key ve Bearer başlığı birlikte gönderildiğinde de `401`; yanıt anahtar yetkilendirmesi reddiyle uyumlu.
- Testler yalnızca GET kullandı; hiçbir tablo verisi okunmadı veya değiştirilmedi.

## D) 401'in en olası nedeni

URL erişilebilir ve Auth health isteği API key ile başarılı. Sorun genel ağ erişimi veya kodun değişken adını kullanmaması gibi görünmüyor; REST katmanı sunulan anahtarı reddediyor. En olası neden `.env.local` içindeki URL ile anahtarın aynı Supabase projesine ait olmaması veya bu projedeki REST/Data API anahtar yapılandırmasıyla uyumsuz olmasıdır. Anahtar biçimi publishable key'e benziyor; `.env` değişikliğinin çalışan Next.js sürecine yüklenmemiş olması da canlı uygulamada ayrı bir olasılık olarak doğrulanamadı.

## E) Çözmek için gereken tek sonraki adım

Supabase Dashboard'da **Project Settings → API Keys** bölümünden URL ile aynı projeye ait, REST/Data API için önerilen publishable/anon anahtarını doğrulayın; ikisinin aynı projeye ait olduğunu teyit edip `.env.local` değerlerini oradan güncelleyin. Sonrasında çalışan Next.js dev server'ı yeniden başlatıp REST GET kontrolünü tekrarlayın. Anahtar değerini paylaşmayın.

## F) Bu aşamada değiştirilmemesi gereken dosyalar/veriler

- Kod tarafında `src/lib/supabase.ts`, Auth ve profil dosyaları, favori dosyaları, ödeme API route'ları ve diğer mevcut uygulama dosyaları değiştirilmemeli.
- Migration çalıştırılmamalı; tablo/Storage bucket oluşturulmamalı veya silinmemeli.
- `profiles`, `wishlist`, `orders`, `order_items` kayıtlarına ve Supabase Auth kullanıcılarına dokunulmadı; bu aşamada da değiştirilmemelidir.
- `service_role` anahtarı oluşturulmadı, kullanılmadı ve istemci koduna eklenmedi.
