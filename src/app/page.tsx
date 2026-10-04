import type { Metadata } from 'next'
import HomePageContent from '@/components/HomePageContent'
import { getStorefrontProducts } from '@/lib/products'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default async function Page() {
  const products = await getStorefrontProducts()
  return <HomePageContent products={products} />
}
