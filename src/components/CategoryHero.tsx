'use client'

import { m as motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { canOptimizeImage } from '@/lib/imageOptimization'

interface CategoryHeroProps {
  title: string
  description: string
  image: string | null
}

export default function CategoryHero({ title, description, image }: CategoryHeroProps) {
  const [imageUnavailable, setImageUnavailable] = useState(!image)

  useEffect(() => {
    setImageUnavailable(!image)
  }, [image])

  return (
    <section className="relative h-[60svh] min-h-[calc(var(--nrs-header-height)+22rem)] w-full overflow-hidden">
      {image && !imageUnavailable ? <motion.div
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5 }}
          className="absolute inset-0"
        >
          <Image src={image} alt={title} fill sizes="100vw" priority
            unoptimized={!canOptimizeImage(image)}
            onError={() => setImageUnavailable(true)} className="object-cover" />
        </motion.div> : <div className="absolute inset-0 bg-nrs-panel" role="img" aria-label={`${title} — görsel henüz eklenmedi`} />}
      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-center text-white px-4 pb-8 pt-[calc(var(--nrs-header-height)+2rem)]">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-4xl sm:text-5xl md:text-7xl font-serif mb-4 tracking-tight"
        >
          {title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-lg md:text-xl font-light max-w-2xl leading-relaxed"
        >
          {description}
        </motion.p>
      </div>
    </section>
  )
}
