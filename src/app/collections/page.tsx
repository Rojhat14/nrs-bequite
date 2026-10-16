import type { Metadata } from 'next'
import CollectionListing from '@/components/CollectionListing'
import { getStorefrontCollections } from '@/lib/products'
import { getRequestLocale } from '@/lib/i18n/request-locale'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  const title = locale === 'en' ? 'NRS | Collections' : locale === 'ar' ? 'NRS | المجموعات' : 'NRS | Koleksiyonlar'
  const description = locale === 'en' ? 'Explore the NRS collections and curated designs.' : locale === 'ar' ? 'اكتشفي مجموعات NRS وتصاميمها المختارة.' : 'NRS koleksiyonlarını ve seçkin tasarımlarını keşfedin.'
  const prefix = locale === 'tr' ? '' : `/${locale}`
  return { title, description, alternates: { canonical: `${prefix}/collections`, languages: { tr: '/collections', en: '/en/collections', ar: '/ar/collections', 'x-default': '/collections' } } }
}

export default async function CollectionsPage() {
  const [collections, locale] = await Promise.all([getStorefrontCollections(), getRequestLocale()])
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
  return (
    <div className="min-h-screen bg-nrs-canvas text-nrs-ink layout-content">
      <section className="pb-24 px-6">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-6xl font-serif tracking-tight">{copy('KOLEKSİYONLAR', 'COLLECTIONS', 'المجموعات')}</h1>
            <div className="h-px w-20 bg-nrs-black/20 mx-auto" />
            <p className="text-nrs-ink/60 font-sans italic text-sm max-w-xl mx-auto">{copy('Zamanın ötesinde siluetler, rafine detaylar ve modern kadının ruhunu yansıtan özel seçkiler.', 'Timeless silhouettes and refined details, curated for the modern woman.', 'خطوط خالدة وتفاصيل راقية في مختارات تعكس روح المرأة العصرية.')}</p>
          </div>
          <CollectionListing collections={collections} />
        </div>
      </section>
    </div>
  )
}
