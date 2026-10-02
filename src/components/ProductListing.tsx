'use client';

import { useState } from 'react';
import type { Product } from '@/data/products';
import { parsePrice } from '@/store/useCart';
import { ProductCard } from '@/components/ProductCard';

export default function ProductListing({ products, title }: { products: Product[]; title: string }) {
  const [sort, setSort] = useState('featured');
  const sortedProducts = [...products];
  if (sort === 'price-asc' || sort === 'price-desc') {
    sortedProducts.sort((a, b) => (sort === 'price-asc' ? 1 : -1)
      * ((a.priceAmount ?? parsePrice(a.price)) - (b.priceAmount ?? parsePrice(b.price))));
  }

  return <>
    <div className="mb-12 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
      <div className="space-y-2">
        <h2 className="text-3xl font-serif tracking-tight">{title}</h2>
        <p className="text-nrs-black/40 font-light text-sm">{products.length} Parça Mevcut</p>
      </div>
      <select aria-label="Ürünleri sırala" value={sort} onChange={event => setSort(event.target.value)} className="max-w-full bg-transparent border-b border-nrs-black py-2 pr-8 font-light text-xs uppercase tracking-widest">
        <option value="featured">Öne Çıkanlar</option>
        <option value="price-asc">Fiyat: Artan</option>
        <option value="price-desc">Fiyat: Azalan</option>
        <option value="newest">Yeni Gelenler</option>
      </select>
    </div>
    {sortedProducts.length ? <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-3 sm:gap-x-8 gap-y-12 sm:gap-y-16">
      {sortedProducts.map(product => <ProductCard key={product.id} product={product} />)}
    </div> : <p className="py-24 text-center font-serif italic text-nrs-black/45">Bu seçkide henüz ürün bulunmuyor.</p>}
  </>;
}
