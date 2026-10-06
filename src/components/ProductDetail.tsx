'use client';

import React, { useState, useEffect, useRef } from 'react';
import { m as motion } from 'framer-motion';
import type { Product } from '@/data/products';
import { parsePrice, useCart } from '@/store/useCart';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { lookupWishlist } from '@/lib/wishlistClient';
import { ShoppingBag, Heart, ArrowLeft, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { whatsappNumber, whatsappUrl } from '@/lib/storefront-config';
import { buildWhatsappOrderMessage, whatsappSelectionError } from '@/lib/whatsapp-order';
import BankTransferInfo from '@/components/BankTransferInfo';
import WhatsAppIcon from '@/components/WhatsAppIcon';

interface ProductDetailProps {
  product: Product;
}

export default function ProductDetail({ product }: ProductDetailProps) {
  const addItem = useCart(state => state.addItem);
  const openDrawer = useCart(state => state.openDrawer);
  const { user } = useAuth();
  const userId = user?.id;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [orderError, setOrderError] = useState('');
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(() => {
    const primaryIndex = product.galleryImages?.findIndex((image) => image.isPrimary) ?? -1
    return Math.max(0, primaryIndex)
  });
  const [brokenImages, setBrokenImages] = useState<Set<number>>(() => new Set());
  const touchStartX = useRef<number | null>(null);
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

  const toggleWishlist = async () => {
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

  const variants = product.variants?.length
    ? product.variants.map((variant) => ({ id: variant.id, label: variant.size ?? 'Tek beden', size: variant.size, stock: variant.stock_quantity }))
    : product.catalogSource === 'legacy-fallback'
      ? ['XS', 'S', 'M', 'L', 'XL'].map((size) => ({ id: `legacy-${size}`, label: size, size, stock: product.inStock ? 1 : 0 }))
      : []
  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId)
  const galleryImages = product.galleryImages?.length
    ? product.galleryImages
    : product.image ? [{ url: product.image, altText: product.name, sortOrder: 0, isPrimary: true }] : []
  const primaryImageIndex = galleryImages.findIndex((image) => image.isPrimary)
  const activeImage = galleryImages[activeImageIndex]

  useEffect(() => {
    setActiveImageIndex(primaryImageIndex >= 0 ? primaryImageIndex : 0)
    setBrokenImages(new Set())
  }, [product.id, primaryImageIndex])

  function moveImage(direction: -1 | 1) {
    if (galleryImages.length < 2) return
    setActiveImageIndex((current) => (current + direction + galleryImages.length) % galleryImages.length)
  }

  function handleGalleryKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    moveImage(event.key === 'ArrowRight' ? 1 : -1)
  }

  function markImageBroken(index: number) {
    setBrokenImages((current) => new Set(current).add(index))
  }

  return (
    <div className="min-h-screen bg-nrs-canvas flex">
      <main className="w-full flex-1 pb-32">
        <div className="max-w-7xl mx-auto px-6 pt-[max(8rem,calc(var(--nrs-header-height)+1rem))] grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-7 min-w-0 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className={`product-gallery relative grid gap-3 ${galleryImages.length > 1 ? 'grid-cols-[3rem_minmax(0,1fr)] sm:grid-cols-[5rem_minmax(0,1fr)]' : 'grid-cols-1'}`}
              role="region"
              aria-label="Ürün görsel galerisi"
              tabIndex={galleryImages.length > 1 ? 0 : undefined}
              onKeyDown={handleGalleryKeyDown}
            >
              <div
                className="relative h-full min-h-0 min-w-0 overflow-hidden"
                onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null }}
                onTouchEnd={(event) => {
                  const startX = touchStartX.current
                  const endX = event.changedTouches[0]?.clientX
                  touchStartX.current = null
                  if (startX === null || endX === undefined || Math.abs(endX - startX) < 48) return
                  moveImage(endX < startX ? 1 : -1)
                }}
              >
              {activeImage && !brokenImages.has(activeImageIndex) ? (
                <Image
                  key={activeImage.url}
                  src={activeImage.url}
                  alt={activeImage.altText || product.name}
                  fill
                  priority={activeImageIndex === Math.max(0, primaryImageIndex)}
                  sizes="(max-width: 639px) calc(100vw - 108px), (max-width: 1023px) calc(100vw - 140px), (max-width: 1279px) 50vw, 590px"
                  className="object-contain"
                  onError={() => markImageBroken(activeImageIndex)}
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-nrs-black/5 to-nrs-black/10" role="img" aria-label="Görsel yüklenemedi" />
              )}
              {galleryImages.length > 1 && <>
                <button
                  type="button"
                  onClick={() => moveImage(-1)}
                  aria-label="Önceki ürün görseli"
                  className="absolute left-4 top-1/2 z-10 -translate-y-1/2 border border-white/70 bg-white/75 p-2.5 text-nrs-black shadow-sm backdrop-blur-sm transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nrs-ink"
                >
                  <ArrowLeft size={18} strokeWidth={1.4} />
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(1)}
                  aria-label="Sonraki ürün görseli"
                  className="absolute right-4 top-1/2 z-10 -translate-y-1/2 border border-white/70 bg-white/75 p-2.5 text-nrs-black shadow-sm backdrop-blur-sm transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nrs-ink"
                >
                  <ArrowRight size={18} strokeWidth={1.4} />
                </button>
              </>}
              <button
                onClick={toggleWishlist}
                disabled={wishlistBusy}
                className="absolute top-6 right-6 p-3 bg-white/80 backdrop-blur-sm rounded-full text-nrs-black hover:text-nrs-rosegold transition-colors z-10"
                aria-label={isWishlisted ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                aria-pressed={isWishlisted}
              >
                <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} strokeWidth={1.2} />
              </button>
              </div>

              {galleryImages.length > 1 && <div className="order-first flex min-h-0 flex-col gap-3 overflow-y-auto overflow-x-hidden">
                {galleryImages.map((image, index) => (
                  <button
                    type="button"
                    key={`${image.sortOrder}-${image.url}-${index}`}
                    onClick={() => setActiveImageIndex(index)}
                    aria-label={`${index + 1}. ürün görselini göster`}
                    aria-pressed={activeImageIndex === index}
                    className={`relative h-12 w-12 shrink-0 sm:h-20 sm:w-20 overflow-hidden border transition ${activeImageIndex === index ? 'border-nrs-ink opacity-100' : 'border-transparent opacity-65 hover:opacity-100'}`}
                  >
                    {!brokenImages.has(index) ? <Image
                      src={image.url}
                      alt={image.altText || `${product.name} — ${index + 1}`}
                      fill
                      sizes="(max-width: 639px) 48px, 80px"
                      className="object-contain"
                      onError={() => markImageBroken(index)}
                    /> : <span className="absolute inset-0 bg-gradient-to-br from-nrs-black/5 to-nrs-black/10" aria-hidden="true" />}
                  </button>
                ))}
              </div>}
            </motion.div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-start pt-12">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="space-y-10"
            >
              <div className="space-y-4">
                <span className="text-xs uppercase tracking-[0.3em] text-nrs-rosegold font-sans">
                  {product.category}
                </span>
                <h1 className="text-4xl md:text-6xl font-serif text-nrs-ink leading-tight tracking-tight">
                  {product.name}
                </h1>
                <div className="flex items-baseline gap-3">
                  <p className="text-2xl font-serif text-nrs-ink/80">{product.price}</p>
                  {product.compareAtPrice && product.compareAtPrice > (product.priceAmount ?? 0) && <del className="text-sm text-nrs-ink/60">{product.currency === 'TRY' || !product.currency ? '₺' : `${product.currency} `}{product.compareAtPrice.toLocaleString('en-US')}</del>}
                </div>
              </div>

              <div className="space-y-8 py-10 border-y border-nrs-ink/10">
                <div className="space-y-5">
                  {variants.length > 0 && <>
                  <p className="text-xs uppercase tracking-widest text-nrs-ink/60 font-sans">Beden Seçin</p>
                  <div className="flex flex-wrap gap-3">
                    {variants.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        disabled={variant.stock < 1}
                        onClick={() => { setSelectedVariantId(variant.id); setOrderError(''); setQuantity(1); }}
                        aria-pressed={selectedVariantId === variant.id}
                        className={`min-w-12 h-12 px-3 text-xs font-sans transition-all duration-500 border disabled:cursor-not-allowed disabled:opacity-35 ${
                          selectedVariantId === variant.id
                            ? 'bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory border-nrs-ink'
                            : 'bg-transparent text-nrs-ink border-nrs-ink/20 hover:border-nrs-ink'
                        }`}
                      >
                        {variant.label}
                      </button>
                    ))}
                  </div>
                  </>}
                </div>

                <div className="flex flex-col gap-4 pt-4">
                  <label className="flex items-center justify-between gap-4 text-xs text-nrs-ink/65">
                    Adet
                    <input type="number" min={1} value={quantity}
                      onChange={(event) => setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                      className="min-h-12 w-20 border border-nrs-ink/20 bg-transparent px-3 text-nrs-ink" />
                  </label>
                  <button
                    onClick={() => {
                      if (variants.length > 0 && !selectedVariant) {
                        alert('Lütfen bir beden seçin');
                        return;
                      }
                      if (selectedVariant && quantity > selectedVariant.stock) {
                        setOrderError('Seçilen adet için yeterli stok bulunmuyor.'); return;
                      }
                      addItem({
                        id: product.id,
                        slug: product.slug,
                        title: product.name,
                        price: product.price,
                        image: product.image,
                        size: selectedVariant?.size ?? undefined,
                        variantId: selectedVariant?.id,
                        compareAtPrice: product.compareAtPrice,
                      }, quantity);
                      openDrawer();
                    }}
                    disabled={!product.inStock || (variants.length > 0 && !selectedVariant)}
                    className="w-full bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 text-nrs-ivory py-5 uppercase tracking-widest text-xs font-sans enabled:hover:bg-white enabled:hover:text-nrs-ink transition-all duration-700 flex items-center justify-center gap-3"
                  >
                    <ShoppingBag size={18} />
                    Sepete Ekle
                  </button>
                  <button type="button" disabled={!product.inStock || !whatsappNumber}
                    aria-label={`${product.name} için WhatsApp'tan sipariş ver`}
                    aria-describedby={orderError ? 'whatsapp-order-error' : undefined}
                    onClick={() => {
                      const variant = selectedVariant || variants.find(variant => !variant.size);
                      const error = whatsappSelectionError({ requiresSize: variants.some(variant => Boolean(variant.size)),
                        selected: Boolean(selectedVariant), stock: variant?.stock, quantity });
                      if (error) { setOrderError(error); return; }
                      const message = buildWhatsappOrderMessage([{
                        id: product.id, slug: product.slug, name: product.name, size: variant?.size || undefined, quantity,
                        unitPrice: product.priceAmount ?? parsePrice(product.price), currency: product.currency,
                      }]);
                      const href = whatsappUrl(message || undefined);
                      if (href) { setOrderError(''); window.open(href, '_blank', 'noopener,noreferrer'); }
                    }}
                    className="flex min-h-12 w-full items-center justify-center gap-3 bg-[#25D366] px-4 py-5 uppercase tracking-widest text-xs text-nrs-ink enabled:hover:bg-[#20bd5a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                    <WhatsAppIcon />
                    WhatsApp&apos;tan Sipariş Ver
                  </button>
                  {orderError && <p id="whatsapp-order-error" role="alert" className="text-sm text-red-700">{orderError}</p>}
                  <BankTransferInfo />
                </div>
              </div>

              <div className="space-y-10">
                <div className="space-y-4">
                  <h3 className="text-xs uppercase tracking-widest text-nrs-ink font-medium">Ürün Hikayesi</h3>
                  <p className="text-nrs-ink/60 leading-relaxed font-sans italic">
                    {product.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6">
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase tracking-widest text-nrs-ink/60 font-bold">Detaylar</h4>
                    <ul className="text-sm font-sans text-nrs-ink/70 space-y-2">
                      {product.details.fabric && <li>{product.details.fabric}</li>}
                      {product.category && <li>{product.category}</li>}
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase tracking-widest text-nrs-ink/60 font-bold">Kalıp & Bakım</h4>
                    <p className="text-sm font-sans text-nrs-ink/70 leading-relaxed">{product.details.care || 'Bakım bilgisi yakında eklenecektir.'}</p>
                  </div>
                </div>

                <div className="pt-8 space-y-4">
                  <h4 className="text-[10px] uppercase tracking-widest text-nrs-ink/60 font-bold">Stil Önerisi</h4>
                  <p className="text-sm font-sans text-nrs-ink/70 italic leading-relaxed">
                    Ton sür ton bir pantolonla tamamlayarak güçlü bir takım görünümü yaratabilir veya sade bir elbisenin üzerine taşıyarak daha sofistike bir akşam görünümü elde edebilirsiniz.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
