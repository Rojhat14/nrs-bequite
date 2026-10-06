import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Item {
  /** Product ID; retained for checkout/order compatibility. */
  id: string
  slug?: string
  title: string
  price: string
  compareAtPrice?: number | string | null
  quantity: number
  variantId?: string
  size?: string
  image?: string
}

type NewCartItem = Omit<Item, 'quantity'>

interface CartTotals {
  subtotalAmount: number
  discountAmount: number
  shippingAmount: number
  totalAmount: number
}

interface CartStore extends CartTotals {
  items: Item[]
  wishlist: string[]
  isDrawerOpen: boolean
  addItem: (product: NewCartItem, quantity?: number) => void
  removeItem: (cartItemId: string) => void
  updateQuantity: (cartItemId: string, quantity: number) => void
  toggleWishlist: (id: string) => void
  openDrawer: () => void
  closeDrawer: () => void
  clearCart: () => void
}

export const parsePrice = (priceStr: string | number): number => {
  if (typeof priceStr === 'number') return Number.isFinite(priceStr) ? priceStr : 0
  if (!priceStr) return 0
  const cleaned = priceStr.replace(/[^\d.,]/g, '')
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0
    }
    return Number(cleaned.replace(/,/g, '')) || 0
  }
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',')
    if (parts.length === 2 && parts[1].length === 3) return Number(parts.join('')) || 0
    return Number(cleaned.replace(',', '.')) || 0
  }
  if (cleaned.includes('.')) {
    const parts = cleaned.split('.')
    if (parts.length === 2 && parts[1].length === 3) return Number(parts.join('')) || 0
  }
  return Number(cleaned) || 0
}

function toMinorUnits(value: number) {
  return Math.round(value * 100)
}

function fromMinorUnits(value: number) {
  return value / 100
}

function getVariantIdentity(item: Pick<Item, 'variantId' | 'size'>) {
  if (item.variantId) return `variant:${item.variantId}`
  return item.size ? `size:${item.size.trim().toLocaleUpperCase('tr-TR')}` : 'no-variant'
}

export function getCartItemId(item: Pick<Item, 'id' | 'variantId' | 'size'>) {
  return `${item.id}::${getVariantIdentity(item)}`
}

function sameVariant(item: Item, incoming: NewCartItem) {
  if (item.id !== incoming.id) return false
  if (item.variantId && incoming.variantId) return item.variantId === incoming.variantId
  if (item.size && incoming.size) {
    return item.size.trim().toLocaleUpperCase('tr-TR') === incoming.size.trim().toLocaleUpperCase('tr-TR')
  }
  return !item.size && !incoming.size
}

function calculateCartTotals(items: Item[]): CartTotals {
  let subtotalMinor = 0
  let discountMinor = 0

  for (const item of items) {
    const priceMinor = toMinorUnits(parsePrice(item.price))
    const compareMinor = item.compareAtPrice == null
      ? priceMinor
      : Math.max(priceMinor, toMinorUnits(parsePrice(item.compareAtPrice)))
    subtotalMinor += compareMinor * item.quantity
    discountMinor += (compareMinor - priceMinor) * item.quantity
  }

  const subtotalAmount = fromMinorUnits(subtotalMinor)
  const discountAmount = fromMinorUnits(discountMinor)
  // The project has no configured cart shipping price. Keep current checkout
  // behavior and do not invent a fee; shipping remains zero until configured.
  const shippingAmount = 0

  return {
    subtotalAmount,
    discountAmount,
    shippingAmount,
    totalAmount: fromMinorUnits(subtotalMinor - discountMinor + toMinorUnits(shippingAmount)),
  }
}

function validQuantity(quantity: number) {
  return Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0
}

function restoreItems(value: unknown): Item[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Partial<Item>
    if (typeof candidate.id !== 'string' || typeof candidate.title !== 'string'
      || typeof candidate.price !== 'string' || typeof candidate.quantity !== 'number') return []
    const quantity = validQuantity(candidate.quantity)
    if (!quantity) return []
    return [{
      id: candidate.id,
      slug: typeof candidate.slug === 'string' ? candidate.slug : undefined,
      title: candidate.title,
      price: candidate.price,
      quantity,
      image: typeof candidate.image === 'string' ? candidate.image : undefined,
      size: typeof candidate.size === 'string' ? candidate.size : undefined,
      variantId: typeof candidate.variantId === 'string' ? candidate.variantId : undefined,
      compareAtPrice: typeof candidate.compareAtPrice === 'number' || typeof candidate.compareAtPrice === 'string' ? candidate.compareAtPrice : null,
    }]
  })
}

export const useCart = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      wishlist: [],
      isDrawerOpen: false,
      subtotalAmount: 0,
      discountAmount: 0,
      shippingAmount: 0,
      totalAmount: 0,

      addItem: (product, requestedQuantity = 1) => {
        const quantity = validQuantity(requestedQuantity)
        if (quantity === 0) return

        set((state) => {
          const existingItem = state.items.find((item) => sameVariant(item, product))
          const items = existingItem
            ? state.items.map((item) => sameVariant(item, product)
              ? {
                  ...item,
                  ...(!item.variantId && product.variantId ? { variantId: product.variantId } : {}),
                  quantity: item.quantity + quantity,
                }
              : item)
            : [...state.items, { ...product, quantity }]

          return { items, ...calculateCartTotals(items) }
        })
      },

      removeItem: (cartItemId) => set((state) => {
        const items = state.items.filter((item) => getCartItemId(item) !== cartItemId)
        return { items, ...calculateCartTotals(items) }
      }),

      updateQuantity: (cartItemId, requestedQuantity) => set((state) => {
        const quantity = validQuantity(requestedQuantity)
        const items = quantity === 0
          ? state.items.filter((item) => getCartItemId(item) !== cartItemId)
          : state.items.map((item) => getCartItemId(item) === cartItemId ? { ...item, quantity } : item)
        return { items, ...calculateCartTotals(items) }
      }),

      toggleWishlist: (id) => set((state) => ({
        wishlist: state.wishlist.includes(id)
          ? state.wishlist.filter((itemId) => itemId !== id)
          : [...state.wishlist, id],
      })),

      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      clearCart: () => set({ items: [], ...calculateCartTotals([]) }),
    }),
    {
      name: 'nrs-cart-storage',
      partialize: (state) => ({ items: state.items, wishlist: state.wishlist }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<CartStore> | undefined
        const items = persisted?.items === undefined ? currentState.items : restoreItems(persisted.items)
        const wishlist = Array.isArray(persisted?.wishlist) ? persisted.wishlist.filter((id): id is string => typeof id === 'string') : currentState.wishlist
        return {
          ...currentState,
          items,
          wishlist,
          ...calculateCartTotals(items),
        }
      },
    },
  ),
)
