import type { Metadata } from 'next'
import HomePageContent from '@/components/HomePageContent'
import { getStorefrontProducts } from '@/lib/products'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

const siteUrl = 'https://nrsbequiteluminous.com/'
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}#organization`,
      name: 'NRS Bequite Luminous',
      alternateName: 'NRS',
      url: siteUrl,
      logo: `${siteUrl}Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png`,
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}#website`,
      name: 'NRS Bequite Luminous',
      alternateName: 'NRS',
      url: siteUrl,
      publisher: { '@id': `${siteUrl}#organization` },
    },
  ],
}

export default async function Page() {
  const products = await getStorefrontProducts()
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <HomePageContent products={products} />
    </>
  )
}
