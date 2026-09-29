import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductCard } from '@/components/ProductCard'
import CategoryHero from '@/components/CategoryHero'
import Navigation from '@/components/Navigation'
import { getCategoryCatalog } from '@/lib/products'
import { getCategoryEditorialImage } from '@/lib/editorialImages'

interface CategoryPageProps {
  params: { slug: string }
}

const categoryBanners: Record<string, { title: string; description: string }> = {
  elbiseler: { title: 'KADIN ELBİSELERİ', description: 'Modern siluetleri, rafine detayları ve zamansız kadınsılığı bir araya getiren seçkin koleksiyon.' },
  dresses: { title: 'KADIN ELBİSELERİ', description: 'Modern siluetleri, rafine detayları ve zamansız kadınsılığı bir araya getiren seçkin koleksiyon.' },
  'ust-giyim': { title: 'KADIN ÜST GİYİM', description: 'Zarif bluzlardan akışkan saten tasarımlara kadar modern gardırobun tamamlayıcı parçaları.' },
  tops: { title: 'KADIN ÜST GİYİM', description: 'Zarif bluzlardan akışkan saten tasarımlara kadar modern gardırobun tamamlayıcı parçaları.' },
  'ceketler-blazerlar': { title: 'KADIN CEKET & BLAZER', description: 'Güçlü bir siluet, doğru kesimle başlar. Modern terzilik anlayışıyla tasarlanmış seçkin parçalar.' },
  blazers: { title: 'KADIN CEKET & BLAZER', description: 'Güçlü bir siluet, doğru kesimle başlar. Modern terzilik anlayışıyla tasarlanmış seçkin parçalar.' },
  'alt-giyim': { title: 'KADIN ALT GİYİM', description: 'Dengeli siluetler ve özenli kesimler. Modern terziliği rahatlık ve zarafetle birleştiren tasarımlar.' },
  bottoms: { title: 'KADIN ALT GİYİM', description: 'Dengeli siluetler ve özenli kesimler. Modern terziliği rahatlık ve zarafetle birleştiren tasarımlar.' },
  takimlar: { title: 'KADIN TAKIM KOLEKSİYONU', description: 'Bir bütün olarak tasarlanan siluetler. Dengeli bir görünüm sunan rafine takım seçkileri.' },
  suits: { title: 'KADIN TAKIM KOLEKSİYONU', description: 'Bir bütün olarak tasarlanan siluetler. Dengeli bir görünüm sunan rafine takım seçkileri.' },
  bedding: { title: 'BEDDING', description: 'NRS seçkisinden rafine tasarımlar.' },
  accessories: { title: 'AKSESUAR', description: 'NRS seçkisinden rafine tasarımlar.' },
  indirim: { title: 'İNDİRİM', description: 'NRS seçkisinden özel parçalar.' },
  sale: { title: 'İNDİRİM', description: 'NRS seçkisinden özel parçalar.' },
}

async function getPageData(slug: string) {
  return getCategoryCatalog(slug)
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await getPageData(params.slug)
  if (!category) return { title: 'Kategori bulunamadı | NRS' }
  return {
    title: `NRS | ${category.name}`,
    description: category.description || `${category.name} kategorisindeki NRS tasarımlarını keşfedin.`,
  }
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category, products } = await getPageData(params.slug)
  if (!category) notFound()
  const banner = categoryBanners[params.slug.toLowerCase()] ?? categoryBanners[category.slug] ?? {
    title: category.name.toLocaleUpperCase('tr-TR'),
    description: category.description || 'Seçkin gözler için küratörlüğünü yaptığımız özel parçalar.',
  }
  const image = getCategoryEditorialImage(params.slug) ?? getCategoryEditorialImage(category.slug)

  return (
    <div className="min-h-screen bg-nrs-ivory text-nrs-black">
      <Navigation />
      <CategoryHero title={banner.title} description={banner.description} image={image} />

      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="flex justify-between items-end mb-16">
          <div className="space-y-2">
            <h2 className="text-3xl font-serif tracking-tight">{category.name}</h2>
            <p className="text-nrs-black/40 font-light text-sm">{products.length} Parça Mevcut</p>
          </div>
          <div className="hidden md:block">
            <select aria-label="Ürünleri sırala" className="bg-transparent border-b border-nrs-black py-2 pr-8 focus:outline-none font-light text-xs uppercase tracking-widest">
              <option>Öne Çıkanlar</option><option>Fiyat: Artan</option><option>Fiyat: Azalan</option><option>Yeni Gelenler</option>
            </select>
          </div>
        </div>
        {products.length > 0 ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-16">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div> : <div className="text-center py-32"><p className="text-xl font-serif italic text-nrs-black/40">Bu seçkide henüz ürün bulunmuyor.</p></div>}
      </section>
    </div>
  )
}
