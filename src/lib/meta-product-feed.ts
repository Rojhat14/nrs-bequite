import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getProductImageUrl } from '@/lib/storage/products'
import type { ProductImageRow } from '@/lib/admin/types'

const PRODUCT_COLUMNS = 'id,name,slug,description,price_amount,currency,compare_at_price,in_stock'
const IMAGE_COLUMNS = 'id,product_id,provider,storage_key,url,sort_order,is_primary,created_at'
const VARIANT_COLUMNS = 'id,product_id,sku,stock_quantity,is_active'
const PAGE_SIZE = 500
const RELATION_BATCH_SIZE = 100
const HEADERS = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand', 'custom_label_0']

interface FeedProduct {
  id: string; name: string; slug: string; description: string | null
  price_amount: number | string; currency: string; compare_at_price: number | string | null; in_stock: boolean
}
interface FeedVariant { id: string; product_id: string; sku: string | null; stock_quantity: number; is_active: boolean }

export class MetaFeedError extends Error {}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function requiredText(value: unknown, field: string, id: string) {
  if (typeof value !== 'string' || !value.trim()) throw new MetaFeedError(`Missing ${field} for product ${id}.`)
  return value.trim()
}

// Public absolute image URLs only. Never resolve legacy/local fallback images.
function publicImageUrl(value: string) {
  if (value.startsWith('/')) return null
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]') {
      throw new Error('Invalid public image URL')
    }
    return url.href
  } catch {
    throw new MetaFeedError('Catalog contains an invalid public image URL.')
  }
}

async function relatedRows(client: SupabaseClient, table: 'product_images' | 'product_variants', ids: string[]) {
  const rows: Array<ProductImageRow | FeedVariant> = []
  let cursor: string | undefined
  for (;;) {
    let query = client.from(table).select(table === 'product_images' ? IMAGE_COLUMNS : VARIANT_COLUMNS)
      .in('product_id', ids).order('id').limit(PAGE_SIZE)
    if (table === 'product_variants') query = query.eq('is_active', true)
    if (cursor) query = query.gt('id', cursor)
    const { data, error } = await query
    if (error || !Array.isArray(data)) throw new MetaFeedError(`Unable to read ${table}.`)
    if (!data.length) return rows
    const page = data as unknown as Array<ProductImageRow | FeedVariant>
    const next = page[page.length - 1].id
    if (!next || next === cursor) throw new MetaFeedError(`Invalid pagination for ${table}.`)
    rows.push(...page)
    cursor = next
    // Continue even after short pages: Supabase's configured row cap may be lower.
  }
}

export async function createMetaProductFeed(client: SupabaseClient) {
  const csv = [HEADERS.join(',')]
  let cursor: string | undefined
  let included = 0
  let skippedImages = 0
  for (;;) {
    let query = client.from('products').select(PRODUCT_COLUMNS).eq('status', 'active').order('id').limit(PAGE_SIZE)
    if (cursor) query = query.gt('id', cursor)
    const { data, error } = await query
    if (error || !Array.isArray(data)) throw new MetaFeedError('Unable to read active products.')
    if (!data.length) break
    const products = data as unknown as FeedProduct[]
    const next = products[products.length - 1].id
    if (!next || next === cursor) throw new MetaFeedError('Invalid product pagination.')

    for (let offset = 0; offset < products.length; offset += RELATION_BATCH_SIZE) {
      const batch = products.slice(offset, offset + RELATION_BATCH_SIZE)
      const ids = batch.map(product => product.id)
      const [imageRows, variantRows] = await Promise.all([
        relatedRows(client, 'product_images', ids), relatedRows(client, 'product_variants', ids),
      ])
      const images = imageRows as ProductImageRow[]
      const variants = variantRows as FeedVariant[]
      for (const product of batch) {
        const candidates = images.filter(image => image.product_id === product.id).sort((a, b) =>
          Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order
          || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
        let imageLink: string | null = null
        for (const image of candidates) {
          const url = getProductImageUrl(client, image)
          if (url) imageLink = publicImageUrl(url)
          if (imageLink) break
        }
        if (!imageLink) { skippedImages++; continue }
        const id = requiredText(product.id, 'id', product.id)
        const name = requiredText(product.name, 'name', id)
        const slug = requiredText(product.slug, 'slug', id)
        const description = requiredText(product.description, 'description', id)
        const currency = requiredText(product.currency, 'currency', id).toUpperCase()
        const amount = typeof product.price_amount === 'number' ? product.price_amount
          : /^\d+(?:\.\d{1,2})?$/.test(product.price_amount) ? Number(product.price_amount) : NaN
        if (!Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
          throw new MetaFeedError(`Invalid price or currency for product ${id}.`)
        }
        try { new Intl.NumberFormat('en', { style: 'currency', currency }) } catch {
          throw new MetaFeedError(`Invalid currency for product ${id}.`)
        }
        if (typeof product.in_stock !== 'boolean') throw new MetaFeedError(`Invalid stock flag for product ${id}.`)
        const activeVariants = variants.filter(variant => variant.product_id === id && variant.is_active)
          .sort((a, b) => a.id.localeCompare(b.id))
        if (activeVariants.some(variant => !Number.isInteger(variant.stock_quantity) || variant.stock_quantity < 0)) {
          throw new MetaFeedError(`Invalid variant stock for product ${id}.`)
        }
        const inStock = activeVariants.length ? activeVariants.some(variant => variant.stock_quantity > 0) : product.in_stock
        const sku = activeVariants.find(variant => variant.sku?.trim())?.sku?.trim() || ''
        // price_amount is the current selling price, not minor units. Do not
        // reinterpret compare_at_price as the selling price or invent sale dates.
        csv.push([id, name, description, inStock ? 'in stock' : 'out of stock', 'new',
          `${amount.toFixed(2)} ${currency}`, `https://nrsbequiteluminous.com/product/${encodeURIComponent(slug)}`,
          imageLink, 'NRS Bequite Luminous', sku].map(csvCell).join(','))
        included++
      }
    }
    cursor = next
  }
  return { csv: `${csv.join('\r\n')}\r\n`, included, skippedImages }
}
