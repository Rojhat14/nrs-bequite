import 'server-only'

import { PRODUCTS, type Category as LegacyCategory } from '@/data/products'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CategoryRow, ProductImageRow, ProductRow, ProductVariantRow } from '@/lib/admin/types'

export interface CatalogProduct {
  id: string
  name: string
  slug: string
  category: Pick<CategoryRow, 'id' | 'name' | 'slug'> | null
  description: string
  price_amount: number
  currency: string
  compare_at_price: number | null
  status: string
  in_stock: boolean
  fabric: string | null
  care: string | null
  images: ProductImageRow[]
  variants: ProductVariantRow[]
  source: 'database' | 'legacy-fallback'
}

const legacyCategorySlug: Record<LegacyCategory, string> = {
  Elbiseler: 'dresses',
  'Üst Giyim': 'tops',
  'Alt Giyim': 'bottoms',
  Bedding: 'bedding',
  Aksesuar: 'accessories',
}

function toFallbackProduct(product: (typeof PRODUCTS)[number]): CatalogProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.id,
    category: { id: '', name: product.category, slug: legacyCategorySlug[product.category] },
    description: product.description,
    price_amount: Number(product.price.replace(/[^0-9]/g, '')),
    currency: 'TRY',
    compare_at_price: null,
    status: 'active',
    in_stock: product.inStock,
    fabric: product.details.fabric,
    care: product.details.care,
    images: [
      { id: `${product.id}-main`, product_id: product.id, provider: 'next-public', storage_key: null, url: product.image, alt_text: product.name, sort_order: 0, is_primary: true, created_at: '' },
      ...(product.hoverImage && product.hoverImage !== product.image ? [{ id: `${product.id}-hover`, product_id: product.id, provider: 'next-public', storage_key: null, url: product.hoverImage, alt_text: `${product.name} alternatif görünüm`, sort_order: 1, is_primary: false, created_at: '' }] : []),
    ],
    variants: [],
    source: 'legacy-fallback',
  }
}

async function readCatalog() {
  const supabase = await createSupabaseServerClient()
  const [productsResult, categoriesResult, imagesResult, variantsResult] = await Promise.all([
    supabase.from('products').select('*').order('created_at', { ascending: false }),
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('product_images').select('*').order('sort_order'),
    supabase.from('product_variants').select('*').eq('is_active', true),
  ])
  if (productsResult.error) return { products: PRODUCTS.map(toFallbackProduct), categories: [] as CategoryRow[], source: 'legacy-fallback' as const }
  const products = (productsResult.data ?? []) as unknown as ProductRow[]
  const categories = (categoriesResult.data ?? []) as unknown as CategoryRow[]
  const images = (imagesResult.data ?? []) as unknown as ProductImageRow[]
  const variants = (variantsResult.data ?? []) as unknown as ProductVariantRow[]
  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  return {
    source: 'database' as const,
    categories,
    products: products.map((product) => ({
      ...product,
      price_amount: Number(product.price_amount),
      compare_at_price: product.compare_at_price === null ? null : Number(product.compare_at_price),
      category: product.category_id ? categoryMap.get(product.category_id) ?? null : null,
      images: images.filter((image) => image.product_id === product.id),
      variants: variants.filter((variant) => variant.product_id === product.id),
      source: 'database' as const,
    })),
  }
}

export async function getProducts() {
  return (await readCatalog()).products
}

export async function getProductById(id: string) {
  const catalog = await readCatalog()
  return catalog.products.find((product) => product.id === id) ?? null
}

export async function getProductBySlug(slug: string) {
  const catalog = await readCatalog()
  return catalog.products.find((product) => product.slug === slug) ?? null
}

export async function getCategories() {
  const catalog = await readCatalog()
  if (catalog.categories.length) return catalog.categories
  const names = Array.from(new Map(PRODUCTS.map((product) => [product.category, product.category])).values())
  return names.map((name) => ({ id: '', name, slug: legacyCategorySlug[name], description: null, sort_order: 0, is_active: true, created_at: '', updated_at: '' }))
}
