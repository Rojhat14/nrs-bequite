import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { LOW_STOCK_THRESHOLD } from '@/lib/admin/config'
import type { CategoryRow, CollectionRow, OrderItemRow, OrderRow, ProductImageRow, ProductRow, ProductVariantRow, ProfileRow, WishlistRow } from '@/lib/admin/types'

const pageSize = 20

export function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === 'PGRST205' || error?.code === '42P01'
}

export async function getCategories() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('categories').select('*').order('sort_order').order('name')
  return { data: (data ?? []) as unknown as CategoryRow[], error }
}

export async function getCollections() {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('name')

  return {
    data: (data ?? []) as unknown as CollectionRow[],
    error,
  }
}

export async function getProductList(options: { page?: number; query?: string; category?: string; status?: string } = {}) {
  const supabase = await createSupabaseServerClient()
  const page = Math.max(1, Math.floor(options.page ?? 1))
  const queryText = options.query?.trim().slice(0, 80) ?? ''
  let query = supabase.from('products').select('*', { count: 'exact' }).order('updated_at', { ascending: false })
  if (queryText) query = query.ilike('name', `%${queryText}%`)
  if (options.category) query = query.eq('category_id', options.category)
  if (options.status && ['active', 'draft', 'archived'].includes(options.status)) query = query.eq('status', options.status)
  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1)
  const products = (data ?? []) as unknown as ProductRow[]
  const ids = products.map((product) => product.id)
  let imageRows: ProductImageRow[] = []
  let variantRows: ProductVariantRow[] = []
  if (ids.length) {
    const [{ data: images }, { data: variants }] = await Promise.all([
      supabase.from('product_images').select('*').in('product_id', ids).order('sort_order'),
      supabase.from('product_variants').select('*').in('product_id', ids).eq('is_active', true),
    ])
    imageRows = (images ?? []) as unknown as ProductImageRow[]
    variantRows = (variants ?? []) as unknown as ProductVariantRow[]
  }
  const categoryResult = await getCategories()
  return {
    products,
    count: count ?? 0,
    page,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    images: imageRows,
    stockByProduct: new Map(ids.map((id) => [id, variantRows.filter((variant) => variant.product_id === id).reduce((sum, variant) => sum + variant.stock_quantity, 0)])),
    categories: categoryResult.data,
    error,
    categoryError: categoryResult.error,
  }
}

export async function getProductEditorData(id: string) {
  const supabase = await createSupabaseServerClient()
  const [productResult, imagesResult, variantsResult, categoryResult, collectionsResult, collectionResult] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).maybeSingle(),
    supabase.from('product_images').select('*').eq('product_id', id).order('sort_order'),
    supabase.from('product_variants').select('*').eq('product_id', id).order('size'),
    getCategories(),
    getCollections(),
    supabase.from('product_collections').select('collection_id').eq('product_id', id),
  ])
  const selectedCollectionIds = (collectionResult.data ?? []).map((row) => row.collection_id as string)
  return {
    product: productResult.data as unknown as ProductRow | null,
    images: (imagesResult.data ?? []) as unknown as ProductImageRow[],
    variants: (variantsResult.data ?? []) as unknown as ProductVariantRow[],
    categories: categoryResult.data,
    collections: collectionsResult.data,
    selectedCollectionIds,
    error: productResult.error ?? imagesResult.error ?? variantsResult.error ?? categoryResult.error ?? collectionsResult.error ?? collectionResult.error,
  }
}

export async function getInventoryRows(options: { page?: number; filter?: string } = {}) {
  const supabase = await createSupabaseServerClient()
  const page = Math.max(1, Math.floor(options.page ?? 1))
  let query = supabase.from('product_variants').select('*', { count: 'exact' }).order('updated_at', { ascending: false })
  if (options.filter === 'in-stock') query = query.gt('stock_quantity', LOW_STOCK_THRESHOLD)
  if (options.filter === 'low') query = query.gt('stock_quantity', 0).lte('stock_quantity', LOW_STOCK_THRESHOLD)
  if (options.filter === 'out') query = query.eq('stock_quantity', 0)
  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1)
  const variants = (data ?? []) as unknown as ProductVariantRow[]
  const productIds = Array.from(new Set(variants.map((variant) => variant.product_id)))
  let products: ProductRow[] = []
  if (productIds.length) {
    const result = await supabase.from('products').select('*').in('id', productIds)
    products = (result.data ?? []) as unknown as ProductRow[]
  }
  return { variants, products, count: count ?? 0, page, pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)), error }
}

export async function getOrderList(options: { page?: number; status?: string; query?: string } = {}) {
  const supabase = await createSupabaseServerClient()
  const page = Math.max(1, Math.floor(options.page ?? 1))
  let query = supabase.from('orders').select('*', { count: 'exact' }).order('created_at', { ascending: false })
  if (options.status) query = query.eq('status', options.status)
  const queryText = options.query?.trim().slice(0, 80) ?? ''
  if (queryText) query = query.ilike('customer_email', `%${queryText}%`)
  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1)
  return { orders: (data ?? []) as unknown as OrderRow[], count: count ?? 0, page, pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)), error }
}

export async function getOrderDetail(id: string) {
  const supabase = await createSupabaseServerClient()
  const [orderResult, itemsResult] = await Promise.all([
    supabase.from('orders').select('*').eq('id', id).maybeSingle(),
    supabase.from('order_items').select('*').eq('order_id', id),
  ])
  const items = (itemsResult.data ?? []) as unknown as OrderItemRow[]
  const productIds = Array.from(new Set(items.map((item) => item.product_id)))
  let products: ProductRow[] = []
  if (productIds.length) {
    const result = await supabase.from('products').select('*').in('id', productIds)
    products = (result.data ?? []) as unknown as ProductRow[]
  }
  return { order: orderResult.data as unknown as OrderRow | null, items, products, error: orderResult.error ?? itemsResult.error }
}

export async function getAdminUsers(options: { page?: number; query?: string } = {}) {
  const supabase = await createSupabaseServerClient()
  const page = Math.max(1, Math.floor(options.page ?? 1))
  let query = supabase.from('profiles').select('*', { count: 'exact' }).order('id', { ascending: false })
  const search = options.query?.trim().slice(0, 80)
  if (search) query = query.ilike('email', `%${search}%`)
  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1)
  return { profiles: (data ?? []) as unknown as ProfileRow[], count: count ?? 0, page, pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)), error }
}

export async function getAdminUserDetail(id: string) {
  const supabase = await createSupabaseServerClient()
  const [profileResult, orderResult, summaryResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    supabase.from('orders').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
    supabase.rpc('nrs_admin_user_summary', { p_user_id: id }),
  ])
  const profile = profileResult.data as unknown as ProfileRow | null
  const orders = (orderResult.data ?? []) as unknown as OrderRow[]
  const summary = (summaryResult.data as unknown as { order_count: number; total_order_amount: number | string; favorite_count: number }[] | null)?.[0]
  return {
    profile,
    orders,
    orderCount: summary ? Number(summary.order_count) : null,
    totalOrderAmount: summary ? Number(summary.total_order_amount) : null,
    favoriteCount: summary ? Number(summary.favorite_count) : null,
    error: profileResult.error ?? orderResult.error,
    summaryError: summaryResult.error,
  }
}

export async function getFavorites(options: { page?: number; productId?: string; userId?: string } = {}) {
  const supabase = await createSupabaseServerClient()
  const page = Math.max(1, Math.floor(options.page ?? 1))
  let query = supabase.from('wishlist').select('*', { count: 'exact' })
  if (options.productId) query = query.eq('product_id', options.productId.trim().slice(0, 100))
  if (options.userId) query = query.eq('user_id', options.userId.trim().slice(0, 80))
  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1)
  const favorites = (data ?? []) as unknown as WishlistRow[]
  favorites.sort((left, right) => String(right.created_at ?? '').localeCompare(String(left.created_at ?? '')))
  return { favorites, count: count ?? 0, page, pageCount: Math.max(1, Math.ceil((count ?? 0) / pageSize)), error }
}

export async function getCategoryProductCounts(categoryIds: string[]) {
  const supabase = await createSupabaseServerClient()
  const results = await Promise.all(categoryIds.map((id) => supabase.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id)))
  const counts: Record<string, number> = {}
  for (let index = 0; index < results.length; index += 1) counts[categoryIds[index]] = results[index].count ?? 0
  return { counts, error: results.find((result) => result.error)?.error ?? null }
}

export async function getDashboardData() {
  const supabase = await createSupabaseServerClient()
  const [productCount, activeProductCount, variantCount, orderCount, pendingCount, userCount, favoriteCount, ordersResult, productsResult] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('product_variants').select('*', { count: 'exact', head: true }).eq('is_active', true).gt('stock_quantity', 0).lte('stock_quantity', LOW_STOCK_THRESHOLD),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }).in('status', ['pending', 'payment_pending']),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('wishlist').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(6),
    supabase.from('products').select('*').order('created_at', { ascending: false }).limit(6),
  ])
  const products = (productsResult.data ?? []) as unknown as ProductRow[]
  const categoriesResult = await getCategories()
  const categoryById = new Map(categoriesResult.data.map((category) => [category.id, category.name]))
  const productIds = products.map((product) => product.id)
  let imageRows: ProductImageRow[] = []
  if (productIds.length) {
    const result = await supabase.from('product_images').select('*').in('product_id', productIds).order('sort_order')
    imageRows = (result.data ?? []) as unknown as ProductImageRow[]
  }
  return {
    counts: {
      products: productCount.count,
      activeProducts: activeProductCount.count,
      lowStock: variantCount.count,
      orders: orderCount.count,
      pendingOrders: pendingCount.count,
      users: userCount.count,
      favorites: favoriteCount.count,
    },
    orders: (ordersResult.data ?? []) as unknown as OrderRow[],
    products: products.map((product) => ({
      ...product,
      category_name: product.category_id ? categoryById.get(product.category_id) ?? '—' : '—',
      image: imageRows.find((image) => image.product_id === product.id && image.is_primary) ?? imageRows.find((image) => image.product_id === product.id) ?? null,
    })),
    hasErrors: [productCount.error, activeProductCount.error, variantCount.error, orderCount.error, pendingCount.error, userCount.error, favoriteCount.error, ordersResult.error, productsResult.error, categoriesResult.error].some(Boolean),
    catalogMissing: isMissingTable(productCount.error) || isMissingTable(categoriesResult.error),
  }
}
