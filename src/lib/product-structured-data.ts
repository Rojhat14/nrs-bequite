import type { Product } from '@/data/products'
import type { Locale } from '@/lib/i18n/messages'
import type { DisplayRate } from '@/lib/i18n/money'

const siteUrl = 'https://nrsbequiteluminous.com'

export function buildProductStructuredData(product: Product, locale: Locale = 'tr', rate: DisplayRate | null = null) {
  const slug = product.slug || product.id
  const path = `${locale === 'tr' ? '' : `/${locale}`}/product/${encodeURIComponent(slug)}`
  const normalMinor = product.priceAmount == null ? null : Math.round(product.priceAmount * 100)
  const saleMinor = normalMinor
  const displayCurrency = normalMinor !== null && locale !== 'tr' && rate ? 'USD' : product.currency || 'TRY'
  const displayMinor = saleMinor === null ? null : displayCurrency === 'USD' ? Math.round(saleMinor / rate!.usdTry) : saleMinor
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || `${product.name} ürününü NRS'de keşfedin.`,
    image: product.galleryImages?.map(image => image.url).filter(Boolean) ?? [product.image].filter(Boolean),
    sku: product.id,
    url: `${siteUrl}${path}`,
    offers: {
      '@type': 'Offer',
      url: `${siteUrl}${path}`,
      priceCurrency: displayCurrency,
      price: displayMinor === null ? product.price : (displayMinor / 100).toFixed(2),
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  }
}
