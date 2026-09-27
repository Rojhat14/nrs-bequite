import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Item {
  id: string
  title: string
  price: string
  quantity: number
  size?: string
  image?: string
}

interface CartStore {
  items: Item[]
  wishlist: string[]
  isDrawerOpen: boolean
  totalAmount: number
  addItem: (product: { id: string; title: string; price: string; image: string; size?: string }, quantity?: number) => void
  removeItem: (id: string) => void
  toggleWishlist: (id: string) => void
  openDrawer: () => void
  closeDrawer: () => void
  clearCart: () => void
}

const parsePrice = (priceStr: string): number => {
  const cleaned = priceStr.replace(/[^0-9.-]+/g, '')
  return Number(cleaned) || 0
}

export const useCart = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      wishlist: [],
      isDrawerOpen: false,
      totalAmount: 0,

      addItem: (product: { id: string; title: string; price: string; size?: string }, quantity = 1) =>
        set((state) => {
          const numericPrice = parsePrice(product.price)
          const existingItem = state.items.find(
            (i) => i.id === product.id && i.size === product.size
          )
          if (existingItem) {
            return {
              items: state.items.map((i) =>
                i.id === product.id && i.size === product.size
                  ? { ...i, quantity: i.quantity + quantity }
                  : i
              ),
              totalAmount: state.totalAmount + numericPrice * quantity,
            }
          }
          return {
            items: [...state.items, { ...product, quantity }],
            totalAmount: state.totalAmount + numericPrice * quantity,
          }
        }),

      removeItem: (id) =>
        set((state) => {
          const itemToRemove = state.items.find((i) => i.id === id)
          const itemTotal = itemToRemove
            ? parsePrice(itemToRemove.price) * itemToRemove.quantity
            : 0
          return {
            items: state.items.filter((i) => i.id !== id),
            totalAmount: Math.max(0, state.totalAmount - itemTotal),
          }
        }),

      toggleWishlist: (id) =>
        set((state) => ({
          wishlist: state.wishlist.includes(id)
            ? state.wishlist.filter((itemId) => itemId !== id)
            : [...state.wishlist, id],
        })),

      openDrawer: () => set({ isDrawerOpen: true }),
      closeDrawer: () => set({ isDrawerOpen: false }),
      clearCart: () => set({ items: [], totalAmount: 0 }),
    }),
    {
      name: 'nrs-cart-storage',
      partialize: (state) => ({ items: state.items, wishlist: state.wishlist, totalAmount: state.totalAmount }),
    }
  )
)
