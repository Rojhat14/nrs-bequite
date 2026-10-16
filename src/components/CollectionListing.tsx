'use client'

import { m as motion } from 'framer-motion'
import Link from 'next/link'
import EditorialImage from '@/components/EditorialImage'
import { getCollectionEditorialImage } from '@/lib/editorialImages'
import { getCollectionPresentation } from '@/lib/collectionPresentation'
import type { StorefrontCollection } from '@/lib/products'
import { useLocale } from '@/context/LocaleContext'
import { localePrefix } from '@/lib/i18n/messages'
import { marketing } from '@/lib/i18n/marketing'

interface CollectionListingProps {
  collections: StorefrontCollection[]
}

export default function CollectionListing({ collections }: CollectionListingProps) {
  const { locale } = useLocale()
  const prefix = localePrefix(locale)
  const t = (key: Parameters<typeof marketing>[1]) => marketing(locale, key)
  const collectionDescriptions: Record<string, Parameters<typeof marketing>[1]> = {
    'yeni-gelenler': 'collectionNew', gunduz: 'collectionDay', gece: 'collectionNight',
    imza: 'collectionSignature', indirim: 'collectionSale',
  }
  const visibleCollections = collections.filter(collection => collection.slug !== 'seckiler')
  return (
    <>
      {visibleCollections.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {visibleCollections.map((collection, index) => {
          const presentation = getCollectionPresentation(collection)
          const image = getCollectionEditorialImage(collection.slug)
          const description = presentation.description || t(collectionDescriptions[collection.slug] || 'collectionFallback')
          return <motion.div key={collection.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} viewport={{ once: true }} className="group">
            <Link href={`${prefix}/collections/${encodeURIComponent(collection.slug)}`} className="block">
              <div className="relative aspect-[16/9] overflow-hidden mb-6">
                <EditorialImage src={image} alt={presentation.name} sizes="(max-width: 768px) 100vw, 50vw" className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-105" />
                <div className="absolute inset-0 bg-nrs-black/20 group-hover:bg-transparent transition-all duration-500" />
              </div>
              <h2 className="text-2xl font-serif text-nrs-ink mb-3 tracking-wide">{presentation.name}</h2>
              <p className="text-sm text-nrs-ink/60 font-sans leading-relaxed mb-6">{description}</p>
              <span className="text-[10px] uppercase tracking-widest text-nrs-ink font-medium border-b border-nrs-ink pb-1 group-hover:text-nrs-rosegold group-hover:border-nrs-rosegold transition-all duration-500">{t('discover')}</span>
            </Link>
          </motion.div>
        })}
      </div> : <p className="py-24 text-center font-serif italic text-nrs-ink/60">{t('collectionEmpty')}</p>}
    </>
  )
}
