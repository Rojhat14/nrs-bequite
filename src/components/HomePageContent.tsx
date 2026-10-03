'use client'

import React, { useState, useEffect } from 'react'
import Hero from '@/components/Hero'
import Collection from '@/components/Collection'
import BrandStory from '@/components/BrandStory'
import CategoryMood from '@/components/CategoryMood'
import IntroAnimation from '@/components/IntroAnimation'
import type { Product } from '@/data/products'
import { motion } from 'framer-motion'

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
        <section className="py-24 max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-4xl md:text-5xl font-serif">The Luminous Edit</motion.h2>
            <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="text-nrs-ink/60 font-light text-lg max-w-2xl mx-auto">
              A curated selection of our most exclusive pieces, designed for those who appreciate the art of elegance.
            </motion.p>
          </div>
          <Collection products={products} />
        </section>
        <BrandStory />
      </div>
    </main>
  )
}
