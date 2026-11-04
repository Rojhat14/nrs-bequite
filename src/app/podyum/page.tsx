import type { Metadata } from 'next'
import Catwalk, { type CatwalkLook } from '@/components/catwalk/Catwalk'
import { CATWALK_LOOKS } from '@/lib/catwalk-looks'
import { getStorefrontProducts } from '@/lib/products'

// Test page: reachable by direct link only. Not in the menu or the sitemap.
export const metadata: Metadata = {
  title: 'Podyum | NRS',
  robots: { index: false, follow: false },
}

export default async function PodyumPage() {
  const products = await getStorefrontProducts()
  const byId = new Map(products.map(product => [product.id, product]))
  // A piece that is removed or sold out drops out of its look, and a look with
  // no pieces left drops off the runway, so nobody meets a dead end.
  const looks: CatwalkLook[] = CATWALK_LOOKS.flatMap(look => {
    const pieces = look.pieces.flatMap(piece => {
      const product = byId.get(piece.id)
      return product?.inStock ? [{ product, x: piece.x, y: piece.y }] : []
    })
    return pieces.length ? [{ ...look, pieces }] : []
  })
  return <Catwalk looks={looks} />
}
