import type { Metadata } from 'next';
import ProductListing from '@/components/ProductListing';
import { getStorefrontProducts } from '@/lib/products';

export const metadata: Metadata = { title: 'Ürün Ara | NRS', robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.trim().slice(0, 120) : '';
  const term = query.toLocaleLowerCase('tr-TR');
  const products = await getStorefrontProducts();
  const results = term ? products.filter(product => `${product.name} ${product.category} ${product.description}`.toLocaleLowerCase('tr-TR').includes(term)) : products;

  return <main className="mx-auto min-h-screen max-w-7xl px-6 pb-24 pt-[calc(var(--nrs-header-height)+2rem)]">
    <h1 className="mb-8 font-serif text-4xl">Ürün Ara</h1>
    <form action="/search" method="get" className="mb-12 flex gap-3">
      <label htmlFor="product-search-query" className="sr-only">Ürün adı veya kategori</label>
      <input id="product-search-query" name="q" type="search" maxLength={120} defaultValue={query} placeholder="Ürün adı veya kategori" className="min-w-0 flex-1 border-b border-nrs-ink/20 bg-transparent px-2 py-3" />
      <button type="submit" className="bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 px-6 py-3 text-sm text-nrs-ivory">Ara</button>
    </form>
    <ProductListing products={results} title={query ? `“${query}” sonuçları` : 'Tüm Ürünler'} />
  </main>;
}
