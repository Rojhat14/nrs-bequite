import type { Metadata } from 'next'
import CartPageContent from '@/components/CartPageContent'

export const metadata: Metadata = { title: 'Sepet | NRS', robots: { index: false, follow: false } }

// The checkout header links back to /cart. The bag itself lives in the drawer,
// so this page opens it and offers the same next steps underneath.
export default function CartPage() {
  return <CartPageContent />
}
