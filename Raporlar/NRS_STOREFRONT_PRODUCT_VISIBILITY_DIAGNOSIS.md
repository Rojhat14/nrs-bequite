# NRS Storefront Ürün Görünürlüğü Teşhis Raporu

## Sonuç

Verilen `111111111` ürünü için sorun mevcut kaynak kodda bir `status`, kategori, koleksiyon, limit veya ilişki join filtresi olarak bulunmadı. Salt-okunur Supabase sorgusu ve temiz production build ile yapılan HTTP kontrollerinde ürünün ana sayfa, `/category/alt-giyim`, `/collections/gunduz` ve `/collections/davet` HTML çıktısında bulunduğu doğrulandı. Sorun bu incelemede yeniden üretilemedi; storefront kodunda gereksiz değişiklik yapılmadı.

Ürün sorgusu başarılı olduğunda aktif ürünleri `status = active` ile alıyor ve limit/pagination uygulamıyor. Ürün-kategori eşleşmesi `category_id` ile; koleksiyon eşleşmesi önce `product_collections`, sonra aktif ürün ID'leriyle yapılıyor. Görsel, varyant veya koleksiyon metadata'sı ürün temel sorgusunda zorunlu join değil; bunlar eksik olsa da ürün mapping'den düşmüyor.

## Canlı, salt-okunur Supabase doğrulaması

Anon key veya başka bir secret raporlanmadan mevcut `.env.local` bağlantısıyla SELECT yapıldı:

- `products`: HTTP 200; `111111111`, `beyaz elbise`, `active` döndü.
- `categories`: HTTP 200; ürünün `category_id` değeri aktif `Alt Giyim` / `alt-giyim` kategorisine eşleşti.
- `product_collections`: HTTP 200; ürüne iki ilişki döndü.
- `collections`: HTTP 200; ilişkili koleksiyonlar `Gündüz` / `gunduz` ve `Davet` / `davet`, ikisi de aktif.

Hiçbir veritabanı kaydı değiştirilmedi.

## Uygulama route testi

Yeni production build yerel Next.js server'da çalıştırıldı. Dört sayfa da HTTP 200 döndürdü ve sunucu HTML çıktısında `beyaz elbise` bulundu:

| Route | HTTP | Ürün HTML içinde |
| --- | ---: | --- |
| `/` | 200 | Evet |
| `/category/alt-giyim` | 200 | Evet |
| `/collections/gunduz` | 200 | Evet |
| `/collections/davet` | 200 | Evet |

Bu nedenle en olası açıklama eski çalışan dev server/build veya tarayıcıda eski sayfa çıktısının kalmasıdır; bu olasılık ayrı bir eski dev server örneğinde doğrulanmadı. Geliştirme sunucusunu tamamen durdurup tekrar başlatın ve tarayıcıda hard refresh yapın. Bu kontrollerden sonra sorun sürerse o anda çalışan sunucunun logu ve kullanılan deployment environment'ı ayrıca karşılaştırılmalıdır.

## Fallback davranışı

`getStorefrontProducts()` Supabase sorgusu hata verirse eski statik ürünlere fallback yapıyor; başarılı ve boş sorguda ise statik ürünleri döndürmüyor. Bu fallback yeni ürünleri görünmez bırakabileceği için Supabase hatasını maskeleyebilir. Ancak bu incelemedeki canlı SELECT ve temiz Next.js production istekleri başarılıydı; gözlenen bu testlerde fallback devreye girmedi. İstenen sınırlar doğrultusunda fallback kaldırılmadı/değiştirilmedi.

## Dosya değişikliği ve doğrulama

- Uygulama kodu değiştirilmedi.
- Oluşturulan rapor: `NRS_STOREFRONT_PRODUCT_VISIBILITY_DIAGNOSIS.md`.
- `npx tsc --noEmit --incremental false` — başarılı.
- `npm run build` — başarılı; tüm sayfalar üretildi.
- Build çıktısında bu çalıştırmada kalan uyarı yoktu.
