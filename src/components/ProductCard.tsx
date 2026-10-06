'use client';

import Link from 'next/link';
import Image from 'next/image';
import { canOptimizeImage } from '@/lib/imageOptimization';
import { m as motion } from 'framer-motion';
import { ShoppingBag, Heart } from 'lucide-react';
import { useCart } from '@/store/useCart';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { lookupWishlist } from '@/lib/wishlistClient';
import { Product } from '@/data/products';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ProductCardProps {
  product: Product;
  onProductClick?: (id: string) => void;
  sizes?: string;
}

export const ProductCard = ({ product, onProductClick, sizes = '(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 288px' }: ProductCardProps) => {
  const addItem = useCart(state => state.addItem);
  const openDrawer = useCart(state => state.openDrawer);
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const checkWishlist = async () => {
      setIsWishlisted(false);
      if (!userId) return;
      try {
        const favorite = await lookupWishlist(userId, product.id);
        if (active) setIsWishlisted(favorite);
      } catch {
        if (active) setIsWishlisted(false);
      }
    };
    checkWishlist();
    return () => { active = false; };
  }, [userId, product.id]);

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (wishlistBusy) return;

    if (!user) {
      alert('Lütfen favorilerinize eklemek için giriş yapın.');
      return;
    }

    const prevStatus = isWishlisted;
    setWishlistBusy(true);
    setIsWishlisted(!prevStatus);

    try {
      if (prevStatus) {
        const { error } = await supabase
          .from('wishlist')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('wishlist')
          .insert({ user_id: user.id, product_id: product.id });
        if (error) throw error;
      }
    } catch (error) {
      console.error('Wishlist error:', error);
      setIsWishlisted(prevStatus);
    } finally {
      setWishlistBusy(false);
    }
  };

  return (
    <div className="group cursor-pointer block">
      <div className="relative aspect-[3/4] overflow-hidden bg-nrs-black/5 mb-8">
        {product.image ? <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes={sizes}
            loading="lazy"
            unoptimized={!canOptimizeImage(product.image)}
            className="object-cover transition-transform duration-1000 group-hover:scale-105"
          />
        </motion.div> : <div className="h-full w-full bg-gradient-to-br from-nrs-black/5 to-nrs-black/10" aria-hidden="true" />}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-nrs-black/0 group-hover:bg-nrs-black/5 transition-all duration-700" />

        <Link
          href={`/product/${encodeURIComponent(product.slug || product.id)}`}
          aria-label={`${product.name} ürününü incele`}
          className="absolute inset-0 z-10"
        />

        {/* Wishlist Button - Refined */}
        <button
          onClick={toggleWishlist}
          disabled={wishlistBusy}
          aria-label={isWishlisted ? 'Favorilerden çıkar' : 'Favorilere ekle'}
          aria-pressed={isWishlisted}
          className="product-card-favorite absolute top-3 right-3 sm:top-5 sm:right-5 p-2.5 bg-white/90 backdrop-blur-md rounded-full text-nrs-black hover:text-nrs-rosegold transition-all duration-500 z-20 transform translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
        >
          <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} strokeWidth={1.2} />
        </button>

        {/* Quick Add Button - Minimal & Elegant */}
        <button
          disabled={!product.inStock}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (product.variants?.length) {
              router.push(`/product/${encodeURIComponent(product.slug || product.id)}`);
              return;
            }
            addItem({ id: product.id, slug: product.slug, title: product.name, price: product.price, image: product.image, compareAtPrice: product.compareAtPrice });
            openDrawer();
          }}
          className="product-card-quick-add absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 px-4 sm:px-6 py-3 bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory text-[10px] uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-700 transform translate-y-4 group-hover:translate-y-0 group-focus-within:translate-y-0 z-20"
        >
          İncele
        </button>
      </div>

      <div className="space-y-3 text-center md:text-left">
        <span className="text-[9px] uppercase tracking-[0.3em] text-nrs-ink/60 font-sans block">
          {product.category}
        </span>
        <h3 className="text-lg font-serif text-nrs-ink group-hover:text-nrs-rosegold transition-colors duration-500 leading-tight">
          <Link href={`/product/${encodeURIComponent(product.slug || product.id)}`}>{product.name}</Link>
        </h3>
        <p className="text-sm font-sans text-nrs-ink/60 font-light">
          {product.price}
        </p>
      </div>
    </div>
  );
};
