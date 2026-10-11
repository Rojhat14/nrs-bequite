# Supabase Salt Okunur Bağlantı Teşhisi

## A) Auth health

HTTP 200; sağlıklı yanıt alındı.

## B) REST/OpenAPI

Yalnızca API key header ile HTTP 401. `apikey` ve Bearer header birlikteyken de HTTP 401.

## C) Supabase JS client SELECT

Kaynak kodda kullanılan `wishlist` tablosunda `select('product_id').limit(0)` sorgusu HTTP 200 döndürdü. Sorgu satır verisi döndürmedi.

## D) Normal uygulama bağlantısı çalışıyor mu?

Evet. Anon key ile Supabase JS üzerinden salt okunur SELECT başarılı.

## E) Sorun yalnızca OpenAPI/schema endpointinde mi?

Yapılan testlerde evet: normal REST SELECT başarılı, kök OpenAPI/schema isteği 401 döndürüyor.

## F) SELECT de başarısızsa en olası nedenler

Uygulanamaz; SELECT başarılı.

## G) Bir sonraki güvenli adım

Şema ve RLS incelemesi için Supabase Dashboard'daki Table Editor veya SQL Editor kullanılabilir. Dashboard yapılandırmasına bu incelemede erişim yok; OpenAPI 401'in kesin sunucu tarafı nedeni doğrulanamadı.

## Güvenli işlem özeti

- Hiçbir API key, token veya secret raporlanmadı.
- Yalnızca Auth health ve REST GET istekleri ile `limit(0)` SELECT çalıştırıldı.
- Dosya oluşturma haricinde uygulama kaynakları değiştirilmedi.
- Hiçbir migration, INSERT, UPDATE, DELETE veya RLS değişikliği yapılmadı.
