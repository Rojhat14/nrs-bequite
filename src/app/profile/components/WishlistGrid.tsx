'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Heart } from 'lucide-react';
import { m as motion } from 'framer-motion';
import { PRODUCTS, type Product } from '@/data/products';
import Image from 'next/image';
import Link from 'next/link';
import { getProductImageUrl } from '@/lib/storage/products';
import type { ProductImageRow } from '@/lib/admin/types';

export default function WishlistGrid() {
  const { user } = useAuth();
  const [wishlistProducts, setWishlistProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchWishlist = async () => {
      setLoading(true);
      setErrorMessage('');
      if (!user) {
        setWishlistProducts([]);
        setLoading(false);
        return;
      }
      try {
        const { data: wishlistData, error } = await supabase
          .from('wishlist')
          .select('product_id')
          .eq('user_id', user.id);

        if (error) throw error;

        const productIds = wishlistData?.map(item => item.product_id) || [];
        if (productIds.length === 0) {
          setWishlistProducts([]);
          return;
        }

        // Fetch product details from Supabase
        const { data: dbProducts, error: productsError } = await supabase
          .from('products')
          .select(`
            id,
            name,
            price_amount,
            currency,
            categories (name),
            product_images (id, product_id, provider, storage_key, url, alt_text, sort_order, is_primary, created_at)
          `)
          .in('id', productIds);
        if (productsError) throw productsError;

        const mappedDbProducts: Product[] = (dbProducts || []).map((p: any) => {
          const images = (p.product_images ?? []) as ProductImageRow[];
          const primaryImg = getProductImageUrl(supabase, images.find(img => img.is_primary) ?? images[0]);
          const currencySymbol = p.currency === 'TRY' || !p.currency ? '₺' : `${p.currency} `;
          return {
            id: p.id,
            name: p.name,
            category: p.categories?.name || 'Koleksiyon',
            price: `${currencySymbol}${Number(p.price_amount ?? 0).toLocaleString('en-US')}`,
            image: primaryImg || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=1000&auto=format&fit=crop',
            description: '',
            inStock: true,
            details: {
              fabric: '',
              care: '',
            },
          };
        });

        // Combine with fallback static products if any missing
        const combined: Product[] = [];
        for (const id of productIds) {
          const foundDb = mappedDbProducts.find(p => p.id === id);
          if (foundDb) {
            combined.push(foundDb);
          } else {
            const foundStatic = PRODUCTS.find(p => p.id === id);
            if (foundStatic) combined.push(foundStatic);
          }
        }

        setWishlistProducts(combined);
      } catch (err) {
        console.error('[Wishlist] Error fetching wishlist:', err);
        setErrorMessage('Favoriler yüklenemedi. Lütfen sayfayı yenileyerek tekrar deneyin.');
      } finally {
        setLoading(false);
      }
    };

    fetchWishlist();
  }, [user]);

  const toggleFavorite = async (productId: string) => {
    if (!user) return;

    // Optimistic Update
    const previousProducts = [...wishlistProducts];
    const updated = wishlistProducts.filter(p => p.id !== productId);
    setWishlistProducts(updated);

    try {
      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId);
      if (error) throw error;
    } catch (err) {
      console.error('Wishlist error:', err);
      setWishlistProducts(previousProducts);
    }
  };

  return (
    <div id="wishlist" className="space-y-8 scroll-mt-32">
      <div className="flex items-center gap-4">
        <Heart size={20} className="text-nrs-ink/60" />
        <h2 className="text-2xl font-serif italic text-nrs-ink">My Wishlist</h2>
      </div>

      {errorMessage ? <p role="alert" className="text-sm text-red-400">{errorMessage}</p> : loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-nrs-ink/20 border-t-nrs-ink rounded-full animate-spin" />
        </div>
      ) : wishlistProducts.length === 0 ? (
        <div className="text-center py-12 px-6 bg-nrs-panel/30 border border-dashed border-nrs-ink/20">
          <p className="text-sm text-nrs-ink/65 font-light italic">Your wishlist is currently empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {wishlistProducts.map((product) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group relative bg-nrs-panel border border-nrs-ink/10 p-4 hover:border-nrs-ink/30 transition-all duration-500"
            >
              <Link href={`/product/${product.id}`} className="block relative aspect-[3/4] overflow-hidden mb-4">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </Link>
              <div className="flex justify-between items-end">
                <div>
                  <Link href={`/product/${product.id}`}>
                    <h3 className="text-sm font-serif text-nrs-ink hover:text-nrs-rosegold transition-colors">{product.name}</h3>
                  </Link>
                  <p className="text-xs text-nrs-ink/60">{product.price}</p>
                </div>
                <button
                  onClick={() => toggleFavorite(product.id)}
                  className="p-2 text-red-500 hover:text-red-700 transition-colors"
                  aria-label="Favorilerden çıkar"
                >
                  <Heart size={16} fill="currentColor" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
