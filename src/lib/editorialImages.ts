// Next config includes only files present in public at build/dev startup.
const availableAssets = new Set<string>(JSON.parse(process.env.NRS_EDITORIAL_ASSETS || '[]'))

const categoryImages: Record<string, string> = {
  elbiseler: '/images/editorial/categories/dresses.jpg',
  dresses: '/images/editorial/categories/dresses.jpg',
  'ust-giyim': '/images/editorial/categories/tops.jpg',
  tops: '/images/editorial/categories/tops.jpg',
  'ceketler-blazerlar': '/images/editorial/categories/blazers.jpg',
  blazers: '/images/editorial/categories/blazers.jpg',
  'alt-giyim': '/images/editorial/categories/bottoms.jpg',
  bottoms: '/images/editorial/categories/bottoms.jpg',
  takimlar: '/images/editorial/categories/suits.jpg',
  suits: '/images/editorial/categories/suits.jpg',
  indirim: '/images/editorial/collections/sale.jpg',
  sale: '/images/editorial/collections/sale.jpg',
}

const collectionImages: Record<string, string> = {
  'yeni-gelenler': '/images/editorial/collections/new-arrivals.jpg',
  gunduz: '/images/editorial/collections/daytime.jpg',
  gece: '/images/editorial/collections/evening.jpg',
  davet: '/images/editorial/categories/dresses.jpg',
  imza: '/images/editorial/collections/signature.jpg',
  seckiler: '/images/editorial/collections/curated.jpg',
  indirim: '/images/editorial/collections/sale.jpg',
}

export function getCategoryEditorialImage(slug: string) {
  const image = categoryImages[slug.toLocaleLowerCase('tr-TR')]
  return image && availableAssets.has(image) ? image : null
}

export function getCollectionEditorialImage(slug: string) {
  const image = collectionImages[slug.toLocaleLowerCase('tr-TR')]
  return image && availableAssets.has(image) ? image : null
}
