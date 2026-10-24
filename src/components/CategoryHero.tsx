'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { canOptimizeImage } from '@/lib/imageOptimization'
import type { ReactNode } from 'react'
import { useLocale } from '@/context/LocaleContext'
import { marketing } from '@/lib/i18n/marketing'

interface CategoryHeroProps {
  title: string
  description: string
  image: string | null
  children?: ReactNode
}

export default function CategoryHero({ title, description, image, children }: CategoryHeroProps) {
  const { locale } = useLocale()
  const [imageUnavailable, setImageUnavailable] = useState(!image)

  useEffect(() => {
    setImageUnavailable(!image)
  }, [image])

  return (
    <section className={`relative ${children ? 'min-h-[max(60svh,calc(var(--nrs-header-height)+22rem))]' : 'h-[60svh] min-h-[calc(var(--nrs-header-height)+22rem)]'} w-full overflow-hidden`}>
      {image && !imageUnavailable ? <div className="nrs-settle absolute inset-0">
          <Image src={image} alt={title} fill sizes="100vw" priority
            unoptimized={!canOptimizeImage(image)}
            onError={() => setImageUnavailable(true)} className="object-cover" />
        </div> : <div className="absolute inset-0 bg-nrs-panel" role="img" aria-label={`${title} — ${marketing(locale, 'missingCategoryImage')}`} />}
      <div className={`${children ? 'relative min-h-[max(60svh,calc(var(--nrs-header-height)+22rem))]' : 'absolute inset-0'} bg-black/40 flex flex-col items-center justify-center text-center text-white px-4 pb-8 pt-[calc(var(--nrs-header-height)+2rem)]`}>
        <h1
          style={{ animationDelay: '0.3s' }}
          className="nrs-fade-up text-4xl sm:text-5xl md:text-7xl font-serif mb-4 tracking-tight"
        >
          {title}
        </h1>
        <p
          style={{ animationDelay: '0.5s' }}
          className="nrs-fade-up text-lg md:text-xl font-light max-w-2xl leading-relaxed"
        >
          {description}
        </p>
        {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
      </div>
    </section>
  )
}
