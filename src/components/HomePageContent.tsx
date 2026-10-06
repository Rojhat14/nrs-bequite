'use client'

import React, { useState, useEffect } from 'react'
import Hero from '@/components/Hero'
import BrandStory from '@/components/BrandStory'
import CategoryMood from '@/components/CategoryMood'
import IntroAnimation from '@/components/IntroAnimation'
import type { Product } from '@/data/products'

export default function HomePageContent({ products }: { products: Product[] }) {
  const [introFinished, setIntroFinished] = useState(false)
  const [showIntro, setShowIntro] = useState(true)

  useEffect(() => {
    let introPlayed = null
    try { introPlayed = sessionStorage.getItem('nrs-intro-played') } catch { /* Storage can be disabled. */ }
    if (introPlayed) {
      setShowIntro(false)
      setIntroFinished(true)
    }
  }, [])

  return (
    <main className="relative min-h-screen bg-nrs-canvas text-nrs-ink">
      {showIntro && <IntroAnimation onComplete={() => {
        setIntroFinished(true)
        setShowIntro(false)
        try { sessionStorage.setItem('nrs-intro-played', 'true') } catch { /* Optional animation preference. */ }
      }} />}

      <div className="pt-0">
        <Hero introFinished={introFinished} products={products} />
        <CategoryMood />
        <BrandStory />
      </div>
    </main>
  )
}
