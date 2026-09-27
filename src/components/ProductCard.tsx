'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShoppingBag, Heart } from 'lucide-react';
import { useCart } from '@/store/useCart';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Product } from '@/data/products';
import { useState, useEffect } from 'react';

interface ProductCardProps {
  product: Product;
  onProductClick?: (id: string) => void;
}

export const ProductCard = ({ product, onProductClick }: ProductCardProps) => {
  const { addItem, openDrawer } = useCart();
  const { user } = useAuth();
  const [isWishlisted, setIsWishlisted] = useState(false);

  useEffect(() => {
    const checkWishlist = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('wishlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .single();
      setIsWishlisted(!!data);
    };
    checkWishlist();
  }, [user, product.id]);

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      alert('Please sign in to add items to your wishlist.');
      return;
    }

    const prevStatus = isWishlisted;
    setIsWishlisted(!prevStatus);

    try {
      if (prevStatus) {
        await supabase
          .from('wishlist')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id);
      } else {
        await supabase
          .from('wishlist')
          .insert({ user_id: user.id, product_id: product.id });
      }
    } catch (error) {
      console.error('Wishlist error:', error);
      setIsWishlisted(prevStatus);
    }
  };

  return (
    <Link
      href={`/product/${product.id}`}
      className="group cursor-pointer block"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-nrs-black/5 mb-6">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all duration-500" />

        <button
          onClick={toggleWishlist}
          className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm rounded-full text-nrs-black hover:text-nrs-rosegold transition-colors z-10"
        >
          <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} strokeWidth={1.5} />
        </button>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addItem({ id: product.id, title: product.name, price: product.price, image: product.image });
            openDrawer();
          }}
          className="absolute bottom-4 right-4 p-3 bg-nrs-black text-nrs-ivory opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-2 group-hover:translate-y-0 rounded-full"
        >
          <ShoppingBag size={18} />
        </button>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] uppercase tracking-widest text-nrs-black/40 font-sans">
          {product.category}
        </span>
        <h3 className="text-xl font-serif text-nrs-black group-hover:text-nrs-rosegold transition-colors">
          {product.name}
        </h3>
        <p className="text-sm font-sans text-nrs-black/60">{product.price}</p>
      </div>
    </Link>
  );
};
