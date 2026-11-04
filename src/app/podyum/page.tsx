import type { Metadata } from 'next'
import Catwalk from '@/components/catwalk/Catwalk'
import { resolveCatwalkLooks } from '@/lib/catwalk-resolve'
import { getStorefrontProducts } from '@/lib/products'

export const metadata: Metadata = {
  title: 'NRS | Podyum',
  description: 'NRS görünümleri podyumda: her parçayı görün, bedeninizi seçin, görünümün tamamını sepete ekleyin.',
  alternates: { canonical: '/podyum' },
}

export default async function PodyumPage() {
  return <main><Catwalk looks={resolveCatwalkLooks(await getStorefrontProducts())} /></main>
}
