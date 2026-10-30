import ProductDetail from '@/components/ProductDetail';
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getStorefrontProduct, getStorefrontProducts } from '@/lib/products'
import { lookFamilyOf } from '@/lib/look-families'
import { buildProductStructuredData } from '@/lib/product-structured-data'
import { headers } from 'next/headers'
import { isLocale, languageAlternates, type Locale } from '@/lib/i18n/messages'
import { getCurrentUsdTryRate } from '@/lib/i18n/rates'

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params: paramsPromise }: ProductPageProps): Promise<Metadata> {
  const params = await paramsPromise
  const requestHeaders = await headers()
  const currentLocale = requestHeaders.get('x-nrs-locale')
  const locale: Locale = isLocale(currentLocale) ? currentLocale : 'tr'
  const product = await getStorefrontProduct(params.id)
  if (!product) return { title: 'Ürün bulunamadı | NRS' }
  return {
    title: `NRS | ${product.name}`,
    alternates: { canonical: `${locale === 'tr' ? '' : `/${locale}`}/product/${encodeURIComponent(product.slug || product.id)}`, languages: languageAlternates(`/product/${encodeURIComponent(product.slug || product.id)}`) },
    description: product.description || `${product.name} ürününü NRS'de keşfedin.`,
  }
}

export default async function ProductPage({ params: paramsPromise }: ProductPageProps) {
  const params = await paramsPromise
  const [product, requestHeaders, rate] = await Promise.all([getStorefrontProduct(params.id), headers(), getCurrentUsdTryRate()])
  if (!product) notFound()
  const headerLocale = requestHeaders.get('x-nrs-locale')
  const locale: Locale = isLocale(headerLocale) ? headerLocale : 'tr'
  const structuredData = JSON.stringify(buildProductStructuredData(product, locale, rate)).replace(/</g, '\\u003c')
  // Pieces of the same look share photos; list the set and each piece with its
  // own price so the shopper knows exactly what this page sells.
  const family = lookFamilyOf(product.id)
  const look = family ? await getStorefrontProducts().then(products => family.members.flatMap(member => {
    const match = products.find(item => item.id === member.id)
    return match ? [{ id: match.id, slug: match.slug || match.id, name: match.name, kind: member.kind, price: match.price, priceAmount: match.priceAmount ?? null }] : []
  })) : []
  return <div className="min-h-screen bg-nrs-canvas text-nrs-ink">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
    <ProductDetail product={product} look={look.length > 1 ? look : undefined} />
  </div>
}
