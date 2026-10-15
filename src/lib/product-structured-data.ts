import type { Product } from '@/data/products'

const siteUrl = 'https://nrsbequiteluminous.com'

export function buildProductStructuredData(product: Product) {
  const slug = product.slug || product.id
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || `${product.name} ürününü NRS'de keşfedin.`,
    image: product.galleryImages?.map(image => image.url).filter(Boolean) ?? [product.image].filter(Boolean),
    sku: product.id,
    url: `${siteUrl}/product/${encodeURIComponent(slug)}`,
    offers: {
      '@type': 'Offer',
      url: `${siteUrl}/product/${encodeURIComponent(slug)}`,
      priceCurrency: product.currency || 'TRY',
      price: product.priceAmount ?? product.price,
      availability: product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  }
}
