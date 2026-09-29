# NRS Canlı Supabase Şema ve RLS İnceleme Raporu

## İnceleme yöntemi ve sınırlar

Canlı Supabase'e mevcut public/anon key ile yalnızca SELECT istekleri yapıldı. Dört public tablo için `select('*').limit(0)` kullanıldı; hiçbir satır verisi alınmadı. `orders` ile `order_items` nested relation sorgusu da `limit(0)` ile denendi. Ayrıca `pg_policies` metadata'sına anon API üzerinden erişim denendi. OpenAPI endpoint'i 401, `pg_policies` ise public schema cache'inde bulunamadı. Dashboard/SQL Editor ve service-role erişimi kullanılmadı.

Sonuç olarak tabloların REST API'de erişilebilirliği ve bir relation sorgusunun kabulü kontrol edilebildi; gerçek PostgreSQL kolon tipleri, nullability, PK/FK/unique constraint tanımları, RLS enable durumu ve policy tanımları anon API ile doğrulanamadı. Aşağıda koddan çıkarılanlar ile canlı DB'de doğrulananlar özellikle ayrılmıştır.

## A) profiles

**Canlı kontrol:** `public.profiles` için `select('*').limit(0)` HTTP 200 verdi, sıfır satır döndü. Bu istek anon bağlamında tabloya SELECT sorgusunun kabul edildiğini gösterir; görünür kayıt olduğunu veya RLS'in açık/kapalı olduğunu göstermez.

**Kaynak koddan görülen kolon/ilişki kullanımı:**

- Kayıt sırasında `profiles.id` alanına `data.user.id` yazılıyor.
- `AuthContext` profilini `.eq('id', userId)` ile okuyor.
- Profil düzenleme kodu `first_name`, `last_name`, `phone` alanlarını güncelliyor ve `.eq('id', user?.id)` kullanıyor.
- Profil gösteriminde `email` ve `created_at` da okunuyor.

Bu kullanım `profiles.id` değerinin Supabase Auth user ID'siyle aynı olmasını bekliyor. Gerçek tipin UUID olup olmadığı, `auth.users(id)` foreign key'i bulunup bulunmadığı, ek bir `user_id` kolonu, PK/unique/nullability tanımları veritabanı metadata'sından doğrulanamadı. Kodda `profiles.user_id` kullanımı görünmüyor.

Kullanıcının kendi profilini okuyup güncelleyebilmesi kodun amaçladığı davranış; bunun RLS ile gerçekten izinli olduğu policy'ler görülmeden doğrulanamaz.

## B) wishlist

**Canlı kontrol:** `public.wishlist` için `select('*').limit(0)` HTTP 200 verdi, sıfır satır döndü. Bu, mevcut anon bağlamında SELECT sorgusunun kabul edildiğini gösterir; RLS durumu/policy'leri açıklamaz.

**Kaynak koddan görülen kolon/ilişki kullanımı:**

- `user_id`: oturumdaki `user.id` ile filtreleniyor ve yeni kayıtta yazılıyor.
- `product_id`: string ürün ID'si ile filtreleniyor, ekleniyor ve okunuyor.
- Favori ekranı `product_id` alanını çekiyor; `ProductCard` ve `ProductDetail` aynı kullanıcı/ürün çiftine göre favori sorguluyor.

Gerçek kolon tipleri, foreign key'ler, `(user_id, product_id)` unique constraint'i, nullable/PK tanımları ve RLS politikaları doğrulanamadı. Uygulama kendi sorgularına `user_id` filtresi ekliyor; istemci filtreleri tek başına güvenlik sınırı değildir. Kullanıcının yalnız kendi kayıtlarını görebildiğini/değiştirebildiğini RLS olmadan söyleyemeyiz.

Uygulama `SELECT`, `INSERT`, `DELETE` işlemleri yapıyor. Bunların RLS ile uyumu oturum JWT'siyle policy denetimi gerektirir; anon `limit(0)` sorgusu bu sahiplik davranışını sınamaz.

## C) orders

**Canlı kontrol:** `public.orders` için `select('*').limit(0)` HTTP 200 verdi. `orders` üzerinden `order_items(*)` nested sorgusu da HTTP 200 verdi. PostgREST relation çözümlemesi başarılı oldu; bu çoğunlukla FK ilişkisinden gelir, fakat constraint metadata'sı olmadan FK'nin kendisi olduğu kesinleştirilemez.

**Kaynak koddan görülen kolon/ilişki kullanımı:**

- Sipariş oluştururken `user_id`, hesaplı alışverişte istemciden gelen `customer.userId`; guest alışverişte `null` olarak atanıyor.
- Kod ayrıca `customer_name`, `customer_email`, `customer_phone`, `shipping_address_full`, `shipping_city`, `shipping_district`, `shipping_postal_code`, `total_amount` ve `status` gönderiyor.
- Callback kodu `id` ile siparişi bulup `status` değerini güncelliyor.
- `OrderHistory`, `user_id = user.id` filtresi ve `created_at` sıralamasıyla siparişleri okuyor.

`user_id`'nin Auth ID'sine FK'si, `id` PK'si, kolon tipleri/nullability ve constraints doğrulanamadı. Kaynak kodda admin rolü/guard kontrolü yok. DB tarafında admin policy olup olmadığı da metadata erişimi olmadan bilinmiyor.

## D) order_items

**Canlı kontrol:** `public.order_items` için `select('*').limit(0)` HTTP 200 verdi. `orders` ile nested `order_items(*)` relation isteği HTTP 200 verdi.

**Kaynak koddan görülen kolon kullanımı:**

- `order_id`: oluşturulan `orders.id` değeriyle dolduruluyor.
- `product_id`: sepet satırındaki `item.id` ile dolduruluyor.
- `quantity`: `item.quantity` değerinden geliyor.
- `price_at_purchase`: sepet satırındaki `item.price` değerinden türetiliyor.

Gerçek `order_id`/`product_id` tipleri, `order_id`'nin `orders` tablosuna FK'si, `product_id` FK'si, fiyat/miktar tipleri, PK/unique/nullability ve policy listesi DB metadata'sına erişilemediği için doğrulanamadı. Kodun kullandığı kolon isimleri yukarıdaki gibidir; bunların canlı şemada gerçekten var olduğu yalnızca `select('*')` sorgusundan çıkarılamaz.

`order_items_access_policy` adlı policy'nin varlığı veya başka policy'lerle birlikte bulunup bulunmadığı doğrulanamadı.

## E) Tüm mevcut RLS policies

Canlı policy listesi elde edilemedi. `pg_policies` sorgusu anon REST API'de `PGRST205` ile sonuçlandı; OpenAPI kök endpoint'i de 401 veriyor. Supabase Dashboard/SQL Editor veya güvenli read-only database metadata erişimi kullanılmadı. Bu nedenle policy adı, command, `USING`, `WITH CHECK`, RLS enable durumu ya da tablolar arası policy farkları hakkında tahmin yapılmıyor.

Özellikle `order_items_access_policy` dışındaki policy'lerin olup olmadığı bilinmiyor. Eğer belirli bir role uygulanmış `FOR ALL` policy'sinde gerçekten `USING (true)` ve `WITH CHECK (true)` varsa:

- `USING (true)`, policy'nin uygulandığı role/command kapsamındaki mevcut satırları filtrelemeden uygun sayar. `ALL` kapsamında SELECT satırlarının görünmesine, UPDATE/DELETE hedefi seçilmesine izin verebilir.
- `WITH CHECK (true)`, INSERT ile oluşturulan veya UPDATE ile yeni hale gelen satırları koşulsuz kabul eder.
- `ALL` policy'si ve rol kapsamı uygunsa bu kombinasyon o role geniş okuma/yazma erişimi sağlayabilir. Birden fazla permissive policy aynı komut/rol için OR mantığıyla birleşebildiğinden, başka bir dar policy tek başına geniş policy'yi etkisizleştirmez.

Bu açıklama koşulludur; mevcut policy'nin gerçekten böyle olduğu veya hangi role uygulandığı doğrulanmadı.

## F) Uygulama kodu ile veritabanı uyumluluğu

- **Checkout:** `src/app/api/payment/create/route.ts` istemci gövdesinden `items`, `customer`, `totalAmount`, `checkoutMode` alıp `orders` tablosuna insert yapıyor. `user_id` hesap modunda istemci payload'ındaki `customer.userId` değerinden geliyor; fiyat sunucuda katalogdan yeniden hesaplanmıyor.
- **Sipariş satırları:** Sipariş insert'inden sonra her sepet elemanı `order_items` içine `order_id`, `product_id: item.id`, `quantity`, `price_at_purchase` olarak ayrı sorguyla yazılıyor.
- **OrderHistory:** `src/app/profile/components/OrderHistory.tsx`, `orders` tablosundan `*, order_items(*)` seçiyor; `user_id` filtresi koyuyor ve `created_at` azalan sıralıyor. İlişkili sorgunun `limit(0)` biçimi HTTP 200 kabul edildi.
- **Wishlist:** `WishlistGrid`, `ProductCard` ve `ProductDetail` `wishlist` tablosunda `user_id` ve `product_id` kullanıyor. Kod `user.id` ile kendi kayıtlarını filtrelemeye çalışıyor.
- **Ürün ID'leri:** `src/data/products.ts` içindeki dört ID string: `mavi-ceket-01`, `kirmizi-saten-01`, `bordo-ceket-01`, `bordo-detail-01`. Wishlist `product_id` ve order item `product_id` alanlarına uygulama düzeyinde string gönderiliyor. DB kolon türü ve mevcut değerlerin bu ID'lerle eşleşmesi doğrulanamadı.
- Dört tabloya SELECT isteği HTTP 200 verdi; bu, kullanılan uygulama sorgularının tüm kolonlarının, insert/update işlemlerinin veya kullanıcı sahipliği kurallarının uyumlu olduğunu kanıtlamaz.

## G) order_items_access_policy güvenlik riski

Policy'nin canlı tanımı alınamadığı için mevcut risk derecesi kesin olarak belirlenemez. Eğer `USING (true)` + `WITH CHECK (true)` geniş bir `ALL` policy'si olarak `anon` veya `authenticated` rolüne verilmişse, sipariş kalemlerini okuma ve/yada değiştirme kapsamı çok geniş olabilir. Sadece `INSERT` policy'siyse `WITH CHECK (true)` kullanıcı kimliği/sipariş sahipliği kontrolü olmadan satır eklemeye izin verebilir. Gerçek `command`, `TO` role ve diğer policy'ler bilinmeden daha kesin yorum yapılamaz.

## H) Mevcut sistemi bozmadan önerilen RLS modeli

Bu bölüm öneridir; henüz uygulanmadı ve mevcut policy'lerin yerine geçtiği varsayılmamalıdır.

- `profiles`: `id = auth.uid()` koşuluyla kendi profiline SELECT/UPDATE; UPDATE için `USING` ve `WITH CHECK` aynı sahiplik koşulunu uygulasın. Mevcut signup akışı kendi `id` değeriyle INSERT yaptığı için gerekli ise yalnız `id = auth.uid()` şartlı INSERT policy'si korunsun. Admin rolü profile alanlarından yükseltilemesin.
- `wishlist`: SELECT/INSERT/DELETE yalnız `user_id = auth.uid()` koşuluyla. INSERT için `WITH CHECK`; SELECT/DELETE için `USING`. Ürün ilişkisi uygun ürün tablosuna bağlansın; favori çifti için unique constraint ancak mevcut duplicate kayıtlar kontrol edildikten sonra değerlendirilsin.
- `orders`: kullanıcı SELECT'i `user_id = auth.uid()` ile sınırlansın. Guest siparişleri public SELECT'e açılmasın; sipariş oluşturma güvenilir sunucu akışında doğrulansın. Kullanıcı ödeme `status` alanını doğrudan güncelleyemesin. Admin erişimi ayrı, DB tarafından doğrulanan admin rol fonksiyonuna dayansın.
- `order_items`: SELECT yalnız ilişkili `orders` kaydının sahibi olan kullanıcıya (`EXISTS` ile order sahipliği) veya doğrulanmış admin'e. INSERT güvenilir server-side sipariş oluşturma akışına ayrılmalı. Kullanıcıya genel UPDATE/DELETE verilmemeli.
- RLS policy değişikliği öncesinde mevcut tanımlar ve rol hedefleri Dashboard/SQL ile okunmalı; sonraki adımda eklemeli migration, mevcut politika ve uygulama davranışını koruyarak hazırlanmalı. Geniş policy'nin kaldırılması ayrı, etkisi gözden geçirilmiş bir değişiklik olmalı.

## I) Admin paneline geçmeden önce yapılması gerekenler

1. Supabase Dashboard SQL Editor'dan `information_schema.columns`, `pg_constraint`, `pg_class`/`pg_namespace`, `pg_policies` ve tablo bazında `relrowsecurity` metadata'sını yalnız SELECT sorgularıyla çıkarın.
2. Mevcut policy'lerin tamamında tablo, policy adı, command, role, `USING`, `WITH CHECK` alanlarını kaydedin; özellikle `order_items_access_policy` tanımını ve `TO` rolünü doğrulayın.
3. `profiles.id` ↔ `auth.users.id`, `wishlist.user_id/product_id`, `orders.user_id`, `order_items.order_id/product_id` tip ve FK ilişkilerini doğrulayın.
4. Mevcut kayıtları değiştirmeden, ürün ID'leriyle wishlist/order item `product_id` değerlerinin eşleşmesini read-only raporlayın. Ürünler henüz veritabanında olmadığı için ürün FK/ID geçişini bu inceleme tamamlanmadan tasarlamayın.
5. Ödeme API'si istemciden gelen tutar ve user ID'ye güveniyor; admin sipariş yönetiminden önce ödeme ve sipariş oluşturma güven zinciri ayrıca tasarlanmalı.
6. Canlı metadata doğrulanıp mevcut davranış belgelenmeden admin tabloları, RLS değişiklikleri veya ürün migrasyonu uygulanmamalı.

**Güvenlik özeti:** Bu incelemede hiçbir INSERT, UPDATE, DELETE, migration, tablo değişikliği veya RLS değişikliği yapılmadı. Supabase Auth kullanıcıları, profiller, favoriler ve sipariş satırları okunmadı/değiştirilmedi.
