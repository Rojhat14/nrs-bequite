import type { CatwalkLook } from '@/components/catwalk/Catwalk'
import type { Product } from '@/data/products'
import { CATWALK_LOOKS } from '@/lib/catwalk-looks'

/** A piece that is removed or sold out drops out of its look, and a look with
 * no pieces left drops off the runway, so nobody meets a dead end. Some older
 * products have an ID that differs from their slug, so match both. */
export function resolveCatwalkLooks(products: Product[]): CatwalkLook[] {
  const find = (key: string) => products.find(product => product.id === key || product.slug === key)
  return CATWALK_LOOKS.flatMap(look => {
    const pieces = look.pieces.flatMap(piece => {
      const product = find(piece.id)
      return product?.inStock ? [{ product, x: piece.x, y: piece.y }] : []
    })
    return pieces.length ? [{ ...look, pieces }] : []
  })
}
