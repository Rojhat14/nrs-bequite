import 'server-only'

import { PRODUCTS, type Product } from '@/data/products'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getProductImageUrl } from '@/lib/storage/products'
import type { CategoryRow, CollectionRow, ProductImageRow, ProductRow, ProductVariantRow } from '@/lib/admin/types'

export type StorefrontCategory = Pick<CategoryRow, 'id' | 'name' | 'slug' | 'description' | 'sort_order'>
export type StorefrontCollection = Pick<CollectionRow, 'id' | 'name' | 'slug' | 'description' | 'sort_order'>

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
  row: ProductRow,
  category: CategoryRow | null,
  images: ProductImageRow[],
  variants: ProductVariantRow[],
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
  rows: ProductRow[],
  knownCategories?: CategoryRow[],
) {
  if (rows.length === 0) return [] as Product[]
  const productIds = rows.map((row) => row.id)
  const [imagesResult, variantsResult, relationResult, categoriesResult] = await Promise.all([
    supabase.from('product_images').select('*').in('product_id', productIds)
      .order('sort_order').order('created_at').order('id'),
    supabase.from('product_variants').select('*').in('product_id', productIds).eq('is_active', true),
    supabase.from('product_collections').select('product_id, collection_id').in('product_id', productIds),
    knownCategories
      ? Promise.resolve({ data: knownCategories, error: null })
      : supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
  ])

  const relations = (relationResult.data ?? []) as { product_id: string; collection_id: string }[]
  const collectionIds = Array.from(new Set(relations.map((relation) => relation.collection_id)))
  const collectionsResult = collectionIds.length
    ? await supabase.from('collections').select('*').in('id', collectionIds).eq('is_active', true)
    : { data: [], error: null }
  const categories = (categoriesResult.data ?? []) as CategoryRow[]
  const collections = (collectionsResult.data ?? []) as CollectionRow[]
  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const collectionMap = new Map(collections.map((collection) => [collection.id, collection]))
  const images = (imagesResult.data ?? []) as unknown as ProductImageRow[]
  const variants = (variantsResult.data ?? []) as unknown as ProductVariantRow[]

  return rows.map((row) => {
    const product = toStorefrontProduct(
      supabase,
      row,
      row.category_id ? categoryMap.get(row.category_id) ?? null : null,
      images.filter((image) => image.product_id === row.id),
      variants.filter((variant) => variant.product_id === row.id),
    )
    return {
      ...product,
      collections: relations
        .filter((relation) => relation.product_id === row.id)
        .flatMap((relation) => {
          const collection = collectionMap.get(relation.collection_id)
          return collection ? [{ id: collection.id, name: collection.name, slug: collection.slug }] : []
        }),
    }
  })
}

export async function getStorefrontProducts() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (error) return PRODUCTS.map(toFallbackProduct)
    return mapProductRows(supabase, (data ?? []) as unknown as ProductRow[])
  } catch {
    return PRODUCTS.map(toFallbackProduct)
  }
}

export async function getStorefrontProduct(slugOrId: string) {
  try {
    const supabase = await createSupabaseServerClient()
    let { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slugOrId)
      .eq('status', 'active')
      .maybeSingle()
    if (!error && !data) {
      const result = await supabase
        .from('products')
        .select('*')
        .eq('id', slugOrId)
        .eq('status', 'active')
        .maybeSingle()
      data = result.data
      error = result.error
    }
    if (error) return fallbackById(slugOrId)
    if (!data) return null
    const [product] = await mapProductRows(supabase, [data as unknown as ProductRow])
    return product ?? null
  } catch {
    return fallbackById(slugOrId)
  }
}

function fallbackById(id: string) {
  const product = PRODUCTS.find((item) => item.id === id)
  return product ? toFallbackProduct(product) : null
}

export async function getStorefrontCategories(): Promise<StorefrontCategory[]> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order').order('name')
    if (!error) return (data ?? []) as unknown as StorefrontCategory[]
  } catch {
    // Fall back to the existing category names when Supabase is unavailable.
  }
  return getLegacyCategories()
}

export async function getStorefrontCollections(): Promise<StorefrontCollection[]> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.from('collections').select('*').eq('is_active', true).order('sort_order').order('name')
    if (!error) return (data ?? []) as unknown as StorefrontCollection[]
  } catch {
    return []
  }
  return []
}

export async function getStorefrontNavigationData() {
  const [categories, collections] = await Promise.all([getStorefrontCategories(), getStorefrontCollections()])
  return { categories, collections }
}

export async function getCategoryCatalog(slug: string) {
  try {
    const supabase = await createSupabaseServerClient()
    const requestedSlug = slug.toLowerCase()
    const mappedSlug = categoryRouteAliases[requestedSlug]
    let { data: categoryData, error: categoryError } = await supabase
      .from('categories')
      .select('*')
      .eq('slug', requestedSlug)
      .eq('is_active', true)
      .maybeSingle()
    if (categoryError) return fallbackCategoryCatalog(slug)
    if (!categoryData && mappedSlug && mappedSlug !== requestedSlug) {
      const result = await supabase.from('categories').select('*').eq('slug', mappedSlug).eq('is_active', true).maybeSingle()
      categoryData = result.data
      categoryError = result.error
    }
    if (categoryError) return fallbackCategoryCatalog(slug)
    if (!categoryData) return { category: null, products: [] as Product[] }
    const category = categoryData as unknown as CategoryRow
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category_id', category.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (error) return { category, products: [] as Product[] }
    const products = await mapProductRows(supabase, (data ?? []) as unknown as ProductRow[], [category])
    return { category, products }
  } catch {
    return fallbackCategoryCatalog(slug)
  }
}

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

export async function getCollectionCatalog(slug: string) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: collectionData, error: collectionError } = await supabase
      .from('collections')
      .select('*')
      .eq('slug', slug.toLowerCase())
      .eq('is_active', true)
      .maybeSingle()
    if (collectionError || !collectionData) return { collection: null, products: [] as Product[] }
    const collection = collectionData as unknown as CollectionRow
    const { data: relations, error: relationError } = await supabase
      .from('product_collections')
      .select('product_id')
      .eq('collection_id', collection.id)
    if (relationError) return { collection, products: [] as Product[] }
    const productIds = Array.from(new Set((relations ?? []).map((relation) => relation.product_id as string)))
    if (!productIds.length) return { collection, products: [] as Product[] }
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    if (error) return { collection, products: [] as Product[] }
    const products = await mapProductRows(supabase, (data ?? []) as unknown as ProductRow[])
    return { collection, products }
  } catch {
    return { collection: null, products: [] as Product[] }
  }
}
