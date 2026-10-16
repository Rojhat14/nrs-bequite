import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductCard } from '@/components/ProductCard'
import { getCollectionCatalog } from '@/lib/products'
import { getCollectionPresentation } from '@/lib/collectionPresentation'
import { headers } from 'next/headers'
import { isLocale, languageAlternates, type Locale } from '@/lib/i18n/messages'
import { marketing } from '@/lib/i18n/marketing'
import { getRequestLocale } from '@/lib/i18n/request-locale'

interface CollectionPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params: paramsPromise }: CollectionPageProps): Promise<Metadata> {
  const params = await paramsPromise
  const requestHeaders = await headers()
  const currentLocale = requestHeaders.get('x-nrs-locale')
  const locale: Locale = isLocale(currentLocale) ? currentLocale : 'tr'
  const { collection } = await getCollectionCatalog(params.slug)
  if (!collection) return { title: marketing(locale, 'collectionNotFound') }
  const presentation = getCollectionPresentation(collection)
  return {
    title: `NRS | ${presentation.name}`,
    alternates: { canonical: `${locale === 'tr' ? '' : `/${locale}`}/collections/${encodeURIComponent(collection.slug)}`, languages: languageAlternates(`/collections/${encodeURIComponent(collection.slug)}`) },
    description: presentation.description || `${presentation.name} koleksiyonundaki NRS tasarımlarını keşfedin.`,
  }
}

export default async function CollectionDetailPage({ params: paramsPromise }: CollectionPageProps) {
  const params = await paramsPromise
  const locale = await getRequestLocale()
  const t = (key: Parameters<typeof marketing>[1]) => marketing(locale, key)
  const { collection, products } = await getCollectionCatalog(params.slug)
  if (!collection) notFound()
  const presentation = getCollectionPresentation(collection)
  return <div className="min-h-screen bg-nrs-canvas text-nrs-ink">
    <section className="mx-auto max-w-7xl px-6 pb-24 pt-[calc(var(--nrs-header-height)+2rem)]">
      <div className="mb-16 text-center">
        <p className="mb-4 text-[10px] uppercase tracking-[0.28em] text-nrs-ink/60">{t('collectionDetailHeading')}</p>
        <h1 className="font-serif text-4xl tracking-tight md:text-6xl">{presentation.name}</h1>
        {presentation.description && <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-nrs-ink/55">{presentation.description}</p>}
      </div>
      {products.length > 0 ? <div className="grid grid-cols-2 gap-x-3 sm:gap-x-8 gap-y-16 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div> : <div className="py-24 text-center"><p className="font-serif text-xl italic text-nrs-ink/60">{t('collectionDetailEmpty')}</p></div>}
    </section>
  </div>
}
