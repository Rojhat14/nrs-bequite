import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProductListing from '@/components/ProductListing'
import CategoryHero from '@/components/CategoryHero'
import { JUMPSUIT_CATEGORY_SLUG, getCategoryCatalog, getStorefrontProducts, isJumpsuitProduct } from '@/lib/products'
import { getCategoryEditorialImage } from '@/lib/editorialImages'
import { isHomeCategory } from '@/lib/home-category'
import { getHomeCategoryCover } from '@/lib/storage/category-covers'
import HomeEmbroideryRequest from '@/components/HomeEmbroideryRequest'
import { whatsappUrl } from '@/lib/storefront-config'
import { headers } from 'next/headers'
import { isLocale, languageAlternates, type Locale } from '@/lib/i18n/messages'
import WhatsAppIcon from '@/components/WhatsAppIcon'
import { getRequestLocale } from '@/lib/i18n/request-locale'

interface CategoryPageProps {
  params: Promise<{ slug: string }>
}

const categoryBanners: Record<string, { title: string; description: string }> = {
  'dis-giyim': { title: 'DIŞ GİYİM', description: 'Dış giyim kategorisindeki NRS tasarımlarını keşfedin.' },
  elbiseler: { title: 'KADIN ELBİSELERİ', description: 'Modern siluetleri, rafine detayları ve zamansız kadınsılığı bir araya getiren seçkin koleksiyon.' },
  dresses: { title: 'KADIN ELBİSELERİ', description: 'Modern siluetleri, rafine detayları ve zamansız kadınsılığı bir araya getiren seçkin koleksiyon.' },
  'ust-giyim': { title: 'KADIN ÜST GİYİM', description: 'Zarif bluzlardan akışkan saten tasarımlara kadar modern gardırobun tamamlayıcı parçaları.' },
  tops: { title: 'KADIN ÜST GİYİM', description: 'Zarif bluzlardan akışkan saten tasarımlara kadar modern gardırobun tamamlayıcı parçaları.' },
  'ceketler-blazerlar': { title: 'KADIN CEKET & BLAZER', description: 'Güçlü bir siluet, doğru kesimle başlar. Modern terzilik anlayışıyla tasarlanmış seçkin parçalar.' },
  blazers: { title: 'KADIN CEKET & BLAZER', description: 'Güçlü bir siluet, doğru kesimle başlar. Modern terzilik anlayışıyla tasarlanmış seçkin parçalar.' },
  'alt-giyim': { title: 'KADIN ALT GİYİM', description: 'Dengeli siluetler ve özenli kesimler. Modern terziliği rahatlık ve zarafetle birleştiren tasarımlar.' },
  bottoms: { title: 'KADIN ALT GİYİM', description: 'Dengeli siluetler ve özenli kesimler. Modern terziliği rahatlık ve zarafetle birleştiren tasarımlar.' },
  tulumlar: { title: 'KADIN TULUM MODELLERİ', description: 'Tek parçada tamamlanan görünüm. Davetten günlüğe, saten ve ipeksi dokularda tulumlar.' },
  takimlar: { title: 'KADIN TAKIM KOLEKSİYONU', description: 'Bir bütün olarak tasarlanan siluetler. Dengeli bir görünüm sunan rafine takım seçkileri.' },
  suits: { title: 'KADIN TAKIM KOLEKSİYONU', description: 'Bir bütün olarak tasarlanan siluetler. Dengeli bir görünüm sunan rafine takım seçkileri.' },
  bedding: { title: 'NRS HOME', description: 'Nevresim ve ev tekstili koleksiyonumuzu keşfedin.' },
  home: { title: 'NRS HOME', description: 'Nevresim ve ev tekstili koleksiyonumuzu keşfedin.' },
  nevresim: { title: 'NRS HOME', description: 'Nevresim ve ev tekstili koleksiyonumuzu keşfedin.' },
  accessories: { title: 'AKSESUAR', description: 'NRS seçkisinden rafine tasarımlar.' },
  indirim: { title: 'İNDİRİM', description: 'NRS seçkisinden özel parçalar.' },
  sale: { title: 'İNDİRİM', description: 'NRS seçkisinden özel parçalar.' },
}

async function getPageData(slug: string) {
  const catalog = await getCategoryCatalog(slug)
  if (!catalog.category && slug.toLowerCase() === JUMPSUIT_CATEGORY_SLUG) {
    const products = await getStorefrontProducts()
    return {
      category: { id: '', name: 'Tulumlar', slug: JUMPSUIT_CATEGORY_SLUG, description: null, sort_order: 0 },
      products: products.filter(isJumpsuitProduct),
    }
  }
  // Jumpsuits have their own category; keep them out of the dress and set lists.
  if (catalog.category && catalog.category.slug !== JUMPSUIT_CATEGORY_SLUG) return { ...catalog, products: catalog.products.filter(product => !isJumpsuitProduct(product)) }
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
  const requestHeaders = await headers()
  const currentLocale = requestHeaders.get('x-nrs-locale')
  const locale: Locale = isLocale(currentLocale) ? currentLocale : 'tr'
  const { category } = await getPageData(params.slug)
  if (!category) return { title: 'Kategori bulunamadı | NRS' }
  return {
    title: `NRS | ${category.name}`,
    // Keep aliases self-referencing; category consolidation is a separate phase.
    alternates: { canonical: `${locale === 'tr' ? '' : `/${locale}`}/category/${encodeURIComponent(params.slug)}`, languages: languageAlternates(`/category/${encodeURIComponent(params.slug)}`) },
    description: category.description || `${category.name} kategorisindeki NRS tasarımlarını keşfedin.`,
  }
}

export default async function CategoryPage({ params: paramsPromise }: CategoryPageProps) {
  const params = await paramsPromise
  const [{ category, products }, locale] = await Promise.all([getPageData(params.slug), getRequestLocale()])
  if (!category) notFound()
  const banner = categoryBanners[params.slug.toLowerCase()] ?? categoryBanners[category.slug] ?? {
    title: category.name.toLocaleUpperCase('tr-TR'),
    description: category.description || 'Seçkin gözler için küratörlüğünü yaptığımız özel parçalar.',
  }
  const image = isHomeCategory(category) ? await getHomeCategoryCover(category.id)
    : getCategoryEditorialImage(params.slug) ?? getCategoryEditorialImage(category.slug)

  return (
    <div className="min-h-screen bg-nrs-canvas text-nrs-ink">
      <CategoryHero title={locale === 'tr' ? banner.title : category.name.toLocaleUpperCase(locale === 'ar' ? 'ar' : 'en-US')} description={isHomeCategory(category)
        ? locale === 'en' ? 'Personalised embroidered bedding with your name, initials or a design you imagine. Let us create it with you.'
          : locale === 'ar' ? 'مفروشات مطرزة حسب الطلب باسمك أو بأحرفك الأولى أو بنقش تختارينه. دعينا نصممها لك.'
            : 'İsminiz, baş harfleriniz veya hayalinizdeki desenle kişiye özel nakışlı nevresimler. Sizin için tasarlayalım.'
        : locale === 'tr' ? (category.description || banner.description) : (category.description || banner.description)} image={image}>
        {isHomeCategory(category) && <>
          {whatsappUrl(locale === 'en' ? 'Hello, I would like information about personalised embroidered NRS HOME bedding.' : locale === 'ar' ? 'مرحباً، أود الاستفسار عن مفروشات NRS HOME المطرزة حسب الطلب.' : 'Merhaba, NRS HOME kişiye özel nakışlı nevresim için bilgi almak istiyorum.') && <a href={whatsappUrl(locale === 'en' ? 'Hello, I would like information about personalised embroidered NRS HOME bedding.' : locale === 'ar' ? 'مرحباً، أود الاستفسار عن مفروشات NRS HOME المطرزة حسب الطلب.' : 'Merhaba, NRS HOME kişiye özel nakışlı nevresim için bilgi almak istiyorum.')!}
            target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-3 bg-white px-6 py-3 text-sm text-nrs-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
            <WhatsAppIcon />{locale === 'en' ? 'Ask about custom embroidery' : locale === 'ar' ? 'استفسري عن التطريز حسب الطلب' : 'Kişiye Özel Nakış İçin İletişime Geç'}
          </a>}
          <a href="#nakis-talebi" className="inline-flex min-h-12 items-center border border-white/70 px-6 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">{locale === 'en' ? 'Add an embroidery request' : locale === 'ar' ? 'أضيفي طلب تطريز' : 'Nakış İsteğini Not Et'}</a>
        </>}
      </CategoryHero>
      {isHomeCategory(category) && <HomeEmbroideryRequest />}

      <section className="max-w-7xl mx-auto px-6 py-24">
        <ProductListing products={products} title={category.name} />
      </section>
    </div>
  )
}
