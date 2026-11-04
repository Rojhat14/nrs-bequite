'use client';

import Link from 'next/link';
import Image from 'next/image';
import { canOptimizeImage } from '@/lib/imageOptimization';
import { Heart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { lookupWishlist } from '@/lib/wishlistClient';
import { Product } from '@/data/products';
import { useState, useEffect } from 'react';
import { useLocale } from '@/context/LocaleContext';

interface ProductCardProps {
  product: Product;
  onProductClick?: (id: string) => void;
  sizes?: string;
}

export const ProductCard = ({ product, onProductClick, sizes = '(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 288px' }: ProductCardProps) => {
  const { user } = useAuth();
  const { locale, priceTag, t, fxAvailable } = useLocale();
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

  const href = `/product/${encodeURIComponent(product.slug || product.id)}`;

  return (
    <div className="group relative block bg-nrs-canvas">
      <div className="relative aspect-[2/3] overflow-hidden bg-nrs-warm-white">
        {product.image ? <div className="nrs-fade-in absolute inset-0" style={{ animationDuration: '0.5s' }}>
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes={sizes}
            loading="lazy"
            unoptimized={!canOptimizeImage(product.image)}
            className="object-cover object-top transition-transform duration-[1200ms] group-hover:scale-[1.025]"
          />
          {/* A second angle appears on hover where the product has one. */}
          {product.hoverImage && product.hoverImage !== product.image && <Image
            src={product.hoverImage}
            alt=""
            fill
            sizes={sizes}
            loading="lazy"
            unoptimized={!canOptimizeImage(product.hoverImage)}
            className="hidden object-cover object-top opacity-0 transition-opacity duration-700 group-hover:opacity-100 md:block"
          />}
        </div> : <div className="h-full w-full bg-nrs-panel" aria-hidden="true" />}

        <Link href={href} aria-label={`${product.name} ürününü incele`} className="absolute inset-0 z-10" />

        <button
          onClick={toggleWishlist}
          disabled={wishlistBusy}
          aria-label={isWishlisted ? 'Favorilerden çıkar' : 'Favorilere ekle'}
          aria-pressed={isWishlisted}
          className="absolute end-1.5 top-1.5 z-20 inline-flex h-11 w-11 items-center justify-center text-nrs-ink hover:opacity-60"
        >
          <Heart size={17} fill={isWishlisted ? 'currentColor' : 'none'} strokeWidth={1.2} />
        </button>
      </div>

      <div className="px-3 pb-5 pt-3 md:px-4">
        <h3 className="font-sans text-[14.5px] leading-snug text-nrs-ink">
          <Link href={href}>{product.name}</Link>
        </h3>
        <p className="mt-1 text-[13px] tabular-nums text-nrs-ink/60">
          {product.priceAmount == null ? product.price : priceTag(product.priceAmount)}
        </p>
        {locale !== 'tr' && !fxAvailable && <p className="mt-1 text-[10px] text-nrs-ink/50">{t('fxUnavailable')}</p>}
        {locale !== 'tr' && fxAvailable && <p className="mt-1 text-[10px] text-nrs-ink/50">{t('currencyNote')}</p>}
      </div>
    </div>
  );
};
