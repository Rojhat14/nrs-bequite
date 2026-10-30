import { parseMeasurements, type Measurements } from '@/lib/order-measurements'
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
  measurements?: Measurements
  category?: string
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
  activeCartVariants: Array<{ id: string; productId: string; size: string | null }>
  wishlist: string[]
  isDrawerOpen: boolean
  catalogPricesSynced: boolean
  catalogPricesSyncedFor: string | null
  /** True after every catalog price request for the current scope failed. */
  catalogSyncFailed: boolean
  priceUpdateNotice: boolean
  addItem: (product: NewCartItem, quantity?: number) => void
  syncCatalogPrices: (
    products: Array<{ id: string; title?: string; price: number; compareAtPrice: number | null }>,
    activeVariants?: Array<{ id: string; productId: string; size: string | null }>,
    syncScope?: string,
  ) => void
  setCatalogPricesSynced: (synced: boolean, syncScope?: string, failed?: boolean) => void
  replaceItemVariant: (cartItemId: string, variantId: string, size: string | undefined) => boolean
  removeItem: (cartItemId: string) => void
  updateMeasurements: (cartItemId: string, measurements: Measurements) => void
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
  const subtotalMinor = items.reduce((sum, item) => {
    const priceMinor = toMinorUnits(parsePrice(item.price))
    return sum + priceMinor * item.quantity
  }, 0)

  const subtotalAmount = fromMinorUnits(subtotalMinor)
  const discountAmount = 0
  // Confirmed business policy: shipping throughout Turkey is free.
  const shippingAmount = 0

  return {
    subtotalAmount,
    discountAmount,
    shippingAmount,
    totalAmount: fromMinorUnits(subtotalMinor + toMinorUnits(shippingAmount)),
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
      measurements: (() => { try { return parseMeasurements(candidate.measurements) } catch { return {} } })(),
      category: typeof candidate.category === 'string' ? candidate.category : undefined,
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
      activeCartVariants: [],
      wishlist: [],
      isDrawerOpen: false,
      catalogPricesSynced: false,
      catalogPricesSyncedFor: null,
      catalogSyncFailed: false,
      priceUpdateNotice: false,
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
                  title: product.title,
                  price: product.price,
                  compareAtPrice: product.compareAtPrice ?? null,
                  ...(!item.variantId && product.variantId ? { variantId: product.variantId } : {}),
                  // Newly entered measurements from the size finder replace older ones.
                  ...(product.measurements && Object.keys(product.measurements).length ? { measurements: product.measurements } : {}),
                  quantity: item.quantity + quantity,
                }
              : item)
            : [...state.items, { ...product, quantity }]

          return { items, ...calculateCartTotals(items) }
        })
      },

      syncCatalogPrices: (products, activeVariants = [], syncScope) => set((state) => {
        const current = new Map(products.map(product => [product.id, product]))
        const variantsByProduct = new Map<string, typeof activeVariants>()
        for (const variant of activeVariants) {
          const rows = variantsByProduct.get(variant.productId) ?? []
          rows.push(variant)
          variantsByProduct.set(variant.productId, rows)
        }
        let changed = false
        const items = state.items.map(item => {
          const product = current.get(item.id)
          const updates: Partial<Item> = {}
          if (product && Number.isFinite(product.price) && product.price >= 0) {
            updates.title = product.title || item.title
            updates.price = `₺${product.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
            updates.compareAtPrice = product.compareAtPrice
            if (parsePrice(item.price) !== product.price || Number(item.compareAtPrice ?? 0) !== Number(product.compareAtPrice ?? 0)) changed = true
          }

          // A persisted cart can outlive a catalog/variant update or a new auth
          // session. Keep its chosen size and line data, but refresh the FK only
          // when exactly one currently active variant has that exact size. Never
          // translate legacy sizes (for example S -> 36) or guess between rows.
          if (item.variantId) {
            const productVariants = variantsByProduct.get(item.id) ?? []
            const currentVariant = productVariants.find(variant => variant.id === item.variantId)
            if (!currentVariant && productVariants.length) {
              const wantedSize = item.size?.trim().toLocaleUpperCase('tr-TR') ?? null
              const matches = productVariants.filter(variant => {
                const activeSize = variant.size?.trim().toLocaleUpperCase('tr-TR') ?? null
                return activeSize === wantedSize
              })
              if (matches.length === 1) {
                updates.variantId = matches[0].id
              }
            }
          }

          return Object.keys(updates).length ? { ...item, ...updates } : item
        })
        return { items, activeCartVariants: activeVariants, ...calculateCartTotals(items), catalogPricesSynced: true, catalogPricesSyncedFor: syncScope ?? null, catalogSyncFailed: false, priceUpdateNotice: state.priceUpdateNotice || changed }
      }),

      setCatalogPricesSynced: (catalogPricesSynced, syncScope, failed = false) => set({ catalogPricesSynced, catalogPricesSyncedFor: syncScope ?? null, catalogSyncFailed: failed }),

      replaceItemVariant: (cartItemId, variantId, size) => {
        let replaced = false
        set(state => {
          const target = state.items.find(item => getCartItemId(item) === cartItemId)
          if (!target || state.items.some(item => item !== target && item.id === target.id && item.variantId === variantId)) return state
          replaced = true
          const items = state.items.map(item => item === target ? { ...item, variantId, ...(size ? { size } : { size: undefined }) } : item)
          return { items, ...calculateCartTotals(items) }
        })
        return replaced
      },

      removeItem: (cartItemId) => set((state) => {
        const items = state.items.filter((item) => getCartItemId(item) !== cartItemId)
        return { items, ...calculateCartTotals(items) }
      }),

      updateMeasurements: (cartItemId, measurements) => set(state => ({ items: state.items.map(item => getCartItemId(item) === cartItemId ? { ...item, measurements } : item) })),

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
      clearCart: () => set({ items: [], priceUpdateNotice: false, ...calculateCartTotals([]) }),
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
