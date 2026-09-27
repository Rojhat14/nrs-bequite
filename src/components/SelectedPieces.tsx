'use client';

import { ProductCard } from './ProductCard'
import { Product } from '@/data/products'

const SELECTED_PRODUCTS: Product[] = [
  {
    id: 'piece-1',
    name: 'The Sculpted Silk Scarf',
    category: 'Aksesuar',
    description: 'A refined silk scarf with hand-rolled edges, crafted from pure Italian silk.',
    image: 'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?q=80&w=2070&auto=format&fit=crop',
    price: '₺4,200',
    inStock: true,
    details: { fabric: 'Pure Italian Silk', care: 'Dry clean only' },
  },
  {
    id: 'piece-2',
    name: 'Midnight Wool Overcoat',
    category: 'Üst Giyim',
    description: 'A double-faced wool overcoat with clean, architectural silhouette.',
    image: 'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?q=80&w=2070&auto=format&fit=crop',
    price: '₺12,500',
    inStock: true,
    details: { fabric: 'Double-faced Wool', care: 'Professional dry clean' },
  },
  {
    id: 'piece-3',
    name: 'Architectural Cufflinks',
    category: 'Aksesuar',
    description: 'Minimalist cufflinks in brushed gold vermeil, inspired by modernist sculpture.',
    image: 'https://images.unsplash.com/photo-1573408301185-9519f94816b5?q=80&w=2070&auto=format&fit=crop',
    price: '₺3,800',
    inStock: true,
    details: { fabric: 'Gold Vermeil / Brass', care: 'Wipe with damp cloth' },
  },
  {
    id: 'piece-4',
    name: 'Ivory Cashmere Knit',
    category: 'Üst Giyim',
    description: 'A weightless cashmere knit in pure ivory, finished with hand-stitched detailing.',
    image: 'https://images.unsplash.com/photo-1516762689617-e1cffcef479d?q=80&w=2070&auto=format&fit=crop',
    price: '₺8,900',
    inStock: true,
    details: { fabric: 'Pure Cashmere', care: 'Dry clean only' },
  },
]

export default function SelectedPieces() {
  return (
    <section className="py-24 px-6 bg-white/50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-4">
          <div>
            <h2 className="font-serif text-4xl md:text-5xl mb-2">Selected Pieces</h2>
            <p className="text-nrs-gray max-w-md">
              A curated selection of our most-loved essentials. Each piece is crafted to endure.
            </p>
          </div>
          <button className="text-nrs-black border-b border-nrs-black pb-1 hover:border-nrs-black/50 transition-all duration-500">
            View All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
          {SELECTED_PRODUCTS.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
