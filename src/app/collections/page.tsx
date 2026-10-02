import type { Metadata } from 'next'
import CollectionListing from '@/components/CollectionListing'
import { getStorefrontCollections } from '@/lib/products'

export const metadata: Metadata = {
  title: 'NRS | Koleksiyonlar',
  description: 'NRS koleksiyonlarını ve seçkin tasarımlarını keşfedin.',
}

export default async function CollectionsPage() {
  const collections = await getStorefrontCollections()
  return (
    <div className="min-h-screen bg-nrs-ivory text-nrs-black layout-content">
      <section className="pb-24 px-6">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-serif tracking-tight">KOLEKSİYONLAR</h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto" />
            <p className="text-nrs-black/60 font-sans italic text-sm max-w-xl mx-auto">Zamanın ötesinde siluetler, rafine detaylar ve modern kadının ruhunu yansıtan özel seçkiler.</p>
          </div>
          <CollectionListing collections={collections} />
        </div>
      </section>
    </div>
  )
}
