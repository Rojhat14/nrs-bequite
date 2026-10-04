import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProductListing from '@/components/ProductListing'
import CategoryHero from '@/components/CategoryHero'
import { getCategoryCatalog, getStorefrontProducts } from '@/lib/products'
import { getCategoryEditorialImage } from '@/lib/editorialImages'

interface CategoryPageProps {
  params: Promise<{ slug: string }>
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
  const catalog = await getCategoryCatalog(slug)
  if (!catalog.category && ['sale', 'indirim'].includes(slug.toLowerCase())) {
    const products = await getStorefrontProducts()
    return {
      category: { id: '', name: 'İndirim', slug: 'sale', description: null, sort_order: 0 },
      products: products.filter(product => product.compareAtPrice != null && product.priceAmount != null && product.compareAtPrice > product.priceAmount),
    }
  }
  return catalog
}

export async function generateMetadata({ params: paramsPromise }: CategoryPageProps): Promise<Metadata> {
  const params = await paramsPromise
  const { category } = await getPageData(params.slug)
  if (!category) return { title: 'Kategori bulunamadı | NRS' }
  return {
    title: `NRS | ${category.name}`,
    // Keep aliases self-referencing; category consolidation is a separate phase.
    alternates: { canonical: `/category/${encodeURIComponent(params.slug)}` },
    description: category.description || `${category.name} kategorisindeki NRS tasarımlarını keşfedin.`,
  }
}

export default async function CategoryPage({ params: paramsPromise }: CategoryPageProps) {
  const params = await paramsPromise
  const { category, products } = await getPageData(params.slug)
  if (!category) notFound()
  const banner = categoryBanners[params.slug.toLowerCase()] ?? categoryBanners[category.slug] ?? {
    title: category.name.toLocaleUpperCase('tr-TR'),
    description: category.description || 'Seçkin gözler için küratörlüğünü yaptığımız özel parçalar.',
  }
  const image = getCategoryEditorialImage(params.slug) ?? getCategoryEditorialImage(category.slug)

  return (
    <div className="min-h-screen bg-nrs-canvas text-nrs-ink">
      <CategoryHero title={banner.title} description={banner.description} image={image} />

      <section className="max-w-7xl mx-auto px-6 py-24">
        <ProductListing products={products} title={category.name} />
      </section>
    </div>
  )
}
