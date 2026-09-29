'use client';

import React, { useState, useEffect, useCallback, useRef, useId } from 'react';
import { useCart } from '@/store/useCart';
import { Search, User, Heart, ShoppingBag, Menu, X, LogOut, ChevronDown, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import AccountModal from '@/components/AccountModal';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useStorefrontCatalog } from '@/context/StorefrontCatalogContext';

// Navigation Mode Definition for Adaptive UI
type NavigationMode = 'transparent' | 'solid' | 'dark' | 'adaptive';

interface NavigationProps {
  onNavigate?: (view: string) => void;
  introFinished?: boolean;
  initialMode?: NavigationMode;
}

export default function Navigation({ onNavigate, introFinished, initialMode = 'adaptive' }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const { items, openDrawer } = useCart();
  const { user, profile, signOut } = useAuth();
  const { categories, collections } = useStorefrontCatalog();
  const router = useRouter();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const drawerOpenerRef = useRef<HTMLElement | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const deferredMenuActionRef = useRef<'account' | 'cart' | null>(null);
  const drawerId = useId();
  const reduceMotion = useReducedMotion();
  const drawerTitleId = `${drawerId}-title`;
  const drawerCategoriesId = `${drawerId}-categories`;
  const drawerCollectionsId = `${drawerId}-collections`;
  const isAdmin = Boolean(user && user.id === adminUserId && hasAdminAccess);

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

  // This RPC only controls whether the convenience link is shown. /admin is
  // still protected by requireAdmin() and database RLS on the server.
  useEffect(() => {
    if (!user) {
      setAdminUserId(null);
      setHasAdminAccess(false);
      return;
    }

    let current = true;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('nrs_is_active_admin')
        if (!current) return
        setAdminUserId(user.id)
        setHasAdminAccess(!error && data === true)
      } catch {
        if (!current) return
        setAdminUserId(user.id)
        setHasAdminAccess(false)
      }
    })()

    return () => { current = false; };
  }, [user]);

  const categoryOrder = [
    { slugs: ['elbiseler', 'dresses'], names: ['elbiseler'], fallback: 'elbiseler', label: 'ELBİSELER' },
    { slugs: ['ust-giyim', 'tops'], names: ['üst giyim'], fallback: 'ust-giyim', label: 'ÜST GİYİM' },
    { slugs: ['ceketler-blazerlar', 'blazers'], names: ['ceketler & blazerlar'], fallback: 'ceketler-blazerlar', label: 'CEKETLER & BLAZERLAR' },
    { slugs: ['alt-giyim', 'bottoms'], names: ['alt giyim'], fallback: 'alt-giyim', label: 'ALT GİYİM' },
    { slugs: ['takimlar', 'suits'], names: ['takımlar'], fallback: 'takimlar', label: 'TAKIMLAR' },
  ];
  const categoryLinks = categoryOrder.map((item) => {
    const category = categories.find((entry) => item.slugs.includes(entry.slug) || item.names.includes(entry.name.toLocaleLowerCase('tr-TR')))
    return { name: category?.name.toLocaleUpperCase('tr-TR') ?? item.label, href: `/category/${category?.slug ?? item.fallback}` }
  });
  const collectionHref = (slug: string, fallback: string) => {
    const collection = collections.find((entry) => entry.slug === slug)
    return collection ? `/collections/${encodeURIComponent(collection.slug)}` : fallback
  };
  const navLinks = [
    { name: 'YENİ GELENLER', href: collectionHref('yeni-gelenler', '/') },
    ...categoryLinks,
    { name: 'KOLEKSİYONLAR', href: '/collections' },
    { name: 'SEÇKİLER', href: collectionHref('seckiler', '/curated') },
    { name: 'İNDİRİM', href: collectionHref('indirim', '/category/sale') },
  ];

  const openMenu = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    drawerOpenerRef.current = event.currentTarget;
    setIsMenuOpen(true);
  }, []);
  const closeMenu = useCallback((restoreFocus = false) => {
    setIsMenuOpen(false);
    if (restoreFocus) requestAnimationFrame(() => drawerOpenerRef.current?.focus());
  }, []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getAttribute('aria-hidden') !== 'true');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, closeMenu]);

  const handleNavClick = (href: string) => {
    closeMenu();
    router.push(href);
  };

  // Adaptive Style Logic
  const getNavStyles = () => {
    const solidPages = ['/profile', '/checkout', '/about', '/contact', '/shipping', '/returns', '/faq', '/size-guide', '/care-guide'];
    const isSolidPage = solidPages.some(page => pathname?.startsWith(page));

    if (isSolidPage || initialMode === 'solid' || isScrolled) {
      return {
        container: 'bg-nrs-ivory/95 backdrop-blur-md py-1 shadow-sm',
        text: 'text-nrs-black',
        logo: 'brightness-100',
        announcement: 'bg-nrs-black text-nrs-ivory'
      };
    }

    if (initialMode === 'dark') {
      return {
        container: 'bg-nrs-black/80 backdrop-blur-md py-2',
        text: 'text-nrs-ivory',
        logo: 'brightness-0 invert',
        announcement: 'bg-nrs-ivory text-nrs-black'
      };
    }

    if (initialMode === 'transparent' || (initialMode === 'adaptive' && pathname === '/')) {
      return {
        container: 'bg-transparent py-2',
        text: 'text-nrs-black',
        logo: 'brightness-100',
        announcement: 'bg-nrs-black text-nrs-ivory'
      };
    }

    return {
      container: 'bg-nrs-ivory py-1',
      text: 'text-nrs-black',
      logo: 'brightness-100',
      announcement: 'bg-nrs-black text-nrs-ivory'
    };
  };

  // Logic to handle the logo opacity for the home page intro
  const shouldShowLogo = () => {
    if (pathname !== '/') return true;
    if (introFinished) return true;

    // Check if intro has already been played in this session
    if (typeof window !== 'undefined' && sessionStorage.getItem('nrs-intro-played')) {
      return true;
    }
    return false;
  };

  const logoOpacity = shouldShowLogo() ? 'opacity-100' : 'opacity-0';

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
            <div className="hidden md:flex items-center justify-start gap-3 w-1/3">
              <button
                type="button"
                onClick={openMenu}
                aria-label="Menüyü aç"
                aria-haspopup="dialog"
                aria-expanded={isMenuOpen}
                aria-controls={drawerId}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center ${styles.text} opacity-70 transition-all duration-300 hover:opacity-100 hover:translate-x-0.5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2`}
              >
                <Menu size={21} strokeWidth={1.25} />
              </button>
              <button
                aria-label="Search"
                className={`p-2 ${styles.text} opacity-60 hover:opacity-100 transition-all duration-500 transform hover:scale-110`}
              >
                <Search size={18} strokeWidth={1} />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center w-1/3">
              <div className="flex justify-center relative">
                <Link href="/" className="flex flex-col items-center justify-center cursor-pointer group relative">
                  <Image
                    src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
                    alt="NRS Logo"
                    width={180}
                    height={72}
                    priority
                    data-intro-target="logo"
                    className={`h-16 md:h-24 w-auto object-contain transition-all duration-1000 group-hover:scale-105 ${styles.logo} ${logoOpacity}`}
                  />
                </Link>
              </div>
            </div>

            <div className="hidden md:flex items-center justify-end gap-6 w-1/3">
              <AccountControl
                user={user}
                profile={profile}
                isAdmin={isAdmin}
                textClass={styles.text}
                onSignIn={() => setIsAccountOpen(true)}
                onSignOut={signOut}
              />
              <button
                onClick={() => router.push('/profile#wishlist')}
                className={`p-2 ${styles.text} opacity-60 hover:opacity-100 transition-all duration-300`}
                aria-label="Favorilerim"
              >
                <Heart size={18} strokeWidth={1} />
              </button>
              <button
                onClick={openDrawer}
                className={`p-2 ${styles.text} opacity-60 hover:opacity-100 transition-all duration-300 relative`}
                aria-label="Alışveriş çantası"
              >
                <ShoppingBag size={18} strokeWidth={1} />
                {totalItems > 0 && <span className="absolute top-1 right-1 bg-nrs-black text-nrs-ivory text-[8px] w-3.5 h-3.5 flex items-center justify-center rounded-full font-light">{totalItems}</span>}
              </button>
            </div>

            <div className="flex md:hidden items-center justify-between w-full">
              <button
                type="button"
                onClick={openMenu}
                className={`inline-flex min-h-11 min-w-11 items-center justify-start transition-all duration-300 ${styles.text}`}
                aria-label="Menüyü aç"
                aria-haspopup="dialog"
                aria-expanded={isMenuOpen}
                aria-controls={drawerId}
              >
                <Menu size={22} strokeWidth={1.2} />
              </button>
              <Link href="/" className="cursor-pointer">
                <Image
                  src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
                  alt="NRS Logo"
                  width={180}
                  height={72}
                  className={`h-12 w-auto object-contain ${styles.logo}`}
                />
              </Link>
              <div className="flex items-center gap-2">
                <button className={`p-2 ${styles.text}`} aria-label="Search">
                  <Search size={20} strokeWidth={1} />
                </button>
                <AccountControl
                  user={user}
                  profile={profile}
                  isAdmin={isAdmin}
                  textClass={styles.text}
                  compact
                  onSignIn={() => setIsAccountOpen(true)}
                  onSignOut={signOut}
                />
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

          <div className="hidden md:flex justify-center gap-x-8 -mt-4">
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

        <AnimatePresence onExitComplete={() => {
          const action = deferredMenuActionRef.current;
          deferredMenuActionRef.current = null;
          if (action === 'account') setIsAccountOpen(true);
          if (action === 'cart') openDrawer();
        }}>
          {isMenuOpen && <>
            <motion.button
              type="button"
              aria-label="Menüyü kapat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.28, ease: 'easeOut' }}
              onClick={() => closeMenu(true)}
              className="fixed inset-0 z-[120] cursor-default bg-nrs-black/35 backdrop-blur-[2px]"
            />
            <motion.aside
              id={drawerId}
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={drawerTitleId}
              initial={{ x: reduceMotion ? 0 : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: reduceMotion ? 0 : '-100%' }}
              transition={{ duration: reduceMotion ? 0.1 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-[121] flex h-[100dvh] w-[92vw] max-w-[410px] flex-col border-r border-nrs-black/10 bg-nrs-ivory text-nrs-black shadow-[16px_0_50px_rgba(20,18,15,0.12)]"
            >
              <div className="flex items-start justify-between border-b border-nrs-black/10 px-7 pb-6 pt-8 sm:px-9">
                <div>
                  <h2 id={drawerTitleId} className="font-serif text-3xl tracking-[0.18em]">NRS</h2>
                  <p className="mt-2 text-[9px] uppercase tracking-[0.3em] text-nrs-black/45">Shop</p>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => closeMenu(true)}
                  aria-label="Menüyü kapat"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center text-nrs-black/55 transition-colors hover:text-nrs-black focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2"
                >
                  <X size={22} strokeWidth={1.2} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-7 py-7 sm:px-9">
                <section aria-labelledby={drawerCategoriesId}>
                  <h3 id={drawerCategoriesId} className="mb-4 text-[9px] uppercase tracking-[0.24em] text-nrs-black/40">Kategoriler</h3>
                  <nav className="space-y-1">
                    {categories.map((category) => <Link
                      key={category.id || category.slug}
                      href={`/category/${encodeURIComponent(category.slug)}`}
                      onClick={() => closeMenu()}
                      className="group flex min-h-11 items-center justify-between border-b border-nrs-black/[0.06] py-2 text-[15px] font-serif tracking-wide text-nrs-black/75 transition-all duration-300 hover:translate-x-1 hover:text-nrs-black focus-visible:outline focus-visible:outline-1"
                    >
                      <span>{category.name}</span><span className="text-xs opacity-0 transition-opacity group-hover:opacity-60">→</span>
                    </Link>)}
                  </nav>
                </section>

                <section aria-labelledby={drawerCollectionsId} className="mt-9">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 id={drawerCollectionsId} className="text-[9px] uppercase tracking-[0.24em] text-nrs-black/40">Collections</h3>
                    <Link href="/collections" onClick={() => closeMenu()} className="text-[9px] uppercase tracking-[0.15em] text-nrs-black/45 transition-colors hover:text-nrs-black">Tümünü gör</Link>
                  </div>
                  <nav className="space-y-1">
                    {collections.map((collection) => <Link
                      key={collection.id || collection.slug}
                      href={`/collections/${encodeURIComponent(collection.slug)}`}
                      onClick={() => closeMenu()}
                      className="group flex min-h-11 items-center justify-between border-b border-nrs-black/[0.06] py-2 text-[15px] font-serif tracking-wide text-nrs-black/75 transition-all duration-300 hover:translate-x-1 hover:text-nrs-black focus-visible:outline focus-visible:outline-1"
                    >
                      <span>{collection.name}</span><span className="text-xs opacity-0 transition-opacity group-hover:opacity-60">→</span>
                    </Link>)}
                  </nav>
                </section>
              </div>

              <div className="border-t border-nrs-black/10 px-5 py-4 sm:px-7">
                <nav aria-label="Hesap ve alışveriş" className="grid grid-cols-3 divide-x divide-nrs-black/10">
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        deferredMenuActionRef.current = 'account'
                        closeMenu()
                        return
                      }
                      closeMenu()
                      router.push('/profile')
                    }}
                    className="flex min-h-14 flex-col items-center justify-center gap-1.5 px-2 text-[9px] uppercase tracking-[0.12em] text-nrs-black/65 transition-colors hover:text-nrs-black focus-visible:outline focus-visible:outline-1"
                  ><User size={16} strokeWidth={1.2} />Hesabım</button>
                  <Link href="/profile#wishlist" onClick={() => closeMenu()} className="flex min-h-14 flex-col items-center justify-center gap-1.5 px-2 text-[9px] uppercase tracking-[0.12em] text-nrs-black/65 transition-colors hover:text-nrs-black focus-visible:outline focus-visible:outline-1">
                    <Heart size={16} strokeWidth={1.2} />Favoriler
                  </Link>
                  <button type="button" onClick={() => { deferredMenuActionRef.current = 'cart'; closeMenu() }} className="relative flex min-h-14 flex-col items-center justify-center gap-1.5 px-2 text-[9px] uppercase tracking-[0.12em] text-nrs-black/65 transition-colors hover:text-nrs-black focus-visible:outline focus-visible:outline-1">
                    <ShoppingBag size={16} strokeWidth={1.2} />Sepet
                    {totalItems > 0 && <span className="absolute right-4 top-2 flex size-4 items-center justify-center rounded-full bg-nrs-black text-[8px] text-nrs-ivory">{totalItems}</span>}
                  </button>
                </nav>
                {isAdmin && <Link href="/admin" onClick={() => closeMenu()} className="mt-2 flex min-h-10 items-center justify-center text-[9px] uppercase tracking-[0.18em] text-nrs-black/45 transition-colors hover:text-nrs-black">Admin Paneli</Link>}
              </div>
            </motion.aside>
          </>}
        </AnimatePresence>
      </nav>
    </header>
  );
}

interface AccountControlProps {
  user: ReturnType<typeof useAuth>['user']
  profile: ReturnType<typeof useAuth>['profile']
  isAdmin: boolean
  textClass: string
  compact?: boolean
  onSignIn: () => void
  onSignOut: () => Promise<void>
}

function AccountControl({ user, profile, isAdmin, textClass, compact = false, onSignIn, onSignOut }: AccountControlProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverId = useId()
  const reduceMotion = useReducedMotion()
  const firstName = typeof profile?.first_name === 'string' ? profile.first_name.trim() : ''
  const lastName = typeof profile?.last_name === 'string' ? profile.last_name.trim() : ''
  const accountName = [firstName, lastName].filter(Boolean).join(' ') || user?.email?.split('@')[0] || 'Hesabım'

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!user) {
    return <button
      type="button"
      onClick={onSignIn}
      className={`inline-flex min-h-11 items-center gap-2 border-b border-transparent px-2 text-[10px] uppercase tracking-[0.2em] opacity-75 transition-opacity duration-300 hover:opacity-100 hover:border-current focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 ${textClass}`}
    >
      <span className="flex size-7 items-center justify-center rounded-full border border-current/30"><User size={15} strokeWidth={1.2} /></span>
      <span>Giriş Yap</span>
    </button>
  }

  return <div ref={containerRef} className="relative">
    <button
      ref={triggerRef}
      type="button"
      onClick={() => setIsOpen((open) => !open)}
      aria-label={`Hesap menüsünü ${isOpen ? 'kapat' : 'aç'}: ${accountName}`}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-controls={popoverId}
      className={`group inline-flex min-h-11 max-w-[190px] items-center gap-2 border-b border-transparent px-2 transition-colors duration-300 hover:border-current focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 ${textClass}`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-current/35 transition-colors duration-300 group-hover:border-current/70"><User size={16} strokeWidth={1.1} /></span>
      {!compact && <span className="max-w-[125px] truncate text-[11px] font-serif">{accountName}</span>}
      <ChevronDown size={13} className={`shrink-0 opacity-60 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      {compact && <span className="sr-only">Hesap</span>}
    </button>

    <AnimatePresence>
      {isOpen && <motion.div
        id={popoverId}
        role="dialog"
        aria-label="Hesap menüsü"
        initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: reduceMotion ? 0 : 4, scale: 1 }}
        transition={{ duration: reduceMotion ? 0.1 : 0.18, ease: 'easeOut' }}
        className="absolute right-0 top-full z-[120] mt-3 w-[min(20rem,calc(100vw-2rem))] overflow-hidden border border-[#DCD6CA] bg-nrs-ivory text-nrs-black shadow-[0_12px_36px_rgba(25,22,18,0.12)]"
      >
        <div className="border-b border-nrs-black/10 px-5 py-5">
          <p className="mb-2 text-[9px] uppercase tracking-[0.24em] text-nrs-black/45">Hesap</p>
          <p className="truncate font-serif text-lg leading-tight">{accountName}</p>
          {user.email && <a href={`mailto:${user.email}`} className="mt-1 block truncate text-xs text-nrs-black/55 hover:text-nrs-black focus-visible:outline focus-visible:outline-1">{user.email}</a>}
        </div>
        <div className="px-2 py-3">
          <p className="px-3 pb-2 text-[9px] uppercase tracking-[0.2em] text-nrs-black/40">Hesabım</p>
          <AccountLink href="/profile" onClick={() => setIsOpen(false)}>Profilim</AccountLink>
          <AccountLink href="/profile#orders" onClick={() => setIsOpen(false)}>Siparişlerim</AccountLink>
          <AccountLink href="/profile#wishlist" onClick={() => setIsOpen(false)}>Favorilerim</AccountLink>
        </div>
        {isAdmin && <div className="border-t border-nrs-black/10 px-2 py-3">
          <p className="px-3 pb-2 text-[9px] uppercase tracking-[0.2em] text-nrs-black/40">Yönetim</p>
          <AccountLink href="/admin" onClick={() => setIsOpen(false)}><span className="flex items-center gap-2"><ShieldCheck size={15} strokeWidth={1.4} />Admin Paneli</span></AccountLink>
        </div>}
        <div className="border-t border-nrs-black/10 p-2">
          <button
            type="button"
            onClick={async () => { setIsOpen(false); await onSignOut() }}
            className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm text-nrs-black/65 transition-colors hover:bg-nrs-black/[0.035] hover:text-nrs-black focus-visible:outline focus-visible:outline-1"
          >
            <LogOut size={15} strokeWidth={1.4} />Çıkış Yap
          </button>
        </div>
      </motion.div>}
    </AnimatePresence>
  </div>
}

function AccountLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return <Link href={href} onClick={onClick} className="flex min-h-11 items-center px-3 text-sm text-nrs-black/75 transition-colors hover:bg-nrs-black/[0.035] hover:text-nrs-black focus-visible:outline focus-visible:outline-1">
    {children}
  </Link>
}
