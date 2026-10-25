import { parsePrice, type Item } from '@/store/useCart'
import { META_PIXEL_ID } from '@/components/MetaPixel'

type MetaContent = { id: string; quantity: number; item_price: number }

/** Sends a standard commerce event only when MetaPixel has already loaded,
 * which happens solely after advertising consent and outside checkout and
 * profile pages. content_ids are catalogue product IDs (see meta-product-feed). */
function track(event: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase', contents: MetaContent[], name?: string,
  options: { value?: number; eventID?: string } = {}) {
  if (typeof window === 'undefined' || !window.fbq || !contents.length) return
  const value = options.value ?? Math.round(contents.reduce((sum, item) => sum + item.item_price * item.quantity, 0) * 100) / 100
  try {
    window.fbq('trackSingle', META_PIXEL_ID, event, {
      content_ids: contents.map(item => item.id), content_type: 'product', contents,
      num_items: contents.reduce((sum, item) => sum + item.quantity, 0), value, currency: 'TRY',
      ...(name ? { content_name: name } : {}),
    }, ...(options.eventID ? [{ eventID: options.eventID }] : []))
  } catch { /* measurement must never break shopping */ }
}

/** Runs callback once MetaPixel has set up window.fbq. On page load the pixel
 * initialises in its own effect, after the page's effects, so events fired
 * on mount must wait. Gives up after 10s (no consent means no pixel).
 * Returns a cancel function for effect cleanup. */
export function whenPixelReady(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  if (window.fbq) { callback(); return () => {} }
  let attempts = 0
  const timer = window.setInterval(() => {
    attempts += 1
    if (window.fbq) { window.clearInterval(timer); callback() }
    else if (attempts >= 40) window.clearInterval(timer)
  }, 250)
  return () => window.clearInterval(timer)
}

export function trackViewContent(product: { id: string; name: string; priceAmount?: number | null; price: string }) {
  return whenPixelReady(() =>
    track('ViewContent', [{ id: product.id, quantity: 1, item_price: product.priceAmount ?? parsePrice(product.price) }], product.name))
}

export function trackAddToCart(product: { id: string; name: string; priceAmount?: number | null; price: string }, quantity: number) {
  track('AddToCart', [{ id: product.id, quantity, item_price: product.priceAmount ?? parsePrice(product.price) }], product.name)
}

export function trackInitiateCheckout(items: Pick<Item, 'id' | 'price' | 'quantity'>[]) {
  track('InitiateCheckout', items.map(item => ({ id: item.id, quantity: item.quantity, item_price: parsePrice(item.price) })))
}

/** value is the paid order total in TRY; the order ID lets Meta drop duplicates. */
export function trackPurchase(orderId: string, items: { productId: string; quantity: number; unitPrice: number }[], total: number) {
  track('Purchase', items.map(item => ({ id: item.productId, quantity: item.quantity, item_price: item.unitPrice })), undefined,
    { value: total, eventID: `order-${orderId}` })
}
