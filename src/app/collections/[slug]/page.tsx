import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProductCard } from '@/components/ProductCard'
import { getCollectionCatalog } from '@/lib/products'

interface CollectionPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params: paramsPromise }: CollectionPageProps): Promise<Metadata> {
  const params = await paramsPromise
  const { collection } = await getCollectionCatalog(params.slug)
  if (!collection) return { title: 'Koleksiyon bulunamadı | NRS' }
  return {
    title: `NRS | ${collection.name}`,
    alternates: { canonical: `/collections/${encodeURIComponent(collection.slug)}` },
    description: collection.description || `${collection.name} koleksiyonundaki NRS tasarımlarını keşfedin.`,
  }
}

export default async function CollectionDetailPage({ params: paramsPromise }: CollectionPageProps) {
  const params = await paramsPromise
  const { collection, products } = await getCollectionCatalog(params.slug)
  if (!collection) notFound()
  return <div className="min-h-screen bg-nrs-canvas text-nrs-ink">
    <section className="mx-auto max-w-7xl px-6 pb-24 pt-[calc(var(--nrs-header-height)+2rem)]">
      <div className="mb-16 text-center">
        <p className="mb-4 text-[10px] uppercase tracking-[0.28em] text-nrs-ink/60">NRS KOLEKSİYONU</p>
        <h1 className="font-serif text-4xl tracking-tight md:text-6xl">{collection.name}</h1>
        {collection.description && <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-nrs-ink/55">{collection.description}</p>}
      </div>
      {products.length > 0 ? <div className="grid grid-cols-2 gap-x-3 sm:gap-x-8 gap-y-16 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div> : <div className="py-24 text-center"><p className="font-serif text-xl italic text-nrs-ink/60">Bu seçkide henüz ürün bulunmuyor.</p></div>}
    </section>
  </div>
}
