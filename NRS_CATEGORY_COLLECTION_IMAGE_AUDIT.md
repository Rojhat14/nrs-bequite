# NRS Kategori ve Koleksiyon Tanıtım Görselleri — Salt Okunur Denetim

**Kontrol tarihi:** 28 Eylül 2026  
**Kapsam:** Yalnızca kategori/koleksiyon tanıtım alanları. Ürün kartı, ürün galerisi ve ürün görselleri incelenmedi. Hiçbir kod veya görsel değiştirilmedi/silinmedi.

HTTP durumları, kodda bulunan tam Unsplash URL’lerine yapılan salt okunur `HEAD` istekleriyle kontrol edildi. `200 image/jpeg` görsel yanıtı; `404 text/html` ise kırık URL olarak değerlendirildi.

| Alan | Başlık | Görsel durumu | Mevcut kaynak | Eksik mi? |
| ---- | ------ | ------------- | ------------- | --------- |
| Kategori sayfası `/category/elbiseler` | ELBİSELER | Yükleniyor — HTTP 200, JPEG | [Unsplash `photo-1490481651871-ab68de25d43d`](https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop) | Hayır; alias `dresses` aynı görseli kullanıyor |
| Kategori sayfası `/category/ust-giyim` | ÜST GİYİM | Kırık — HTTP 404, HTML yanıtı | [Unsplash `photo-1434389677669-578e6292797a`](https://images.unsplash.com/photo-1434389677669-578e6292797a?q=80&w=2070&auto=format&fit=crop) | **Evet**; alias `tops` de aynı kırık URL’yi kullanıyor |
| Kategori sayfası `/category/ceketler-blazerlar` | KADIN CEKET & BLAZER | Yükleniyor — HTTP 200, JPEG | [Unsplash `photo-1509631179647-0177331693ae`](https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=2070&auto=format&fit=crop) | Hayır; aynı görsel ALT GİYİM’de de kullanılıyor |
| Kategori sayfası `/category/alt-giyim` | ALT GİYİM | Yükleniyor — HTTP 200, JPEG | [Unsplash `photo-1509631179647-0177331693ae`](https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=2070&auto=format&fit=crop) | Hayır; **CEKET & BLAZER ile yanlış/şüpheli tekrar** |
| Kategori sayfası `/category/takimlar` | TAKIMLAR | Yükleniyor — HTTP 200, JPEG | [Unsplash `photo-1441986300917-64674bd600d8`](https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop) | Hayır; genel görsel başka alanlarda da tekrar ediyor |
| Koleksiyon liste kartı `/collections` | YENİ GELENLER | Kırık — HTTP 404, HTML yanıtı | [Unsplash `photo-1485231183945-fffde7e1ca17`](https://images.unsplash.com/photo-1485231183945-fffde7e1ca17?q=80&w=2070&auto=format&fit=crop) | **Evet** |
| Ana sayfa mood kartı | GÜNDÜZ | Kırık — HTTP 404, HTML yanıtı | [Unsplash `photo-1485231183945-fffde7e1ca17`](https://images.unsplash.com/photo-1485231183945-fffde7e1ca17?q=80&w=2070&auto=format&fit=crop) | **Evet**; YENİ GELENLER ile aynı kırık URL |
| Koleksiyon liste kartı `/collections` | GÜNDÜZ | Yükleniyor — HTTP 200, JPEG | [Unsplash `photo-1490481651871-ab68de25d43d`](https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop) | Hayır; elbise ve indirim alanlarında da kullanılıyor |
| Ana sayfa mood kartı | GECE | Yükleniyor — HTTP 200, JPEG | [Unsplash `photo-1515378791036-0648a3ef77b2`](https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?q=80&w=2070&auto=format&fit=crop) | Hayır |
| Koleksiyon liste kartı `/collections` | GECE | Kırık — HTTP 404, HTML yanıtı | [Unsplash `photo-1539008835757-a65767669e6b`](https://images.unsplash.com/photo-1539008835757-a65767669e6b?q=80&w=2070&auto=format&fit=crop) | **Evet**; `/curated` içindeki Gece Işıltısı da aynı kırık URL’yi kullanıyor |
| Ana sayfa mood kartı | DAVET | Kırık — HTTP 404, HTML yanıtı | [Unsplash `photo-1566174053895-827e65767724`](https://images.unsplash.com/photo-1566174053895-827e65767724?q=80&w=2070&auto=format&fit=crop) | **Evet** |
| Koleksiyon liste kartı `/collections` | DAVET | Yükleniyor — HTTP 200, JPEG | [Unsplash `photo-1441986300917-64674bd600d8`](https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop) | Hayır; takımlar ve genel fallback ile aynı görsel |
| Ana sayfa mood kartı | İMZA | Yükleniyor — HTTP 200, JPEG | [Unsplash `photo-1445205170230-053b83016050`](https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=2071&auto=format&fit=crop) | Hayır |
| Koleksiyon liste kartı `/collections` | İMZA | Kırık — HTTP 404, HTML yanıtı | [Unsplash `photo-1485231183945-fffde7e1ca17`](https://images.unsplash.com/photo-1485231183945-fffde7e1ca17?q=80&w=2070&auto=format&fit=crop) | **Evet**; YENİ GELENLER/GÜNDÜZ mood ile aynı kırık URL |
| Koleksiyon liste kartı `/collections` | SEÇKİLER | Yükleniyor — HTTP 200, JPEG | [Unsplash `photo-1441986300917-64674bd600d8`](https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop) | Hayır; genel/takım/davet görseliyle aynı |
| `/curated` editorial kartı | SEÇKİLER — Minimalist Lüks | Kırık — HTTP 404, HTML yanıtı | [Unsplash `photo-1434389677669-7486e12638ce`](https://images.unsplash.com/photo-1434389677669-7486e12638ce?q=80&w=2070&auto=format&fit=crop) | **Evet** |
| `/curated` editorial kartı | SEÇKİLER — Gece Işıltısı | Kırık — HTTP 404, HTML yanıtı | [Unsplash `photo-1539008835757-a65767669e6b`](https://images.unsplash.com/photo-1539008835757-a65767669e6b?q=80&w=2070&auto=format&fit=crop) | **Evet**; koleksiyon GECE ile aynı kırık URL |
| `/curated` editorial kartı | SEÇKİLER — Modern Şehir | Kırık — HTTP 404, HTML yanıtı | [Unsplash `photo-1485231183945-fffde7e1ca17`](https://images.unsplash.com/photo-1485231183945-fffde7e1ca17?q=80&w=2070&auto=format&fit=crop) | **Evet**; yeni gelenler/İmza ile aynı kırık URL |
| Koleksiyon liste kartı `/collections` | İNDİRİM | Yükleniyor — HTTP 200, JPEG | [Unsplash `photo-1490481651871-ab68de25d43d`](https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop) | Hayır; ELBİSELER ve GÜNDÜZ ile aynı görsel |
| Kategori sayfası `/category/indirim` ve `/category/sale` | İNDİRİM | Yükleniyor — HTTP 200, JPEG | [Unsplash `photo-1441986300917-64674bd600d8`](https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop) | Hayır; TAKIMLAR, DAVET, SEÇKİLER ve fallback ile aynı görsel |

## Kaynak ve yükleme özeti

- Denetlenen tanıtım görsellerinin tamamı `https://images.unsplash.com/...` uzaktan geliyor. Kategori/koleksiyon tanıtımı için `public/` altında yerel görsel asset’i tanımlı değil.
- 10 benzersiz uzak URL kontrol edildi: **5’i HTTP 200 `image/jpeg`, 5’i HTTP 404 HTML** döndü.
- Kırık URL’ler: `photo-1434389677669-578e6292797a`, `photo-1485231183945-fffde7e1ca17`, `photo-1566174053895-827e65767724`, `photo-1539008835757-a65767669e6b`, `photo-1434389677669-7486e12638ce`.
- Yüklenenler de NRS’ye ait yerel kampanya varlıkları değil, genel Unsplash kaynakları. Kırık olmayan URL’nin görsel içeriğinin kategoriyle sanatsal olarak uyumlu olup olmadığı ayrıca görsel tasarım incelemesi gerektirir.
- `next.config.mjs` içinde `images.unsplash.com` remote host’u izinli. `CategoryHero` doğrudan `<motion.img>` kullanırken `CategoryMood`, `CollectionListing` ve `/curated` Next `Image` kullanıyor; kaynak 404 olduğunda iki render yolu da görseli yükleyemez.

## Tekrar kullanım ve fallback bulguları

- Ceket/Blazer ve Alt Giyim aynı fotoğrafı kullanıyor; bu en belirgin kategori bazlı tekrar.
- `photo-1441986300917-64674bd600d8` Takımlar, Davet, Seçkiler, İndirim ve bilinmeyen kategori fallback’inde tekrar kullanılıyor.
- `photo-1490481651871-ab68de25d43d` Elbiseler, koleksiyon Gündüz ve İndirim’de tekrar kullanılıyor.
- `photo-1485231183945-fffde7e1ca17` yeni gelenler, ana sayfa Gündüz, koleksiyon İmza ve `/curated` Modern Şehir’de kullanılıyor; URL şu anda kırık.
- `CollectionListing.tsx`, tanınmayan collection slug’larında `seckiler` görseline düşüyor. `category/[slug]/page.tsx` de eşleşmeyen kategoriler için genel `photo-144198...` URL’sine düşüyor.
- `CategoryMood.tsx` içindeki Gündüz/Gece/Davet/İmza kartları collection slug rotalarına değil, kategori veya `/collections` rotalarına bağlanıyor. Bu denetimde davranış değiştirilmedi.

## Görsellerin tanımlandığı dosyalar

1. `src/app/category/[slug]/page.tsx` — kategori başlıkları, banner URL’leri ve genel kategori fallback’i.
2. `src/components/CategoryMood.tsx` — ana sayfadaki Gündüz, Gece, Davet ve İmza tanıtım kartları.
3. `src/components/CollectionListing.tsx` — dinamik koleksiyon adlarını slug bazlı görsel haritasına bağlayan `collectionVisuals` ve bilinmeyen slug fallback’i.
4. `src/app/curated/page.tsx` — SÖZEL SEÇKİLER sayfasındaki üç editorial kart görseli.
5. `src/components/CategoryHero.tsx` — kategori banner URL’sini gösteren render bileşeni; URL burada tanımlı değil.
6. `next.config.mjs` — Unsplash remote image host izni.

Görsel düzeltmesi yapılacağı zaman kırık URL’ler önce `category/[slug]/page.tsx`, `CategoryMood.tsx`, `CollectionListing.tsx` ve `curated/page.tsx` içindeki tanımlardan değiştirilmeli. Bu incelemede hiçbir dosya değiştirilmemiştir.
