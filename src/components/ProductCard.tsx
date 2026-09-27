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
      alert('Lütfen favorilerinize eklemek için giriş yapın.');
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
      <div className="relative aspect-[3/4] overflow-hidden bg-nrs-black/5 mb-8">
        <motion.img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-105"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-nrs-black/0 group-hover:bg-nrs-black/5 transition-all duration-700" />

        {/* Wishlist Button - Refined */}
        <button
          onClick={toggleWishlist}
          className="absolute top-5 right-5 p-2.5 bg-white/90 backdrop-blur-md rounded-full text-nrs-black hover:text-nrs-rosegold transition-all duration-500 z-10 transform translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
        >
          <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} strokeWidth={1.2} />
        </button>

        {/* Quick Add Button - Minimal & Elegant */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addItem({ id: product.id, title: product.name, price: product.price, image: product.image });
            openDrawer();
          }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-nrs-black text-nrs-ivory text-[10px] uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-all duration-700 transform translate-y-4 group-hover:translate-y-0 z-10"
        >
          İncele
        </button>
      </div>

      <div className="space-y-3 text-center md:text-left">
        <span className="text-[9px] uppercase tracking-[0.3em] text-nrs-black/40 font-sans block">
          {product.category}
        </span>
        <h3 className="text-lg font-serif text-nrs-black group-hover:text-nrs-rosegold transition-colors duration-500 leading-tight">
          {product.name}
        </h3>
        <p className="text-sm font-sans text-nrs-black/60 font-light">
          {product.price}
        </p>
      </div>
    </Link>
  );
};
