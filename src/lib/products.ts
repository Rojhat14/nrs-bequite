import 'server-only'

import { cache } from 'react'

import { PRODUCTS, type Product } from '@/data/products'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getProductImageUrl } from '@/lib/storage/products'
import type { CategoryRow, CollectionRow, ProductImageRow, ProductRow, ProductVariantRow } from '@/lib/admin/types'

export type StorefrontCategory = Pick<CategoryRow, 'id' | 'name' | 'slug' | 'description' | 'sort_order'>
export type StorefrontCollection = Pick<CollectionRow, 'id' | 'name' | 'slug' | 'description' | 'sort_order'>

type CatalogProductRow = Pick<ProductRow, 'id' | 'slug' | 'name' | 'category_id' | 'description' | 'price_amount' | 'currency' | 'compare_at_price' | 'in_stock' | 'fabric' | 'care'>
type CatalogVariantRow = Pick<ProductVariantRow, 'id' | 'product_id' | 'size' | 'stock_quantity' | 'is_active'>
const PRODUCT_COLUMNS = 'id,slug,name,category_id,description,price_amount,currency,compare_at_price,in_stock,fabric,care'
const CATEGORY_COLUMNS = 'id,name,slug,description,sort_order'
const COLLECTION_COLUMNS = 'id,name,slug,description,sort_order'
const IMAGE_COLUMNS = 'id,product_id,provider,storage_key,url,alt_text,sort_order,is_primary,created_at'
const VARIANT_COLUMNS = 'id,product_id,size,stock_quantity,is_active'

// React cache is scoped to one server render, including metadata + page work.
// It never shares cookie/RLS-dependent results between requests or users.
const getActiveCategoryRows = cache(async () => {
  const supabase = await createSupabaseServerClient()
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
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
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
      return url ? [{ url, altText: image.alt_text || row.name, sortOrder: image.sort_order, isPrimary: image.is_primary }] : []
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
      ? activeVariants.some((variant) => variant.stock_quantity > 0)
      : row.in_stock,
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
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  rows: CatalogProductRow[],
  knownCategories?: StorefrontCategory[],
) {
  if (rows.length === 0) return [] as Product[]
  const productIds = rows.map((row) => row.id)
  const [imagesResult, variantsResult, relationResult, categoriesResult] = await Promise.all([
    supabase.from('product_images').select(IMAGE_COLUMNS).in('product_id', productIds)
      .order('sort_order').order('created_at').order('id'),
    supabase.from('product_variants').select(VARIANT_COLUMNS).in('product_id', productIds).eq('is_active', true),
    supabase.from('product_collections').select('product_id, collection_id').in('product_id', productIds),
    knownCategories
      ? Promise.resolve({ data: knownCategories, error: null })
      : getActiveCategoryRows(),
  ])

  const relations = (relationResult.data ?? []) as { product_id: string; collection_id: string }[]
  const collectionIds = Array.from(new Set(relations.map((relation) => relation.collection_id)))
  const collectionsResult = collectionIds.length
    ? await supabase.from('collections').select(COLLECTION_COLUMNS).in('id', collectionIds).eq('is_active', true)
    : { data: [], error: null }
  const categories = (categoriesResult.data ?? []) as StorefrontCategory[]
  const collections = (collectionsResult.data ?? []) as StorefrontCollection[]
  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const collectionMap = new Map(collections.map((collection) => [collection.id, collection]))
  const images = (imagesResult.data ?? []) as unknown as ProductImageRow[]
  const variants = (variantsResult.data ?? []) as unknown as CatalogVariantRow[]

  const imagesByProduct = groupByProduct(images)
  const variantsByProduct = groupByProduct(variants)
  const relationsByProduct = groupByProduct(relations)

  return rows.map((row) => {
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

export const getStorefrontProducts = cache(async function getStorefrontProducts() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (error) return PRODUCTS.map(toFallbackProduct)
    return mapProductRows(supabase, (data ?? []) as unknown as CatalogProductRow[])
  } catch {
    return PRODUCTS.map(toFallbackProduct)
  }
})

export const getStorefrontProduct = cache(async function getStorefrontProduct(slugOrId: string) {
  try {
    const supabase = await createSupabaseServerClient()
    let { data, error } = await supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('slug', slugOrId)
      .eq('status', 'active')
      .maybeSingle()
    if (!error && !data) {
      const result = await supabase
        .from('products')
        .select(PRODUCT_COLUMNS)
        .eq('id', slugOrId)
        .eq('status', 'active')
        .maybeSingle()
      data = result.data
      error = result.error
    }
    if (error) return fallbackById(slugOrId)
    if (!data) return null
    const [product] = await mapProductRows(supabase, [data as unknown as CatalogProductRow])
    return product ?? null
  } catch {
    return fallbackById(slugOrId)
  }
})

function fallbackById(id: string) {
  const product = PRODUCTS.find((item) => item.id === id)
  return product ? toFallbackProduct(product) : null
}

export const getStorefrontCategories = cache(async function getStorefrontCategories(): Promise<StorefrontCategory[]> {
  try {
    const { data, error } = await getActiveCategoryRows()
    if (!error) return (data ?? []) as unknown as StorefrontCategory[]
  } catch {
    // Fall back to the existing category names when Supabase is unavailable.
  }
  return getLegacyCategories()
})

export const getStorefrontCollections = cache(async function getStorefrontCollections(): Promise<StorefrontCollection[]> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.from('collections').select(COLLECTION_COLUMNS).eq('is_active', true).order('sort_order').order('name')
    if (!error) return (data ?? []) as unknown as StorefrontCollection[]
  } catch {
    return []
  }
  return []
})

export const getStorefrontNavigationData = cache(async function getStorefrontNavigationData() {
  const [categories, collections] = await Promise.all([getStorefrontCategories(), getStorefrontCollections()])
  return { categories, collections }
})

export const getCategoryCatalog = cache(async function getCategoryCatalog(slug: string) {
  try {
    const supabase = await createSupabaseServerClient()
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
    if (!categoryData) return { category: null, products: [] as Product[] }
    const category = categoryData as unknown as StorefrontCategory
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_COLUMNS)
      .eq('category_id', category.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (error) return { category, products: [] as Product[] }
    const products = await mapProductRows(supabase, (data ?? []) as unknown as CatalogProductRow[], [category])
    return { category, products }
  } catch {
    return fallbackCategoryCatalog(slug)
  }
})

function fallbackCategoryCatalog(slug: string) {
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
  ].map((name, index) => ({
    id: '', name, slug: legacyCategorySlug[name], description: null, sort_order: index,
  }))
}

export const getCollectionCatalog = cache(async function getCollectionCatalog(slug: string) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: collectionData, error: collectionError } = await supabase
      .from('collections')
      .select(COLLECTION_COLUMNS)
      .eq('slug', slug.toLowerCase())
      .eq('is_active', true)
      .maybeSingle()
    if (collectionError || !collectionData) return { collection: null, products: [] as Product[] }
    const collection = collectionData as unknown as StorefrontCollection
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
      .order('created_at', { ascending: false })
    if (error) return { collection, products: [] as Product[] }
    const products = await mapProductRows(supabase, (data ?? []) as unknown as CatalogProductRow[])
    return { collection, products }
  } catch {
    return { collection: null, products: [] as Product[] }
  }
})
