'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Product } from '@/data/products';
import { parsePrice } from '@/store/useCart';
import { ProductCard } from '@/components/ProductCard';
import { useLocale } from '@/context/LocaleContext';
import { useStorefrontCatalog } from '@/context/StorefrontCatalogContext';
import { localePrefix } from '@/lib/i18n/messages';

export default function ProductListing({ products, title }: { products: Product[]; title: string }) {
  const { locale } = useLocale()
  const pathname = usePathname() || ''
  const { categories } = useStorefrontCatalog()
  const prefix = localePrefix(locale)
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
  const [sort, setSort] = useState('featured');
  const sortedProducts = [...products];
  if (sort === 'price-asc' || sort === 'price-desc') {
    sortedProducts.sort((a, b) => (sort === 'price-asc' ? 1 : -1)
      * ((a.priceAmount ?? parsePrice(a.price)) - (b.priceAmount ?? parsePrice(b.price))));
  }

  return <>
    <h2 className="sr-only">{title}</h2>
    <div className="sticky top-[var(--nrs-header-height)] z-30 flex items-center justify-between gap-4 border-y border-nrs-ink/10 bg-nrs-canvas/95 px-4 py-2 backdrop-blur-sm md:px-8">
      <nav aria-label={copy('Kategoriler', 'Categories', 'الفئات')} className="flex min-w-0 gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map(category => {
          const href = `${prefix}/category/${encodeURIComponent(category.slug)}`
          const current = pathname === href
          return <Link key={category.id || category.slug} href={href} aria-current={current ? 'page' : undefined}
            className={`inline-flex min-h-10 shrink-0 items-center border-b text-[13.5px] ${current ? 'border-nrs-ink text-nrs-ink' : 'border-transparent text-nrs-ink/55 hover:text-nrs-ink'}`}>{category.name}</Link>
        })}
      </nav>
      <label className="flex shrink-0 items-center gap-2 text-[13px] text-nrs-ink/60">
        <span className="hidden whitespace-nowrap sm:inline">{products.length} {copy('parça', 'pieces', 'قطعة')}</span>
        <select aria-label={copy('Ürünleri sırala', 'Sort products', 'ترتيب المنتجات')} value={sort} onChange={event => setSort(event.target.value)} className="max-w-[9.5rem] cursor-pointer bg-transparent py-2 text-[13px] text-nrs-ink">
          <option value="featured">{copy('Öne çıkanlar', 'Featured', 'مميزة')}</option>
          <option value="price-asc">{copy('Fiyat: artan', 'Price: low to high', 'السعر: من الأقل')}</option>
          <option value="price-desc">{copy('Fiyat: azalan', 'Price: high to low', 'السعر: من الأعلى')}</option>
          <option value="newest">{copy('Yeni gelenler', 'New arrivals', 'وصل حديثاً')}</option>
        </select>
      </label>
    </div>
    {sortedProducts.length ? <div className="nrs-grid">
      {sortedProducts.map(product => <ProductCard key={product.id} product={product} />)}
    </div> : <p className="py-24 text-center font-serif italic text-nrs-ink/60">{copy('Bu seçkide henüz ürün bulunmuyor.', 'No products are available in this selection yet.', 'لا توجد منتجات متاحة في هذه المجموعة حالياً.')}</p>}
  </>;
}
