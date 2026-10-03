'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import EditorialImage from '@/components/EditorialImage'
import { getCollectionEditorialImage } from '@/lib/editorialImages'
import type { StorefrontCollection } from '@/lib/products'

interface CollectionListingProps {
  collections: StorefrontCollection[]
}

const collectionVisuals: Record<string, { description: string }> = {
  'yeni-gelenler': { description: 'NRS dünyasına yeni katılan güncel tasarımlar.' },
  gunduz: { description: 'Günün her anına eşlik eden rafine ve zamansız parçalar.' },
  gece: { description: 'Işığın değiştiği saatler için akışkan dokular ve güçlü siluetler.' },
  davet: { description: 'Özel anlar için özenle seçilmiş NRS tasarımları.' },
  imza: { description: 'NRS karakterini taşıyan ikonik siluetler ve detaylar.' },
  seckiler: { description: 'NRS tarafından sizin için bir araya getirilen özel parçalar.' },
  indirim: { description: 'NRS seçkisinden avantajlı fiyatlarla sunulan tasarımlar.' },
}

export default function CollectionListing({ collections }: CollectionListingProps) {
  return (
    <>
      {collections.length > 0 ? <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {collections.map((collection, index) => {
          const visual = collectionVisuals[collection.slug]
          const image = getCollectionEditorialImage(collection.slug)
          return <motion.div key={collection.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} viewport={{ once: true }} className="group">
            <Link href={`/collections/${encodeURIComponent(collection.slug)}`} className="block">
              <div className="relative aspect-[16/9] overflow-hidden mb-6">
                <EditorialImage src={image} alt={collection.name} sizes="(max-width: 768px) 100vw, 50vw" className="object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-105" />
                <div className="absolute inset-0 bg-nrs-black/20 group-hover:bg-transparent transition-all duration-500" />
              </div>
              <h2 className="text-2xl font-serif text-nrs-ink mb-3 tracking-wide">{collection.name}</h2>
              <p className="text-sm text-nrs-ink/60 font-sans leading-relaxed mb-6">{collection.description || visual?.description || 'NRS koleksiyonunu keşfedin.'}</p>
              <span className="text-[10px] uppercase tracking-widest text-nrs-ink font-medium border-b border-nrs-ink pb-1 group-hover:text-nrs-rosegold group-hover:border-nrs-rosegold transition-all duration-500">Keşfet</span>
            </Link>
          </motion.div>
        })}
      </div> : <p className="py-24 text-center font-serif italic text-nrs-ink/60">Henüz yayınlanmış koleksiyon bulunmuyor.</p>}
    </>
  )
}
