import type { Metadata } from 'next'
import HomeLanding, { type HomeSelection } from '@/components/HomeLanding'
import type { Product } from '@/data/products'
import { getStorefrontProducts, isJumpsuitProduct } from '@/lib/products'
import { lookFamilyOf } from '@/lib/look-families'
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

// Hand-picked from Meta ad and site data (2026-10-30): the pieces shoppers
// clicked and added to bag most, led by colourful, complete looks. Slugs, so
// opaque product IDs do not matter; missing products are skipped.
const HERO = ['scarlet-drape-pleated-ceket-takim', 'aura-gold-detayli-asimetrik-beyaz-tulum', 'marquise-asimetrik-katli-bordo-bol-paca-pantolon-kopya']
const FAVOURITES = ['aura-gold-detayli-asimetrik-beyaz-tulum', 'scarlet-drape-pleated-ceket-takim', 'marquise-asimetrik-katli-bordo-bol-paca-pantolon-kopya', 'midnight-isilti-islemeli-asimetrik-abiye-tulum',
  'burgundy-embroidered-kalem-elbise', 'olive-peplum-saten-ikili-takim', 'nocturne-kare-yaka-saten-lacivert-tulum', 'elysian-ekose-tuvit-blazer-takim']
const CATEGORY_TILES = [
  { key: 'dresses', href: '/category/elbiseler', slug: 'burgundy-embroidered-kalem-elbise' },
  { key: 'jumpsuits', href: '/category/tulumlar', slug: 'saffron-botanik-desenli-ipeksi-tulum' },
  { key: 'sets', href: '/category/takimlar', slug: 'sovereign-saks-mavi-blazer-ceket' },
  { key: 'jackets', href: '/category/ceketler-blazerlar', slug: 'monochrome-tweed-broche-ceket-takim' },
] as const
const ATELIER = 'ivory-sculpted-asimetrik-yelek-takim'

function homeSelection(products: Product[]): HomeSelection {
  const bySlug = new Map(products.map(product => [product.slug || product.id, product]))
  const pick = (slugs: readonly string[]) => slugs.flatMap(slug => bySlug.get(slug) ?? [])
  const sellable = products.filter(product => product.inStock && product.image && product.priceAmount != null && !/nevresim/i.test(product.slug || product.id))
  // Separate pieces reuse the full look's photo, so keep them off the homepage.
  const standalone = sellable.filter(product => (lookFamilyOf(product.id)?.kind ?? 'set') === 'set')
  const favourites = pick(FAVOURITES)
  const underBudget = standalone.filter(product => product.priceAmount! < 4000 && !favourites.includes(product))
    .sort((a, b) => Number(isJumpsuitProduct(b)) - Number(isJumpsuitProduct(a)) || b.priceAmount! - a.priceAmount!).slice(0, 8)
  return {
    hero: pick(HERO),
    categories: CATEGORY_TILES.flatMap(tile => { const product = bySlug.get(tile.slug); return product ? [{ key: tile.key, href: tile.href, product }] : [] }),
    favourites,
    underBudget,
    atelier: bySlug.get(ATELIER) ?? null,
    lowestPrice: standalone.length ? Math.min(...standalone.map(product => product.priceAmount!)) : null,
  }
}

export default async function Page() {
  const products = await getStorefrontProducts()
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <HomeLanding selection={homeSelection(products)} />
    </>
  )
}
