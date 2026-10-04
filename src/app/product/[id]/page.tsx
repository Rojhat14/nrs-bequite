import ProductDetail from '@/components/ProductDetail';
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getStorefrontProduct } from '@/lib/products'

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params: paramsPromise }: ProductPageProps): Promise<Metadata> {
  const params = await paramsPromise
  const product = await getStorefrontProduct(params.id)
  if (!product) return { title: 'Ürün bulunamadı | NRS' }
  return {
    title: `NRS | ${product.name}`,
    alternates: { canonical: `/product/${encodeURIComponent(product.slug || product.id)}` },
    description: product.description || `${product.name} ürününü NRS'de keşfedin.`,
  }
}

export default async function ProductPage({ params: paramsPromise }: ProductPageProps) {
  const params = await paramsPromise
  const product = await getStorefrontProduct(params.id)
  if (!product) notFound()
  return <div className="min-h-screen bg-nrs-canvas text-nrs-ink"><ProductDetail product={product} /></div>
}
