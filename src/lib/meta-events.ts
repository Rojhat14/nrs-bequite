import { parsePrice, type Item } from '@/store/useCart'
import { META_PIXEL_ID } from '@/components/MetaPixel'

type MetaContent = { id: string; quantity: number; item_price: number }

/** Sends a standard commerce event only when MetaPixel has already loaded,
 * which happens solely after advertising consent and outside checkout and
 * profile pages. content_ids are catalogue product IDs (see meta-product-feed). */
function track(event: 'ViewContent' | 'AddToCart' | 'InitiateCheckout', contents: MetaContent[], name?: string) {
  if (typeof window === 'undefined' || !window.fbq || !contents.length) return
  const value = Math.round(contents.reduce((sum, item) => sum + item.item_price * item.quantity, 0) * 100) / 100
  try {
    window.fbq('trackSingle', META_PIXEL_ID, event, {
      content_ids: contents.map(item => item.id), content_type: 'product', contents,
      num_items: contents.reduce((sum, item) => sum + item.quantity, 0), value, currency: 'TRY',
      ...(name ? { content_name: name } : {}),
    })
  } catch { /* measurement must never break shopping */ }
}

export function trackViewContent(product: { id: string; name: string; priceAmount?: number | null; price: string }) {
  track('ViewContent', [{ id: product.id, quantity: 1, item_price: product.priceAmount ?? parsePrice(product.price) }], product.name)
}

export function trackAddToCart(product: { id: string; name: string; priceAmount?: number | null; price: string }, quantity: number) {
  track('AddToCart', [{ id: product.id, quantity, item_price: product.priceAmount ?? parsePrice(product.price) }], product.name)
}

export function trackInitiateCheckout(items: Pick<Item, 'id' | 'price' | 'quantity'>[]) {
  track('InitiateCheckout', items.map(item => ({ id: item.id, quantity: item.quantity, item_price: parsePrice(item.price) })))
}
