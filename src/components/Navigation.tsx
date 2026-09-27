'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useCart } from '@/store/useCart';
import { Search, User, Heart, ShoppingBag, Menu, X, LogOut } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import AccountModal from '@/components/AccountModal';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';

// Navigation Mode Definition for Adaptive UI
type NavigationMode = 'transparent' | 'solid' | 'dark' | 'adaptive';

interface NavigationProps {
  onNavigate?: (view: string) => void;
  introFinished?: boolean;
  initialMode?: NavigationMode;
}

export default function Navigation({ onNavigate, introFinished, initialMode = 'adaptive' }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const { items, openDrawer } = useCart();
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);

  const totalItems = mounted ? items.reduce((sum, item) => sum + item.quantity, 0) : 0;

  // Optimized Scroll Handler
  const handleScroll = useCallback(() => {
    const scrolled = window.scrollY > 20;
    setIsScrolled(scrolled);
  }, []);

  // Update Header Height CSS Variable
  const updateHeaderHeight = useCallback(() => {
    if (headerRef.current) {
      const height = headerRef.current.offsetHeight;
      document.documentElement.style.setProperty('--nrs-header-height', `${height}px`);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateHeaderHeight);

    // Initial height calculation
    setTimeout(updateHeaderHeight, 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, [handleScroll, updateHeaderHeight]);

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

  // Adaptive Style Logic
  const getNavStyles = () => {
    const solidPages = ['/profile', '/checkout', '/about', '/contact', '/shipping', '/returns', '/faq', '/size-guide', '/care-guide'];
    const isSolidPage = solidPages.some(page => pathname?.startsWith(page));

    if (isSolidPage || initialMode === 'solid' || isScrolled) {
      return {
        container: 'bg-nrs-ivory/95 backdrop-blur-md py-3 shadow-sm',
        text: 'text-nrs-black',
        logo: 'brightness-100',
        announcement: 'bg-nrs-black text-nrs-ivory'
      };
    }

    if (initialMode === 'dark') {
      return {
        container: 'bg-nrs-black/80 backdrop-blur-md py-4',
        text: 'text-nrs-ivory',
        logo: 'brightness-0 invert',
        announcement: 'bg-nrs-ivory text-nrs-black'
      };
    }

    if (initialMode === 'transparent' || (initialMode === 'adaptive' && pathname === '/')) {
      return {
        container: 'bg-transparent py-6',
        text: 'text-nrs-black',
        logo: 'brightness-100',
        announcement: 'bg-nrs-black text-nrs-ivory'
      };
    }

    return {
      container: 'bg-nrs-ivory py-4',
      text: 'text-nrs-black',
      logo: 'brightness-100',
      announcement: 'bg-nrs-black text-nrs-ivory'
    };
  };

  const styles = getNavStyles();

  return (
    <header
      ref={headerRef}
      className="fixed top-0 w-full z-[100]"
    >
      <AccountModal isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} />

      <div className={`${styles.announcement} py-2 text-center text-[9px] uppercase tracking-[0.3em] font-sans transition-colors duration-500`}>
        3.000 TL Üzeri Alışverişlerde Ücretsiz Kargo
      </div>

      <nav className={`transition-all duration-500 ease-in-out ${styles.container}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="flex justify-between items-center">
            <div className="hidden md:flex items-center justify-start w-1/3">
              <button
                aria-label="Search"
                className={`p-2 ${styles.text} opacity-60 hover:opacity-100 transition-all duration-500 transform hover:scale-110`}
              >
                <Search size={18} strokeWidth={1} />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center w-1/3">
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: introFinished ? 1 : 0, y: 0 }}
                transition={{ delay: 0.5, duration: 1.2 }}
                className="flex justify-center"
              >
                <Link href="/" className="flex flex-col items-center justify-center cursor-pointer group relative">
                  <Image
                    src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
                    alt="NRS Logo"
                    width={1680}
                    height={672}
                    priority
                    data-intro-target="logo"
                    className={`h-72 md:h-96 w-auto object-contain transition-all duration-1000 group-hover:scale-105 ${styles.logo} ${introFinished ? 'opacity-100' : 'opacity-0'}`}
                  />
                </Link>
              </motion.div>
            </div>

            <div className="hidden md:flex items-center justify-end gap-8 w-1/3">
              {user ? (
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-end">
                    <span className={`text-[9px] uppercase tracking-widest font-light leading-none ${styles.text} opacity-40`}>
                      Hoş geldiniz,
                    </span>
                    <Link
                      href="/profile"
                      className={`text-[12px] font-serif italic transition-colors underline underline-offset-4 decoration-nrs-black/10 ${styles.text}`}
                    >
                      {profile?.first_name || user.email?.split('@')[0]}
                    </Link>
                  </div>
                  <button
                    onClick={async () => await signOut()}
                    className={`p-2 ${styles.text} opacity-60 hover:opacity-100 transition-all duration-500 transform hover:scale-110`}
                    title="Çıkış Yap"
                    aria-label="Logout"
                  >
                    <LogOut size={18} strokeWidth={1} />
                  </button>
                  <button
                    onClick={() => router.push('/profile')}
                    className={`p-2 ${styles.text} opacity-60 hover:opacity-100 transition-all duration-500 transform hover:scale-110 relative`}
                    aria-label="Wishlist"
                  >
                    <Heart size={18} strokeWidth={1} />
                  </button>
                  <button
                    onClick={openDrawer}
                    className={`p-2 ${styles.text} opacity-60 hover:opacity-100 transition-all duration-500 transform hover:scale-110 relative`}
                    aria-label="Shopping Bag"
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
                    className={`p-2 ${styles.text} opacity-60 hover:opacity-100 transition-all duration-500 transform hover:scale-110`}
                    aria-label="Account"
                  >
                    <User size={18} strokeWidth={1} />
                  </button>
                  <button
                    onClick={() => router.push('/profile')}
                    className={`p-2 ${styles.text} opacity-60 hover:opacity-100 transition-all duration-500 transform hover:scale-110 relative`}
                    aria-label="Wishlist"
                  >
                    <Heart size={18} strokeWidth={1} />
                  </button>
                  <button
                    onClick={openDrawer}
                    className={`p-2 ${styles.text} opacity-60 hover:opacity-100 transition-all duration-500 transform hover:scale-110 relative`}
                    aria-label="Shopping Bag"
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

            <div className="flex md:hidden items-center justify-between w-full">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={`p-2 transition-all duration-500 ${styles.text}`}
                aria-label="Menu"
              >
                {isMobileMenuOpen ? <X size={24} strokeWidth={1} /> : <Menu size={24} strokeWidth={1} />}
              </button>
              <Link href="/" className="cursor-pointer">
                <Image
                  src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
                  alt="NRS Logo"
                  width={1170}
                  height={390}
                  className={`h-48 w-auto object-contain ${styles.logo}`}
                />
              </Link>
              <div className="flex items-center gap-2">
                <button className={`p-2 ${styles.text}`} aria-label="Search">
                  <Search size={20} strokeWidth={1} />
                </button>
                <button onClick={openDrawer} className={`p-2 ${styles.text} relative`} aria-label="Shopping Bag">
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

          <div className="hidden md:flex justify-center gap-x-10 mt-8">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => handleNavClick(link.href)}
                className={`text-[10px] uppercase tracking-[0.3em] ${styles.text} opacity-50 hover:opacity-100 transition-all duration-700 font-sans relative group whitespace-nowrap flex-shrink-0`}
              >
                {link.name}
                <span className={`absolute -bottom-1 left-0 w-0 h-px transition-all duration-700 group-hover:w-full ${styles.text === 'text-nrs-black' ? 'bg-nrs-black' : 'bg-nrs-ivory'}`}></span>
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-0 top-0 bg-nrs-ivory z-[110] md:hidden flex flex-col items-center justify-center gap-10"
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
