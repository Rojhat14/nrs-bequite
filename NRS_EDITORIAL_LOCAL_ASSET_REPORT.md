# NRS Editorial Local Asset Hazırlığı — Uygulama Raporu

## Değişen dosyalar

- `src/app/category/[slug]/page.tsx`
- `src/components/CategoryMood.tsx`
- `src/components/CollectionListing.tsx`
- `src/app/curated/page.tsx`
- `src/components/CategoryHero.tsx`
- `src/components/EditorialImage.tsx` — local editorial görsellerini kontrollü gösteren bileşen
- `src/lib/editorialImages.ts` — kategori/collection path haritası
- `public/images/editorial/categories/.gitkeep`
- `public/images/editorial/collections/.gitkeep`

İlk hazırlıkta iki klasör oluşturuldu. 3 Ekim 2026 güncellemesinde beklenen 12 JPEG dosyası eklendi. Fotoğraf kaynakları ve uygulama ayrıntıları [görsel kaynak raporunda](Raporlar/NRS_EDITORIAL_GORSEL_KAYNAKLARI.md) bulunur.

## Kategori path eşleşmeleri

| Kategori | Local asset |
| --- | --- |
| Elbiseler (`elbiseler`, eski alias `dresses`) | `/images/editorial/categories/dresses.jpg` |
| Üst Giyim (`ust-giyim`, eski alias `tops`) | `/images/editorial/categories/tops.jpg` |
| Ceketler & Blazerlar (`ceketler-blazerlar`, eski alias `blazers`) | `/images/editorial/categories/blazers.jpg` |
| Alt Giyim (`alt-giyim`, eski alias `bottoms`) | `/images/editorial/categories/bottoms.jpg` |
| Takımlar (`takimlar`, eski alias `suits`) | `/images/editorial/categories/suits.jpg` |
| İndirim (`indirim`, eski alias `sale`) | `/images/editorial/collections/sale.jpg` |

Eski category route alias’ları korunmuştur. Bilinmeyen kategoriler artık başka kategori görseline düşmez.

## Collection path eşleşmeleri

| Collection | Local asset |
| --- | --- |
| Yeni Gelenler (`yeni-gelenler`) | `/images/editorial/collections/new-arrivals.jpg` |
| Gündüz (`gunduz`) | `/images/editorial/collections/daytime.jpg` |
| Gece (`gece`) | `/images/editorial/collections/evening.jpg` |
| Davet (`davet`) | `/images/editorial/collections/occasion.jpg` |
| İmza (`imza`) | `/images/editorial/collections/signature.jpg` |
| Seçkiler (`seckiler`) | `/images/editorial/collections/curated.jpg` |
| İndirim (`indirim`) | `/images/editorial/collections/sale.jpg` |

Ana sayfadaki Gündüz/Gece/Davet/İmza kartları aynı collection map’ini kullanır. `/curated` editorial kartları sırasıyla `signature.jpg`, `occasion.jpg` ve `daytime.jpg` kullanır.

## Eksik dosya davranışı

Görsel path’i henüz dosyaya karşılık gelmiyorsa `EditorialImage` ve `CategoryHero` görsel yükleme hatasını yakalayıp sade nötr arka plan gösterir. Yeni fotoğraf/uzak URL fallback’i yoktur. Mevcut aspect ratio, `object-cover`, crop, grayscale/hover efektleri ve responsive sınıflar korunmuştur.

## Unsplash referansları

Kategori banner URL’leri `src/app/category/[slug]/page.tsx` içinden; ana sayfa mood kartı URL’leri `src/components/CategoryMood.tsx` içinden; collection kartı URL’leri `src/components/CollectionListing.tsx` içinden; `/curated` editorial kart URL’leri `src/app/curated/page.tsx` içinden kaldırıldı. `CategoryHero` URL tanımlamıyor, kendisine verilen image path’ini çiziyor ve eksik görsel durumunu yönetiyor.

Kategori/collection görsel fallback’leri olarak kullanılan aynı Unsplash fotoğrafları kaldırıldı. Dosyalar eklendiğinde `blazers` ve `bottoms`, `suits` ve `occasion`, `dresses` ve `daytime`, `new-arrivals` ve `signature`, `evening` ve `curated` ayrı local path’lerden yüklenir.

## Ürün görselleri

Ürün görsel verilerine, ürün kartlarına, ürün detay galerisine veya Supabase Storage sistemine dokunulmadı.

## Kontroller

- TypeScript (`npx tsc --noEmit --incremental false`): **PASS**
- Build (`npm run build`): **PASS**
- Görsel dosyaları: **12/12 yerel JPEG eklendi; mevcut path eşleşmeleri kullanılıyor.**
