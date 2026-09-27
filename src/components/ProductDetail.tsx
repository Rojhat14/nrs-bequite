'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Product } from '@/data/products';
import { useCart } from '@/store/useCart';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, Heart, ArrowLeft, Home } from 'lucide-react';
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

  const sizes = ['XS', 'S', 'M', 'L', 'XL'];

  return (
    <div className="min-h-screen bg-nrs-ivory flex">
      {/* LEFT SIDEBAR NAVIGATION - Refined Luxury */}
      <aside className="fixed left-0 top-0 h-full w-20 md:w-64 bg-white border-r border-nrs-black/5 flex flex-col items-center py-12 px-6 z-50">
        <div className="mb-12">
          <Link href="/" className="flex flex-col items-center gap-1">
            <Image
              src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
              alt="NRS Logo"
              width={56}
              height={56}
              className="h-10 md:h-14 w-auto object-contain"
            />
            <span className="hidden md:block text-[9px] uppercase tracking-[0.4em] font-sans text-nrs-black/40 mt-1 text-center">
              NRS
            </span>
          </Link>
        </div>

        <nav className="flex flex-col gap-6 w-full">
          <div className="space-y-1 mb-6">
            <p className="text-[10px] uppercase tracking-[0.3em] text-nrs-black/30 font-sans mb-4 px-2">Menü</p>
            {[
              { name: 'Ana Sayfa', href: '/', icon: <Home size={18} /> },
              { name: 'Elbiseler', href: '/category/dresses' },
              { name: 'Üst Giyim', href: '/category/tops' },
              { name: 'Ceketler & Blazerlar', href: '/category/blazers' },
              { name: 'Alt Giyim', href: '/category/bottoms' },
              { name: 'Takımlar', href: '/category/suits' },
              { name: 'Hakkımızda', href: '/about' },
              { name: 'İndirim', href: '/category/sale' },
            ].map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="flex items-center gap-4 text-nrs-black/40 hover:text-nrs-black transition-all duration-500 group py-2 px-2 rounded-sm"
              >
                {link.icon ? link.icon : <div className="w-4 h-4 border border-nrs-black/40 group-hover:border-nrs-black transition-colors" />}
                <span className="hidden md:block text-xs uppercase tracking-widest">{link.name}</span>
              </Link>
            ))}
          </div>

          <div className="space-y-1 border-t border-nrs-black/5 pt-6">
            <p className="text-[10px] uppercase tracking-[0.3em] text-nrs-black/30 font-sans mb-4 px-2">Hesap</p>
            <button
              onClick={openDrawer}
              className="flex items-center gap-4 text-nrs-black/40 hover:text-nrs-black transition-all duration-500 group py-2 px-2 rounded-sm w-full text-left relative"
            >
              <div className="relative">
                <ShoppingBag size={18} className="group-hover:scale-110 transition-transform" />
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-nrs-black text-nrs-ivory text-[8px] w-4 h-4 flex items-center justify-center rounded-full font-sans font-bold">
                    {totalItems}
                  </span>
                )}
              </div>
              <span className="hidden md:block text-xs uppercase tracking-widest">Sepet</span>
            </button>
          </div>
        </nav>

        <div className="mt-auto">
          <button
            onClick={onBack}
            className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-widest text-nrs-black/40 hover:text-nrs-black transition-colors"
          >
            <ArrowLeft size={14} />
            Koleksiyona Dön
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
                aria-label="Favorilere ekle"
              >
                <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} strokeWidth={1.2} />
              </button>
            </motion.div>

            <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="relative aspect-square bg-nrs-black/5 overflow-hidden group">
                  <Image
                    src={product.image}
                    alt={product.name + ' detay ' + i}
                    fill
                    className="object-cover opacity-60 group-hover:opacity-100 transition-opacity duration-700"
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
              className="space-y-10"
            >
              <div className="space-y-4">
                <span className="text-xs uppercase tracking-[0.3em] text-nrs-rosegold font-sans">
                  {product.category}
                </span>
                <h1 className="text-4xl md:text-6xl font-serif text-nrs-black leading-tight tracking-tight">
                  {product.name}
                </h1>
                <p className="text-2xl font-serif text-nrs-black/80">{product.price}</p>
              </div>

              <div className="space-y-8 py-10 border-y border-nrs-black/10">
                <div className="space-y-5">
                  <p className="text-xs uppercase tracking-widest text-nrs-black/40 font-sans">Beden Seçin</p>
                  <div className="flex flex-wrap gap-3">
                    {sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`w-12 h-12 text-xs font-sans transition-all duration-500 border ${
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

                <div className="flex flex-col gap-4 pt-4">
                  <button
                    onClick={() => {
                      if (!selectedSize) {
                        alert('Lütfen bir beden seçin');
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
                    className="w-full bg-nrs-black text-nrs-ivory py-5 uppercase tracking-widest text-xs font-sans hover:bg-nrs-charcoal transition-all duration-700 flex items-center justify-center gap-3"
                  >
                    <ShoppingBag size={18} />
                    Sepete Ekle
                  </button>
                  <a
                    href={`https://wa.me/905000000000?text=Merhaba! Şu ürünle ilgileniyorum:\n\nÜrün: ${product.name}\nBeden: ${selectedSize || 'Seçilmedi'}\nAdet: ${quantity}\n\nDetaylı bilgi alabilir miyim?`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-[#25D366] text-white py-5 uppercase tracking-widest text-xs font-sans hover:bg-[#128C7E] transition-all duration-700 flex items-center justify-center gap-3"
                  >
                    WhatsApp ile Sipariş
                  </a>
                </div>
              </div>

              <div className="space-y-10">
                <div className="space-y-4">
                  <h3 className="text-xs uppercase tracking-widest text-nrs-black font-medium">Ürün Hikayesi</h3>
                  <p className="text-nrs-black/60 leading-relaxed font-sans italic">
                    {product.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6">
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase tracking-widest text-nrs-black/40 font-bold">Detaylar</h4>
                    <ul className="text-sm font-sans text-nrs-black/70 space-y-2">
                      <li>• Yapılandırılmış siluet</li>
                      <li>• Özenli terzilik</li>
                      <li>• Rafine doku</li>
                      <li>• Modern kesim</li>
                    </ul>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] uppercase tracking-widest text-nrs-black/40 font-bold">Kalıp & Bakım</h4>
                    <p className="text-sm font-sans text-nrs-black/70 leading-relaxed">
                      Yapılandırılmış ve vücuda dengeli şekilde oturan kalıp. Kuru temizleme önerilir.
                    </p>
                  </div>
                </div>

                <div className="pt-8 space-y-4">
                  <h4 className="text-[10px] uppercase tracking-widest text-nrs-black/40 font-bold">Stil Önerisi</h4>
                  <p className="text-sm font-sans text-nrs-black/70 italic leading-relaxed">
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
