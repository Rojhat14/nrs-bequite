'use client';

import React, { useState, useEffect } from 'react';
import { useCart } from '@/store/useCart';
import { Search, User, Heart, ShoppingBag, Menu, X, LogOut } from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import AccountModal from '@/components/AccountModal';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface NavigationProps {
  onNavigate?: (view: string) => void;
  introFinished?: boolean;
}

export default function Navigation({ onNavigate, introFinished }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const { items, openDrawer } = useCart();
  const { user, profile, signOut } = useAuth();
  const router = useRouter();

  const totalItems = mounted ? items.reduce((sum, item) => sum + item.quantity, 0) : 0;

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'YENİ GELENLER', href: '/' },
    { name: 'ELBİSELER', href: '/category/dresses' },
    { name: 'ÜST GİYİM', href: '/category/tops' },
    { name: 'CEKETLER & BLAZERLAR', href: '/category/blazers' },
    { name: 'ALT GİYİM', href: '/category/bottoms' },
    { name: 'TAKIMLAR', href: '/category/suits' },
    { name: 'KOLEKSİYONLAR', href: '/collections' },
    { name: 'SEÇKİLER', href: '/curated' },
    { name: 'İNDİRİM', href: '/category/sale' },
  ];

  const handleNavClick = (href: string) => {
    setIsMobileMenuOpen(false);
    router.push(href);
  };

  return (
    <header className="fixed top-0 w-full z-50">
      <AccountModal isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} />

      {/* Announcement Bar - Minimal & Luxury */}
      <div className="bg-nrs-black text-nrs-ivory py-2 text-center text-[9px] uppercase tracking-[0.3em] font-sans">
        3.000 TL Üzeri Alışverişlerde Ücretsiz Kargo
      </div>

      {/* Main Header */}
      <nav className={`transition-all duration-1000 ease-in-out ${
        isScrolled
          ? 'bg-nrs-ivory/90 backdrop-blur-md py-3'
          : 'bg-transparent py-6'
      }`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex justify-between items-center">

            {/* Desktop Left: Search */}
            <div className="hidden md:flex items-center gap-8 w-1/3">
              <button className="p-2 text-nrs-black/60 hover:text-nrs-black transition-all duration-500 transform hover:scale-110">
                <Search size={18} strokeWidth={1} />
              </button>
            </div>

            {/* Center: Brand Area */}
            <div className="flex flex-col items-center justify-center w-1/3">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: introFinished ? 1 : 0, y: 0 }}
                transition={{ delay: 0.5, duration: 1.2 }}
              >
                <Link
                  href="/"
                  className="flex flex-col items-center justify-center cursor-pointer group"
                >
                  <img
                    src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
                    alt="NRS Logo"
                    className="h-12 md:h-16 w-auto object-contain transition-transform duration-1000 group-hover:scale-105"
                  />
                </Link>
              </motion.div>
            </div>

            {/* Desktop Right: Icons/User */}
            <div className="hidden md:flex items-center justify-end gap-8 w-1/3">
              {user ? (
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] uppercase tracking-widest text-nrs-black/40 font-light leading-none">
                      Hoş geldiniz,
                    </span>
                    <Link
                      href="/profile"
                      className="text-[12px] font-serif italic text-nrs-black hover:text-nrs-black/70 transition-colors underline underline-offset-4 decoration-nrs-black/10"
                    >
                      {profile?.first_name || user.email?.split('@')[0]}
                    </Link>
                  </div>
                  <button
                    onClick={async () => await signOut()}
                    className="p-2 text-nrs-black/40 hover:text-nrs-black transition-all duration-500 transform hover:scale-110"
                    title="Çıkış Yap"
                  >
                    <LogOut size={18} strokeWidth={1} />
                  </button>
                  <button
                    onClick={() => router.push('/profile')}
                    className="p-2 text-nrs-black/60 hover:text-nrs-black transition-all duration-500 transform hover:scale-110 relative"
                  >
                    <Heart size={18} strokeWidth={1} />
                  </button>
                  <button
                    onClick={openDrawer}
                    className="p-2 text-nrs-black/60 hover:text-nrs-black transition-all duration-500 transform hover:scale-110 relative"
                  >
                    <ShoppingBag size={18} strokeWidth={1} />
                    {totalItems > 0 && (
                      <span className="absolute top-1 right-1 bg-nrs-black text-nrs-ivory text-[8px] w-3.5 h-3.5 flex items-center justify-center rounded-full font-light">
                        {totalItems}
                      </span>
                    )}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setIsAccountOpen(true)}
                    className="p-2 text-nrs-black/60 hover:text-nrs-black transition-all duration-500 transform hover:scale-110"
                  >
                    <User size={18} strokeWidth={1} />
                  </button>
                  <button
                    onClick={() => router.push('/profile')}
                    className="p-2 text-nrs-black/60 hover:text-nrs-black transition-all duration-500 transform hover:scale-110 relative"
                  >
                    <Heart size={18} strokeWidth={1} />
                  </button>
                  <button
                    onClick={openDrawer}
                    className="p-2 text-nrs-black/60 hover:text-nrs-black transition-all duration-500 transform hover:scale-110 relative"
                  >
                    <ShoppingBag size={18} strokeWidth={1} />
                    {totalItems > 0 && (
                      <span className="absolute top-1 right-1 bg-nrs-black text-nrs-ivory text-[8px] w-3.5 h-3.5 flex items-center justify-center rounded-full font-light">
                        {totalItems}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Mobile Icons */}
            <div className="flex md:hidden items-center justify-between w-full">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-nrs-black transition-all duration-500"
              >
                {isMobileMenuOpen ? <X size={24} strokeWidth={1} /> : <Menu size={24} strokeWidth={1} />}
              </button>

              <Link
                href="/"
                className="cursor-pointer"
              >
                <img
                  src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
                  alt="NRS Logo"
                  className="h-10 w-auto object-contain"
                />
              </Link>

              <div className="flex items-center gap-2">
                <button className="p-2 text-nrs-black">
                  <Search size={20} strokeWidth={1} />
                </button>
                <button onClick={openDrawer} className="p-2 text-nrs-black relative">
                  <ShoppingBag size={20} strokeWidth={1} />
                  {totalItems > 0 && (
                    <span className="absolute top-0 right-0 bg-nrs-black text-nrs-ivory text-[9px] w-4 h-4 flex items-center justify-center rounded-full">
                      {totalItems}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links - Editorial Layout */}
          <div className="hidden md:flex justify-center gap-10 mt-8">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => handleNavClick(link.href)}
                className="text-[10px] uppercase tracking-[0.3em] text-nrs-black/40 hover:text-nrs-black transition-all duration-700 font-sans relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-nrs-black transition-all duration-700 group-hover:w-full"></span>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Navigation Menu - Premium Slide-in */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-0 top-0 bg-nrs-ivory z-40 md:hidden flex flex-col items-center justify-center gap-10"
            >
              {navLinks.map((link, index) => (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  key={link.name}
                  onClick={() => handleNavClick(link.href)}
                  className="text-2xl font-serif text-nrs-black tracking-wide"
                >
                  {link.name}
                </motion.button>
              ))}
              <div className="flex gap-8 mt-12 text-nrs-black/40 text-[10px] uppercase tracking-[0.3em] font-sans">
                <button onClick={() => setIsAccountOpen(true)} className="hover:text-nrs-black transition-colors">Hesabım</button>
                <button onClick={() => router.push('/profile')} className="hover:text-nrs-black transition-colors">Favoriler</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
