'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Product } from '@/data/products';
import { useCart } from '@/store/useCart';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, Heart, ArrowLeft, Minus, Plus, Home } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface ProductDetailProps {
  product: Product;
  onBack: () => void;
}

export default function ProductDetail({ product, onBack }: ProductDetailProps) {
  const { addItem, openDrawer, items } = useCart();
  const { user } = useAuth();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

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

  const toggleWishlist = async () => {
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

  const sizes = ['XS', 'S', 'M', 'L', 'XL'];

  return (
    <div className="min-h-screen bg-nrs-ivory flex">
      {/* LEFT SIDEBAR NAVIGATION */}
      <aside className="fixed left-0 top-0 h-full w-20 md:w-64 bg-white border-r border-nrs-black/10 flex flex-col items-center py-12 px-6 z-50">
        <div className="mb-12">
          <Link href="/" className="flex flex-col items-center gap-1">
            <Image
              src="/images/logo.jpeg"
              alt="Boutique Luminous Logo"
              width={56}
              height={56}
              className="h-10 md:h-14 w-auto object-contain"
            />
            <span className="hidden md:block text-[9px] uppercase tracking-[0.4em] font-sans text-nrs-black/60 mt-1 text-center">
              Boutique Luminous
            </span>
          </Link>
        </div>

        <nav className="flex flex-col gap-6 w-full">
          <div className="space-y-1 mb-6">
            <p className="text-[10px] uppercase tracking-[0.3em] text-nrs-black/30 font-sans mb-4 px-2">Menu</p>
            <Link
              href="/"
              className="flex items-center gap-4 text-nrs-black/40 hover:text-nrs-black transition-colors group py-2 px-2 rounded-sm"
            >
              <Home size={18} className="group-hover:scale-110 transition-transform" />
              <span className="hidden md:block text-xs uppercase tracking-widest">Home</span>
            </Link>
            <Link
              href="/category/dresses"
              className="flex items-center gap-4 text-nrs-black/40 hover:text-nrs-black transition-colors group py-2 px-2 rounded-sm"
            >
              <div className="w-4 h-4 border border-nrs-black/40 group-hover:border-nrs-black transition-colors" />
              <span className="hidden md:block text-xs uppercase tracking-widest">Dresses</span>
            </Link>
            <Link
              href="/category/tops"
              className="flex items-center gap-4 text-nrs-black/40 hover:text-nrs-black transition-colors group py-2 px-2 rounded-sm"
            >
              <div className="w-4 h-4 border border-nrs-black/40 group-hover:border-nrs-black transition-colors" />
              <span className="hidden md:block text-xs uppercase tracking-widest">Tops</span>
            </Link>
            <Link
              href="/category/bottoms"
              className="flex items-center gap-4 text-nrs-black/40 hover:text-nrs-black transition-colors group py-2 px-2 rounded-sm"
            >
              <div className="w-4 h-4 border border-nrs-black/40 group-hover:border-nrs-black transition-colors" />
              <span className="hidden md:block text-xs uppercase tracking-widest">Bottoms</span>
            </Link>
            <Link
              href="/category/bedding"
              className="flex items-center gap-4 text-nrs-black/40 hover:text-nrs-black transition-colors group py-2 px-2 rounded-sm"
            >
              <div className="w-4 h-4 border border-nrs-black/40 group-hover:border-nrs-black transition-colors" />
              <span className="hidden md:block text-xs uppercase tracking-widest">Bedding</span>
            </Link>
            <Link
              href="/category/accessories"
              className="flex items-center gap-4 text-nrs-black/40 hover:text-nrs-black transition-colors group py-2 px-2 rounded-sm"
            >
              <div className="w-4 h-4 border border-nrs-black/40 group-hover:border-nrs-black transition-colors" />
              <span className="hidden md:block text-xs uppercase tracking-widest">Accessories</span>
            </Link>
            <Link
              href="/about"
              className="flex items-center gap-4 text-nrs-black/40 hover:text-nrs-black transition-colors group py-2 px-2 rounded-sm"
            >
              <div className="w-4 h-4 border border-nrs-black/40 group-hover:border-nrs-black transition-colors" />
              <span className="hidden md:block text-xs uppercase tracking-widest">About</span>
            </Link>
            <Link
              href="/category/sale"
              className="flex items-center gap-4 text-nrs-black/40 hover:text-nrs-black transition-colors group py-2 px-2 rounded-sm"
            >
              <div className="w-4 h-4 border border-nrs-black/40 group-hover:border-nrs-black transition-colors" />
              <span className="hidden md:block text-xs uppercase tracking-widest">Sale</span>
            </Link>
          </div>

          <div className="space-y-1 border-t border-nrs-black/5 pt-6">
            <p className="text-[10px] uppercase tracking-[0.3em] text-nrs-black/30 font-sans mb-4 px-2">Account</p>
            <button
              onClick={openDrawer}
              className="flex items-center gap-4 text-nrs-black/40 hover:text-nrs-black transition-colors group py-2 px-2 rounded-sm w-full text-left relative"
            >
              <div className="relative">
                <ShoppingBag size={18} className="group-hover:scale-110 transition-transform" />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-nrs-rosegold text-nrs-ivory text-[8px] w-4 h-4 flex items-center justify-center rounded-full font-sans font-bold">
                    {totalItems}
                  </span>
                )}
              </div>
              <span className="hidden md:block text-xs uppercase tracking-widest">Bag</span>
            </button>
          </div>
        </nav>

        <div className="mt-auto">
          <button
            onClick={onBack}
            className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-widest text-nrs-black/40 hover:text-nrs-black transition-colors"
          >
            <ArrowLeft size={14} />
            Back to collection
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-20 md:ml-64 pb-32">
        <div className="max-w-7xl mx-auto px-6 pt-32 grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-7 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="relative aspect-[3/4] overflow-hidden bg-nrs-black/5"
            >
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover"
                priority
              />
              <button
                onClick={toggleWishlist}
                className="absolute top-6 right-6 p-3 bg-white/80 backdrop-blur-sm rounded-full text-nrs-black hover:text-nrs-rosegold transition-colors"
                aria-label="Add to wishlist"
              >
                <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} strokeWidth={1.5} />
              </button>
            </motion.div>

            <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="relative aspect-square bg-nrs-black/5 overflow-hidden">
                  <Image
                    src={product.image}
                    alt={product.name + ' detail ' + i}
                    fill
                    className="object-cover opacity-60 hover:opacity-100 transition-opacity"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-start pt-12">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="space-y-8"
            >
              <div className="space-y-3">
                <span className="text-xs uppercase tracking-[0.3em] text-nrs-rosegold font-sans">
                  {product.category}
                </span>
                <h1 className="text-4xl md:text-6xl font-serif text-nrs-black leading-tight">
                  {product.name}
                </h1>
                <p className="text-2xl font-serif text-nrs-black/80">{product.price}</p>
              </div>

              <div className="space-y-6 py-8 border-y border-nrs-black/10">
                <div className="space-y-4">
                  <p className="text-xs uppercase tracking-widest text-nrs-black/40 font-sans">Select Size</p>
                  <div className="flex flex-wrap gap-3">
                    {sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`w-12 h-12 text-xs font-sans transition-all duration-300 border ${
                          selectedSize === size
                            ? 'bg-nrs-black text-nrs-ivory border-nrs-black'
                            : 'bg-transparent text-nrs-black border-nrs-black/20 hover:border-nrs-black'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <button
                    onClick={() => {
                      if (!selectedSize) {
                        alert('Please select a size');
                        return;
                      }
                      addItem({
                        id: product.id,
                        title: product.name,
                        price: product.price,
                        image: product.image,
                        size: selectedSize
                      }, quantity);
                      openDrawer();
                    }}
                    disabled={!selectedSize}
                    className="w-full bg-nrs-black text-nrs-ivory py-4 uppercase tracking-widest text-xs font-sans hover:bg-nrs-black/90 transition-all duration-300 flex items-center justify-center gap-3"
                  >
                    <ShoppingBag size={18} />
                    Add to Bag
                  </button>
                  <a
                    href={`https://wa.me/905000000000?text=Hello! I am interested in ordering the following product:\n\nProduct: ${product.name}\nSize: ${selectedSize || 'Not selected'}\nQuantity: ${quantity}\n\nCould you please provide more information?`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-[#25D366] text-white py-4 uppercase tracking-widest text-xs font-sans hover:bg-[#128C7E] transition-all duration-300 flex items-center justify-center gap-3"
                  >
                    Order via WhatsApp
                  </a>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xs uppercase tracking-widest text-nrs-black font-medium">Description</h3>
                  <p className="text-nrs-black/60 leading-relaxed font-sans italic">
                    {product.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-6">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-nrs-black/40">Fabric</p>
                    <p className="text-sm font-sans">Premium Italian Silk & Modal</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-nrs-black/40">Care</p>
                    <p className="text-sm font-sans">Dry Clean Only</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}
