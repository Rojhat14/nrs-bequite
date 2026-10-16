import type { Metadata } from 'next'
import HomePageContent from '@/components/HomePageContent'
import { getStorefrontProducts } from '@/lib/products'
import { headers } from 'next/headers'
import { isLocale } from '@/lib/i18n/messages'

export async function generateMetadata(): Promise<Metadata> {
  const localeHeader = (await headers()).get('x-nrs-locale')
  const locale = isLocale(localeHeader) ? localeHeader : 'tr'
  const canonical = `https://nrsbequiteluminous.com${locale === 'tr' ? '' : `/${locale}`}` || 'https://nrsbequiteluminous.com/'
  return { alternates: { canonical, languages: {
    tr: 'https://nrsbequiteluminous.com/', en: 'https://nrsbequiteluminous.com/en', ar: 'https://nrsbequiteluminous.com/ar',
    'x-default': 'https://nrsbequiteluminous.com/',
  } } }
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
