'use client';

import React, { useState, useEffect } from 'react';
import { useCart } from '@/store/useCart';
import { Search, User, Heart, ShoppingBag, Menu, X, LogOut } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
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
    { name: 'New In', href: '/' },
    { name: 'Dresses', href: '/category/dresses' },
    { name: 'Tops', href: '/category/tops' },
    { name: 'Bottoms', href: '/category/bottoms' },
    { name: 'Bedding', href: '/category/bedding' },
    { name: 'Accessories', href: '/category/accessories' },
    { name: 'About', href: '/about' },
    { name: 'Sale', href: '/category/sale' },
  ];

  const handleNavClick = (href: string) => {
    setIsMobileMenuOpen(false);
    window.location.href = href;
  };

  return (
    <header className="fixed top-0 w-full z-50">
      <AccountModal isOpen={isAccountOpen} onClose={() => setIsAccountOpen(false)} />
      {/* Announcement Bar */}
      <div className="bg-nrs-black text-nrs-ivory py-2 text-center text-[10px] uppercase tracking-[0.2em] font-sans">
        Free shipping on orders over 3.000 TL
      </div>

      {/* Main Header */}
      <nav className={`transition-all duration-700 ease-in-out ${
        isScrolled
          ? 'bg-nrs-ivory/80 backdrop-blur-lg py-3 shadow-sm'
          : 'bg-transparent py-6'
      }`}>
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex justify-between items-center">

            {/* Desktop Left: Search */}
            <div className="hidden md:flex items-center gap-6 w-1/3">
              <button className="p-2 text-nrs-black/70 hover:text-nrs-black transition-all duration-300 transform hover:scale-110">
                <Search size={18} strokeWidth={1.2} />
              </button>
            </div>

            {/* Center: Brand Area */}
            <div className="flex flex-col items-center justify-center w-1/3">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: introFinished ? 1 : 0 }}
                transition={{ delay: 0.5, duration: 1 }}
              >
                <Link
                  href="/"
                  className="flex flex-col items-center justify-center cursor-pointer group"
                >
                  <img
                    src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
                    alt="NRS Logo"
                    className="h-12 md:h-16 w-auto object-contain transition-transform duration-700 group-hover:scale-105"
                  />
                </Link>
              </motion.div>
            </div>

            {/* Desktop Right: Icons/User */}
            <div className="hidden md:flex items-center justify-end gap-6 w-1/3">
              {user ? (
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] uppercase tracking-widest text-nrs-black/60 font-light leading-none">
                      Welcome,
                    </span>
                    <Link
                      href="/profile"
                      className="text-[12px] font-serif italic text-nrs-black hover:text-nrs-black/70 transition-colors underline underline-offset-4 decoration-nrs-black/20"
                    >
                      {profile?.first_name || user.email?.split('@')[0]}
                    </Link>
                  </div>
                  <button
                    onClick={async () => {
                      await signOut();
                    }}
                    className="p-2 text-nrs-black/70 hover:text-red-600 transition-all duration-300 transform hover:scale-110"
                    title="Sign Out"
                  >
                    <LogOut size={18} strokeWidth={1.2} />
                  </button>
                  <button
                    onClick={() => router.push('/profile')}
                    className="p-2 text-nrs-black/70 hover:text-nrs-black transition-all duration-300 transform hover:scale-110 relative"
                  >
                    <Heart size={18} strokeWidth={1.2} />
                  </button>
                  <button
                    onClick={openDrawer}
                    className="p-2 text-nrs-black/70 hover:text-nrs-black transition-all duration-300 transform hover:scale-110 relative"
                  >
                    <ShoppingBag size={18} strokeWidth={1.2} />
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
                    className="p-2 text-nrs-black/70 hover:text-nrs-black transition-all duration-300 transform hover:scale-110"
                  >
                    <User size={18} strokeWidth={1.2} />
                  </button>
                  <button
                    onClick={() => router.push('/profile')}
                    className="p-2 text-nrs-black/70 hover:text-nrs-black transition-all duration-300 transform hover:scale-110 relative"
                  >
                    <Heart size={18} strokeWidth={1.2} />
                  </button>
                  <button
                    onClick={openDrawer}
                    className="p-2 text-nrs-black/70 hover:text-nrs-black transition-all duration-300 transform hover:scale-110 relative"
                  >
                    <ShoppingBag size={18} strokeWidth={1.2} />
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
                className="p-2 text-nrs-black"
              >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
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

              <div className="flex items-center gap-3">
                <button className="p-2 text-nrs-black">
                  <Search size={20} />
                </button>
                <button onClick={openDrawer} className="p-2 text-nrs-black relative">
                  <ShoppingBag size={20} />
                  {totalItems > 0 && (
                    <span className="absolute top-0 right-0 bg-nrs-rosegold text-nrs-ivory text-[9px] w-4 h-4 flex items-center justify-center rounded-full">
                      {totalItems}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex justify-center gap-12 mt-6">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => handleNavClick(link.href)}
                className="text-[10px] uppercase tracking-[0.3em] text-nrs-black/50 hover:text-nrs-black transition-all duration-500 font-sans relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-nrs-black transition-all duration-500 group-hover:w-full"></span>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div className={`fixed inset-0 top-0 bg-nrs-ivory z-40 transition-transform duration-500 ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        } md:hidden flex flex-col items-center justify-center gap-8`}>
          {navLinks.map((link) => (
            <button
              key={link.name}
              onClick={() => handleNavClick(link.href)}
              className="text-2xl font-serif text-nrs-black"
            >
              {link.name}
            </button>
          ))}
          <div className="flex gap-6 mt-8 text-nrs-black/60 text-xs uppercase tracking-widest">
            <button className="hover:text-s-black">Account</button>
            <button className="hover:text-nrs-black">Wishlist</button>
          </div>
        </div>
      </nav>
    </header>
  );
}
