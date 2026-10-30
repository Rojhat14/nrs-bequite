import 'server-only'

import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getRequestLocale } from '@/lib/i18n/request-locale'
import { productSourceHash, sourceHash } from '@/lib/i18n/source-hash'
import type { Locale } from '@/lib/i18n/messages'

import { PRODUCTS, type Product } from '@/data/products'
import { createSupabasePublicServerClient } from '@/lib/supabase/public-server'
import { getProductImageUrl } from '@/lib/storage/products'
import type { CategoryRow, CollectionRow, ProductImageRow, ProductRow, ProductVariantRow } from '@/lib/admin/types'
import { isHomeCategory } from '@/lib/home-category'
import { getHomeCategoryCover } from '@/lib/storage/category-covers'

export type StorefrontCategory = Pick<CategoryRow, 'id' | 'name' | 'slug' | 'description' | 'sort_order'> & { imageUrl?: string }
export type StorefrontCollection = Pick<CollectionRow, 'id' | 'name' | 'slug' | 'description' | 'sort_order'>

type CatalogProductRow = Pick<ProductRow, 'id' | 'slug' | 'name' | 'category_id' | 'description' | 'price_amount' | 'currency' | 'compare_at_price' | 'in_stock' | 'fabric' | 'care' | 'payment_test_only' | 'fulfillment_mode'>
type CatalogVariantRow = Pick<ProductVariantRow, 'id' | 'product_id' | 'size' | 'stock_quantity' | 'is_active'>
const PRODUCT_COLUMNS = 'id,slug,name,category_id,description,price_amount,currency,compare_at_price,in_stock,fabric,care,payment_test_only,fulfillment_mode'
const CATEGORY_COLUMNS = 'id,name,slug,description,sort_order'
const COLLECTION_COLUMNS = 'id,name,slug,description,sort_order'
const HOME_CATEGORY: StorefrontCategory = {
  id: '', name: 'Home', slug: 'bedding', description: 'NRS Home nevresim ve ev tekstili koleksiyonu.', sort_order: 100,
}
const IMAGE_COLUMNS = 'id,product_id,provider,storage_key,url,alt_text,sort_order,is_primary,created_at'
const VARIANT_COLUMNS = 'id,product_id,size,stock_quantity,is_active'

const STOREFRONT_CACHE_SECONDS = 60
const STOREFRONT_CACHE_TAG = 'storefront-catalog'

const getActiveCategoryRows = cache(async () => {
  const supabase = createSupabasePublicServerClient()
  return supabase.from('categories').select(CATEGORY_COLUMNS).eq('is_active', true).order('sort_order').order('name')
})

function groupByProduct<T extends { product_id: string }>(rows: T[]) {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const group = groups.get(row.product_id)
    if (group) group.push(row)
    else groups.set(row.product_id, [row])
  }
  return groups
}

async function localizeTaxonomyRows<T extends { id: string; name: string; description: string | null }>(
  supabase: SupabaseClient,
  entityType: 'category' | 'collection',
  rows: T[],
  locale: Locale,
): Promise<T[]> {
  if (locale === 'tr' || rows.length === 0) return rows
  const { data } = await supabase.from('storefront_translations').select('entity_id,source_hash,payload')
    .eq('entity_type', entityType).eq('locale', locale).in('entity_id', rows.map(row => row.id))
  const translations = new Map((data ?? []).map((row: { entity_id: string; source_hash: string; payload: Record<string, unknown> }) => [row.entity_id, row]))
  return rows.map(row => {
    const translation = translations.get(row.id)
    if (!translation || translation.source_hash !== sourceHash([row.name, row.description])) return row
    return { ...row,
      name: typeof translation.payload.name === 'string' ? translation.payload.name : row.name,
      description: typeof translation.payload.description === 'string' ? translation.payload.description : row.description,
    }
  })
}

const categoryRouteAliases: Record<string, string> = {
  dresses: 'elbiseler',
  tops: 'ust-giyim',
  blazers: 'ceketler-blazerlar',
  bottoms: 'alt-giyim',
  suits: 'takimlar',
  sale: 'indirim',
}

const legacyCategorySlug: Record<string, string> = {
  Elbiseler: 'elbiseler',
  'Üst Giyim': 'ust-giyim',
  'Ceketler & Blazerlar': 'ceketler-blazerlar',
  'Alt Giyim': 'alt-giyim',
  Takımlar: 'takimlar',
  Bedding: 'bedding',
  Aksesuar: 'accessories',
}

function formatPrice(amount: number, currency: string) {
  const formattedAmount = amount.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return currency.toUpperCase() === 'TRY' ? `₺${formattedAmount}` : `${currency.toUpperCase()} ${formattedAmount}`
}

function toFallbackProduct(product: (typeof PRODUCTS)[number]): Product {
  return {
    ...product,
    slug: product.id,
    galleryImages: [
      { url: product.image, altText: product.name, sortOrder: 0, isPrimary: true },
      ...(product.hoverImage && product.hoverImage !== product.image
        ? [{ url: product.hoverImage, altText: `${product.name} alternatif görünüm`, sortOrder: 1, isPrimary: false }]
        : []),
    ],
    variants: [],
    catalogSource: 'legacy-fallback',
  }
}

function toStorefrontProduct(
  supabase: SupabaseClient,
  row: CatalogProductRow,
  category: StorefrontCategory | null,
  images: ProductImageRow[],
  variants: CatalogVariantRow[],
): Product {
  const galleryImages = images
    .sort((left, right) =>
      left.sort_order - right.sort_order
      || left.created_at.localeCompare(right.created_at)
      || left.id.localeCompare(right.id)
    )
    .flatMap((image) => {
      const url = getProductImageUrl(supabase, image)
      return url ? [{ url, altText: row.name, sortOrder: image.sort_order, isPrimary: image.is_primary }] : []
    })
  const legacy = PRODUCTS.find((product) => product.id === row.id)
  const activeVariants = variants.filter((variant) => variant.is_active)
  const availableInVariants = activeVariants.length > 0

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: category?.name ?? legacy?.category ?? '',
    description: row.description ?? '',
    image: (galleryImages.find(image => image.isPrimary) ?? galleryImages[0])?.url ?? legacy?.image ?? '',
    hoverImage: galleryImages[1]?.url ?? legacy?.hoverImage,
    price: formatPrice(Number(row.price_amount), row.currency),
    priceAmount: Number(row.price_amount),
    inStock: availableInVariants
      ? row.fulfillment_mode === 'made_to_order' || activeVariants.some((variant) => variant.stock_quantity > 0)
      : row.in_stock,
    fulfillmentMode: row.fulfillment_mode ?? 'stock',
    currency: row.currency,
    compareAtPrice: row.compare_at_price === null ? null : Number(row.compare_at_price),
    galleryImages,
    variants: activeVariants.map((variant) => ({ id: variant.id, size: variant.size, stock_quantity: variant.stock_quantity })),
    catalogSource: 'database',
    details: {
      fabric: row.fabric ?? legacy?.details.fabric ?? '',
      care: row.care ?? legacy?.details.care ?? '',
    },
  }
}

async function mapProductRows(
  supabase: SupabaseClient,
  rows: CatalogProductRow[],
  knownCategories?: StorefrontCategory[],
  locale: Locale = 'tr',
) {
  // Enforce privacy in application code as well as in the database's public
  // policy. A test-only product must never enter a public product surface.
  rows = rows.filter((row) => row.payment_test_only !== true)
  if (rows.length === 0) return [] as Product[]
  const productIds = rows.map((row) => row.id)
  const [imagesResult, variantsResult, relationResult, categoriesResult, translationResult] = await Promise.all([
    supabase.from('product_images').select(IMAGE_COLUMNS).in('product_id', productIds)
      .order('sort_order').order('created_at').order('id'),
    supabase.from('product_variants').select(VARIANT_COLUMNS).in('product_id', productIds).eq('is_active', true),
    supabase.from('product_collections').select('product_id, collection_id').in('product_id', productIds),
    knownCategories
      ? Promise.resolve({ data: knownCategories, error: null })
    : getActiveCategoryRows(),
    locale === 'tr' ? Promise.resolve({ data: [], error: null })
      : supabase.from('storefront_translations').select('entity_id,source_hash,payload').eq('entity_type', 'product').eq('locale', locale).in('entity_id', productIds),
  ])

  const relations = (relationResult.data ?? []) as { product_id: string; collection_id: string }[]
  const collectionIds = Array.from(new Set(relations.map((relation) => relation.collection_id)))
  const collectionsResult = collectionIds.length
    ? await supabase.from('collections').select(COLLECTION_COLUMNS).in('id', collectionIds).eq('is_active', true)
    : { data: [], error: null }
  const [categories, collections] = await Promise.all([
    localizeTaxonomyRows(supabase, 'category', (categoriesResult.data ?? []) as StorefrontCategory[], locale),
    localizeTaxonomyRows(supabase, 'collection', (collectionsResult.data ?? []) as StorefrontCollection[], locale),
  ])
  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const collectionMap = new Map(collections.map((collection) => [collection.id, collection]))
  const images = (imagesResult.data ?? []) as unknown as ProductImageRow[]
  const variants = (variantsResult.data ?? []) as unknown as CatalogVariantRow[]
  const productTranslations = new Map((translationResult.data ?? []).map((row: { entity_id: string; source_hash: string; payload: Record<string, unknown> }) => [row.entity_id, row]))
  const localizedRows = rows.map(row => {
    const translation = productTranslations.get(row.id)
    if (!translation || translation.source_hash !== productSourceHash(row)) return row
    const payload = translation.payload
    return { ...row, name: typeof payload.name === 'string' ? payload.name : row.name,
      description: typeof payload.description === 'string' ? payload.description : row.description,
      fabric: typeof payload.fabric === 'string' ? payload.fabric : row.fabric,
      care: typeof payload.care === 'string' ? payload.care : row.care }
  })
  const imagesByProduct = groupByProduct(images)
  const variantsByProduct = groupByProduct(variants)
  const relationsByProduct = groupByProduct(relations)

  return localizedRows.map((row) => {
    const product = toStorefrontProduct(
      supabase,
      row,
      row.category_id ? categoryMap.get(row.category_id) ?? null : null,
      imagesByProduct.get(row.id) ?? [],
      variantsByProduct.get(row.id) ?? [],
    )
    return {
      ...product,
      collections: (relationsByProduct.get(row.id) ?? [])
        .flatMap((relation) => {
          const collection = collectionMap.get(relation.collection_id)
          return collection ? [{ id: collection.id, name: collection.name, slug: collection.slug }] : []
        }),
    }
  })
}

const readStorefrontProducts = unstable_cache(async function readStorefrontProducts(locale: Locale) {
  try {
    const supabase = createSupabasePublicServerClient()
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('status', 'active')
      .eq('payment_test_only', false)
      .order('created_at', { ascending: false })
    if (error) return PRODUCTS.map(toFallbackProduct)
    return mapProductRows(supabase, (data ?? []) as unknown as CatalogProductRow[], undefined, locale)
  } catch {
    return PRODUCTS.map(toFallbackProduct)
  }
}, ['storefront-products-v1'], { revalidate: STOREFRONT_CACHE_SECONDS, tags: [STOREFRONT_CACHE_TAG] })

export const getStorefrontProducts = cache(async function getStorefrontProducts() {
  return readStorefrontProducts(await getRequestLocale())
})

export interface HomepageShowcaseProduct {
  id: string
  image: string
}

const readHomepageShowcaseProducts = unstable_cache(async function readHomepageShowcaseProducts(): Promise<HomepageShowcaseProduct[]> {
  try {
    const supabase = createSupabasePublicServerClient()
    const { data, error } = await supabase.from('products').select('id')
      .eq('status', 'active').eq('payment_test_only', false).order('created_at', { ascending: false }).limit(12)
    if (error) throw error
    const rows = (data ?? []) as { id: string }[]
    if (rows.length === 0) return PRODUCTS.slice(0, 12).map(product => ({ id: product.id, image: product.image }))
    const ids = rows.map(row => row.id)
    const { data: imageRows, error: imageError } = await supabase.from('product_images')
      .select(IMAGE_COLUMNS).in('product_id', ids).order('sort_order').order('created_at').order('id')
    if (imageError) throw imageError
    const imagesByProduct = groupByProduct((imageRows ?? []) as unknown as ProductImageRow[])
    return rows.map(({ id }) => {
      const legacy = PRODUCTS.find(product => product.id === id)
      const images = imagesByProduct.get(id) ?? []
      const image = images.find(item => item.is_primary) ?? images[0]
      return { id, image: getProductImageUrl(supabase, image) ?? legacy?.image ?? '' }
    })
  } catch {
    return PRODUCTS.slice(0, 12).map(product => ({ id: product.id, image: product.image }))
  }
}, ['homepage-showcase-products-v1'], { revalidate: STOREFRONT_CACHE_SECONDS, tags: [STOREFRONT_CACHE_TAG] })

export const getHomepageShowcaseProducts = cache(async function getHomepageShowcaseProducts() {
  return readHomepageShowcaseProducts()
})

const readStorefrontProduct = unstable_cache(async function readStorefrontProduct(slugOrId: string, locale: Locale) {
  try {
    const supabase = createSupabasePublicServerClient()
    let { data, error } = await supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('slug', slugOrId)
      .eq('status', 'active')
      .eq('payment_test_only', false)
      .maybeSingle()
    if (!error && !data) {
      const result = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('id', slugOrId)
        .eq('status', 'active')
        .eq('payment_test_only', false)
        .maybeSingle()
      data = result.data
      error = result.error
    }
    if (error) return fallbackById(slugOrId)
    if (!data || data.payment_test_only === true) return null
    const [product] = await mapProductRows(supabase, [data as unknown as CatalogProductRow], undefined, locale)
    return product ?? null
  } catch {
    return fallbackById(slugOrId)
  }
}, ['storefront-product-v1'], { revalidate: STOREFRONT_CACHE_SECONDS, tags: [STOREFRONT_CACHE_TAG] })

export const getStorefrontProduct = cache(async function getStorefrontProduct(slugOrId: string) {
  return readStorefrontProduct(slugOrId, await getRequestLocale())
})

function fallbackById(id: string) {
  const product = PRODUCTS.find((item) => item.id === id)
  return product ? toFallbackProduct(product) : null
}

const readStorefrontCategories = unstable_cache(async function readStorefrontCategories(locale: Locale): Promise<StorefrontCategory[]> {
  try {
    const supabase = createSupabasePublicServerClient()
    const { data, error } = await getActiveCategoryRows()
    if (!error) {
      let categories = (data ?? []) as unknown as StorefrontCategory[]
      if (locale !== 'tr' && categories.length) categories = await localizeTaxonomyRows(
        supabase, 'category', categories, locale)
      categories = withJumpsuitCategory(categories, locale)
      return categories.some(isHomeCategory)
        ? await Promise.all(categories.map(async category => isHomeCategory(category)
          ? { ...category, name: locale === 'ar' ? 'المنزل' : 'Home', imageUrl: await getHomeCategoryCover(category.id) } : category))
        : [...categories, HOME_CATEGORY]
    }
  } catch {
    // Fall back to the existing category names when Supabase is unavailable.
  }
  return getLegacyCategories()
}, ['storefront-categories-v1'], { revalidate: STOREFRONT_CACHE_SECONDS, tags: [STOREFRONT_CACHE_TAG] })

/** Jumpsuits were filed under Elbiseler/Takımlar. Until the catalogue has its
 * own "tulumlar" row, list a route-backed category right after the dresses. */
export const JUMPSUIT_CATEGORY_SLUG = 'tulumlar'
export function isJumpsuitProduct(product: Pick<Product, 'id' | 'slug'>) {
  // Some IDs are opaque ("111111111"); the URL slug still names the garment.
  return [product.id, product.slug ?? ''].some(value => /(^|-)tulum(-|$)/.test(value))
}
function withJumpsuitCategory(categories: StorefrontCategory[], locale: Locale) {
  if (categories.some(category => category.slug === JUMPSUIT_CATEGORY_SLUG)) return categories
  const dresses = categories.find(category => ['elbiseler', 'dresses'].includes(category.slug))
  const jumpsuits: StorefrontCategory = {
    id: '', slug: JUMPSUIT_CATEGORY_SLUG, description: null,
    name: locale === 'en' ? 'Jumpsuits' : locale === 'ar' ? 'جمبسوت' : 'Tulumlar',
    sort_order: (dresses?.sort_order ?? 0) + 0.5,
  }
  const index = dresses ? categories.indexOf(dresses) + 1 : 0
  return [...categories.slice(0, index), jumpsuits, ...categories.slice(index)]
}

export const getStorefrontCategories = cache(async function getStorefrontCategories(): Promise<StorefrontCategory[]> {
  return readStorefrontCategories(await getRequestLocale())
})

const readStorefrontCollections = unstable_cache(async function readStorefrontCollections(locale: Locale): Promise<StorefrontCollection[]> {
  try {
    const supabase = createSupabasePublicServerClient()
    const { data, error } = await supabase.from('collections').select(COLLECTION_COLUMNS).eq('is_active', true).order('sort_order').order('name')
    if (!error) {
      let rows = (data ?? []) as unknown as StorefrontCollection[]
      if (locale !== 'tr' && rows.length) rows = await localizeTaxonomyRows(supabase, 'collection', rows, locale)
      return rows
    }
  } catch {
    return []
  }
  return []
}, ['storefront-collections-v1'], { revalidate: STOREFRONT_CACHE_SECONDS, tags: [STOREFRONT_CACHE_TAG] })

export const getStorefrontCollections = cache(async function getStorefrontCollections(): Promise<StorefrontCollection[]> {
  return readStorefrontCollections(await getRequestLocale())
})

export const getStorefrontNavigationData = cache(async function getStorefrontNavigationData() {
  const [categories, collections] = await Promise.all([getStorefrontCategories(), getStorefrontCollections()])
  return { categories, collections }
})

const readCategoryCatalog = unstable_cache(async function readCategoryCatalog(slug: string, locale: Locale) {
  try {
    const supabase = createSupabasePublicServerClient()
    const requestedSlug = slug.toLowerCase()
    const mappedSlug = categoryRouteAliases[requestedSlug]
    let { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select(CATEGORY_COLUMNS)
      .eq('slug', requestedSlug)
      .eq('is_active', true)
      .maybeSingle()
    if (categoryError) return fallbackCategoryCatalog(slug)
    if (!categoryData && mappedSlug && mappedSlug !== requestedSlug) {
      const result = await supabase.from('categories').select(CATEGORY_COLUMNS).eq('slug', mappedSlug).eq('is_active', true).maybeSingle()
      categoryData = result.data
      categoryError = result.error
    }
    if (categoryError) return fallbackCategoryCatalog(slug)
    const requestedHome = isHomeCategory({ name: '', slug: requestedSlug })
    if (!categoryData && requestedHome) {
      const { data, error } = await getActiveCategoryRows()
      if (error) return { category: HOME_CATEGORY, products: [] as Product[] }
      categoryData = data?.find(isHomeCategory) ?? null
    }
    if (!categoryData) return { category: requestedHome ? HOME_CATEGORY : null, products: [] as Product[] }
    const rawCategory = categoryData as unknown as StorefrontCategory
    const [localizedCategory] = await localizeTaxonomyRows(supabase, 'category', [rawCategory], locale)
    const category = isHomeCategory(rawCategory)
      ? { ...localizedCategory, name: locale === 'ar' ? 'المنزل' : 'Home' }
      : localizedCategory
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('category_id', category.id)
      .eq('status', 'active')
      .eq('payment_test_only', false)
      .order('created_at', { ascending: false })
    if (error) return { category, products: [] as Product[] }
    const products = await mapProductRows(supabase, (data ?? []) as unknown as CatalogProductRow[], [rawCategory], locale)
    return { category, products }
  } catch {
    return fallbackCategoryCatalog(slug)
  }
}, ['storefront-category-catalog-v1'], { revalidate: STOREFRONT_CACHE_SECONDS, tags: [STOREFRONT_CACHE_TAG] })

export const getCategoryCatalog = cache(async function getCategoryCatalog(slug: string) {
  return readCategoryCatalog(slug, await getRequestLocale())
})

function fallbackCategoryCatalog(slug: string) {
  if (isHomeCategory({ name: '', slug })) return { category: HOME_CATEGORY, products: [] as Product[] }
  const categorySlug = categoryRouteAliases[slug.toLowerCase()] ?? slug.toLowerCase()
  const category = getLegacyCategories().find((item) => item.slug === categorySlug) ?? null
  const products = category
    ? PRODUCTS.filter((product) => product.category === category.name).map(toFallbackProduct)
    : []
  return { category, products }
}

function getLegacyCategories(): StorefrontCategory[] {
  return [
    'Elbiseler',
    'Üst Giyim',
    'Ceketler & Blazerlar',
    'Alt Giyim',
    'Takımlar',
  ].map<StorefrontCategory>((name, index) => ({
    id: '', name, slug: legacyCategorySlug[name], description: null, sort_order: index,
  })).concat(HOME_CATEGORY)
}

const readCollectionCatalog = unstable_cache(async function readCollectionCatalog(slug: string, locale: Locale) {
  try {
    const supabase = createSupabasePublicServerClient()
    const { data: collectionData, error: collectionError } = await supabase
      .from('collections')
      .select(COLLECTION_COLUMNS)
      .eq('slug', slug.toLowerCase())
      .eq('is_active', true)
      .maybeSingle()
    if (collectionError || !collectionData) return { collection: null, products: [] as Product[] }
    const [collection] = await localizeTaxonomyRows(supabase, 'collection',
      [collectionData as unknown as StorefrontCollection], locale)
    const { data: relations, error: relationError } = await supabase
      .from('product_collections')
      .select('product_id')
      .eq('collection_id', collection.id)
    if (relationError) return { collection, products: [] as Product[] }
    const productIds = Array.from(new Set((relations ?? []).map((relation) => relation.product_id as string)))
    if (!productIds.length) return { collection, products: [] as Product[] }
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .in('id', productIds)
      .eq('status', 'active')
      .eq('payment_test_only', false)
      .order('created_at', { ascending: false })
    if (error) return { collection, products: [] as Product[] }
    const products = await mapProductRows(supabase, (data ?? []) as unknown as CatalogProductRow[], undefined, locale)
    return { collection, products }
  } catch {
    return { collection: null, products: [] as Product[] }
  }
}, ['storefront-collection-catalog-v1'], { revalidate: STOREFRONT_CACHE_SECONDS, tags: [STOREFRONT_CACHE_TAG] })

export const getCollectionCatalog = cache(async function getCollectionCatalog(slug: string) {
  return readCollectionCatalog(slug, await getRequestLocale())
})
