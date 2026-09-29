'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

interface EditorialImageProps {
  src: string | null
  alt: string
  sizes?: string
  className?: string
}

export default function EditorialImage({ src, alt, sizes, className = 'object-cover' }: EditorialImageProps) {
  const [unavailable, setUnavailable] = useState(!src)

  useEffect(() => {
    setUnavailable(!src)
  }, [src])

  if (!src || unavailable) {
    return <div className="absolute inset-0 bg-[#EAE6DF]" role="img" aria-label={`${alt} — görsel henüz eklenmedi`} />
  }

  return <Image
    key={src}
    src={src}
    alt={alt}
    fill
    sizes={sizes}
    className={className}
    onError={() => setUnavailable(true)}
  />
}
