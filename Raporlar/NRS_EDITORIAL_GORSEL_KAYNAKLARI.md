# NRS kategori ve koleksiyon görselleri

Tarih: 3 Ekim 2026

Eksik 12 alan için 12 farklı Pexels fotoğrafı yerel JPEG dosyası olarak eklendi. Fotoğraflar kategori/koleksiyon temalarını temsil eder; mağazanın satıştaki ürün kayıtları olarak eklenmedi. Uygulama kodu, responsive sınıflar, ürün verileri ve Supabase değiştirilmedi.

## Kaynaklar

Dosyalar 1600 px genişlikte, doğal oranları korunarak Pexels görsel sunucusundan indirildi. Uygulama bu dosyaları kendi public klasöründen sunar; çalışma anında Pexels bağlantısı kullanmaz. Kaynakların lisansı: [Pexels License](https://www.pexels.com/license/).

| Alan | Projedeki dosya | Fotoğrafçı ve kaynak |
| --- | --- | --- |
| Elbiseler | `public/images/editorial/categories/dresses.jpg` | [Busenur Demirkan](https://www.pexels.com/photo/elegant-woman-in-burgundy-gown-in-fashion-store-33182240/) |
| Üst Giyim | `public/images/editorial/categories/tops.jpg` | [Andrea Musto](https://www.pexels.com/photo/fashion-portrait-of-woman-in-white-blouse-29090983/) |
| Ceketler ve Blazerlar | `public/images/editorial/categories/blazers.jpg` | [Matheus Rodrigues](https://www.pexels.com/photo/woman-wearing-beige-blazer-in-studio-23531833/) |
| Alt Giyim | `public/images/editorial/categories/bottoms.jpg` | [sara kazemi](https://www.pexels.com/photo/fashionable-woman-posing-in-stylish-beige-outfit-31400265/) |
| Takımlar | `public/images/editorial/categories/suits.jpg` | [pedro furtado](https://www.pexels.com/photo/elegant-woman-in-stylish-beige-suit-posing-31450890/) |
| Yeni Gelenler | `public/images/editorial/collections/new-arrivals.jpg` | [Alina Komarevska](https://www.pexels.com/photo/clothes-hanging-on-hangers-18144397/) |
| Gündüz | `public/images/editorial/collections/daytime.jpg` | [Elina Volkova](https://www.pexels.com/photo/woman-in-a-white-blouse-and-pants-posing-in-the-city-16373388/) |
| Gece | `public/images/editorial/collections/evening.jpg` | [Lazy Genius](https://www.pexels.com/photo/elegant-woman-posing-in-black-evening-dress-33782081/) |
| Davet | `public/images/editorial/collections/occasion.jpg` | [Anthony morales](https://www.pexels.com/photo/elegant-woman-in-evening-gown-with-pearls-35436051/) |
| İmza | `public/images/editorial/collections/signature.jpg` | [Hannah Bickmore](https://www.pexels.com/photo/woman-wearing-beige-suit-on-white-background-9514679/) |
| Seçkiler | `public/images/editorial/collections/curated.jpg` | [RDNE Stock project](https://www.pexels.com/photo/close-up-shot-of-a-person-arranging-clothes-8580761/) |
| İndirim | `public/images/editorial/collections/sale.jpg` | [Ron Lach](https://www.pexels.com/photo/clothes-hanged-on-clothes-hanger-inside-a-boutique-8306370/) |

## Seçim ve uygulama

- Kategoriler: bordo elbise, beyaz bluz, bej blazer, pantolon ve uyumlu takım.
- Koleksiyonlar: yeni sezon askılığı, şehirde gündüz stili, gece elbisesi, davet elbisesi, zamansız blazer kombini, giysi seçimi ve butik askılığı.
- Mevcut `src/lib/editorialImages.ts` eşleşmeleri aynı dosya adlarını zaten bekliyor. `next.config.mjs` başlangıç/derleme sırasında dosyaları otomatik algılar.
- Kaynak fotoğraflar kırpılmadan kaydedildi. Mevcut kategori banner/koleksiyon kartlarının CSS kadrajı korunur; ürün detay galerisinin object-contain davranışı değişmez.
- Yeni dependency eklenmedi.

## Üretim denemesi

Yerleşik image_gen aracıyla elbise görseli üretimi denendi; `usage_limit_reached` yanıtı nedeniyle dosya oluşmadı. CLI/API moduna geçilmedi. Teslim edilen 12 görselin tamamı yukarıdaki stok fotoğraflardır; AI üretimi değildir.

Deneme promptu: “Use case: photorealistic-natural. Asset type: luxury women's boutique category banner, dresses. Create a refined full-color fashion editorial photograph: one adult woman wearing a flowing burgundy long-sleeved maxi dress, standing naturally in a warm limestone courtyard with soft archways. Realistic fabric drape, sophisticated understated styling, natural skin texture. Landscape 3:2 composition with the woman centered, full dress and feet in frame, generous architecture around her; central composition must remain meaningful when cropped vertically on mobile. Soft afternoon light, premium magazine photography, restrained warm ivory and burgundy palette. No text, logos, watermark, borders or collage. This is an editorial category illustration, not a specific catalog product.”

## Kontroller

- 12/12 JPEG dosyası çözümlendi; bozuk dosya yok. Toplam boyut: yaklaşık 3,11 MiB.
- Next yapılandırmasının algıladığı görsel sayısı: 12/12.
- Fotoğraflar ve mevcut yatay/dikey alanların kadraj önizlemeleri incelendi. Tarayıcıda cihaz etkileşim testi yapılmadı; responsive CSS değiştirilmedi.
- Yerel production sunucusunda 12/12 dosya HTTP 200 ve image/jpeg döndürüyor.
- /curated HTTP 200; 3/3 fotoğraf HTML çıktısında mevcut, eksik görsel placeholder'ı yok.
- Next.js /_next/image üzerinden 640 px optimizasyon isteği HTTP 200 döndürüyor.
- npm run build: başarılı; TypeScript ve build içindeki lint kontrolü geçti.
- git diff --check: başarılı.

Önceden açık kalan geliştirme sunucusu yeniden başlatılmalıdır; görsel listesi sunucu başlangıcında belirlenir.
