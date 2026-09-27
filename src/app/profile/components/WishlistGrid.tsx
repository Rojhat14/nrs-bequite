'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { PRODUCTS } from '@/data/products';
import Image from 'next/image';

export default function WishlistGrid() {
  const { user } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWishlist = async () => {
      console.log('[Wishlist Debug] Fetching wishlist for user:', user?.id);
      if (!user) {
        console.log('[Wishlist Debug] No user found, skipping fetch');
        return;
      }
      try {
        const { data, error } = await supabase
          .from('wishlist')
          .select('product_id')
          .eq('user_id', user.id);

        if (error) {
          console.error('[Wishlist Debug] Supabase Error:', error);
          throw error;
        }

        console.log('[Wishlist Debug] Data received from Supabase:', data);
        setWishlistItems(data?.map(item => item.product_id) || []);
      } catch (err) {
        console.error('[Wishlist Debug] Catch Block Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWishlist();
  }, [user]);

  const toggleFavorite = async (productId: string) => {
    if (!user) return;

    const isRemoving = wishlistItems.includes(productId);

    // Optimistic Update
    const updatedWishlist = isRemoving
      ? wishlistItems.filter(id => id !== productId)
      : [...wishlistItems, productId];

    setWishlistItems(updatedWishlist);

    try {
      if (isRemoving) {
        const { error } = await supabase
          .from('wishlist')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', productId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('wishlist')
          .insert({ user_id: user.id, product_id: productId });
        if (error) throw error;
      }
    } catch (err) {
      console.error('Wishlist error:', err);
      // Rollback on error
      setWishlistItems(wishlistItems);
    }
  };

  const favoritedProducts = PRODUCTS.filter(p => wishlistItems.includes(p.id));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Heart size={20} className="text-nrs-black/40" />
        <h2 className="text-2xl font-serif italic text-nrs-black">My Wishlist</h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-nrs-black/20 border-t-nrs-black rounded-full animate-spin" />
        </div>
      ) : favoritedProducts.length === 0 ? (
        <div className="text-center py-12 px-6 bg-white/30 border border-dashed border-nrs-black/20">
          <p className="text-sm text-nrs-black/50 font-light italic">Your wishlist is currently empty.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {favoritedProducts.map((product) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group relative bg-white border border-nrs-black/10 p-4 hover:border-nrs-black/30 transition-all duration-500"
            >
              <div className="relative aspect-[3/4] overflow-hidden mb-4">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-sm font-serif text-nrs-black">{product.name}</h3>
                  <p className="text-xs text-nrs-black/60">{product.price}</p>
                </div>
                <button
                  onClick={() => toggleFavorite(product.id)}
                  className="p-2 text-red-500 hover:text-red-700 transition-colors"
                >
                  <Heart size={16} fill={wishlistItems.includes(product.id) ? "currentColor" : "none"} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
