'use client'

import Hero from '@/components/Hero'
import BrandStory from '@/components/BrandStory'
import CategoryMood from '@/components/CategoryMood'
import type { HomepageShowcaseProduct } from '@/lib/products'

export default function HomePageContent({ products }: { products: HomepageShowcaseProduct[] }) {
  return (
    <main className="relative min-h-screen bg-nrs-canvas text-nrs-ink">
      <div className="pt-0">
        <Hero products={products} />
        <CategoryMood />
        <BrandStory />
      </div>
    </main>
  )
}
