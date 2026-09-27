'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/store/useCart';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, ShoppingBag, User } from 'lucide-react';
import Link from 'next/link';
import ProfileHeader from './components/ProfileHeader';
import OrderHistory from './components/OrderHistory';
import WishlistGrid from './components/WishlistGrid';

export default function ProfilePage() {
  const { user, profile, loading } = useAuth();
  const { openDrawer } = useCart();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-nrs-ivory flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-nrs-black/20 border-t-nrs-black rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-nrs-ivory flex">
      {/* LEFT SIDEBAR NAVIGATION - Consistent with Checkout */}
      <aside className="fixed left-0 top-0 h-full w-20 md:w-64 bg-white border-r border-nrs-black/10 flex flex-col items-center py-12 px-6 z-50">
        <div className="mb-12">
          <Link href="/" className="flex flex-col items-center gap-1">
            <img src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png" alt="Logo" className="h-10 md:h-14 w-auto object-contain" />
            <span className="hidden md:block text-[9px] uppercase tracking-[0.4em] font-sans text-nrs-black/60 mt-1 text-center">
              Boutique Luminous
            </span>
          </Link>
        </div>

        <nav className="flex flex-col gap-8 w-full">
          <Link
            href="/"
            className="flex items-center gap-4 text-nrs-black/40 hover:text-nrs-black transition-colors group"
          >
            <Home size={20} className="group-hover:scale-110 transition-transform" />
            <span className="hidden md:block text-xs uppercase tracking-widest">Home</span>
          </Link>
          <Link
            href="/profile"
            className="flex items-center gap-4 text-nrs-black hover:text-nrs-black transition-colors group"
          >
            <User size={20} className="group-hover:scale-110 transition-transform" />
            <span className="hidden md:block text-xs uppercase tracking-widest font-medium">My Account</span>
          </Link>
          <button
            onClick={openDrawer}
            className="flex items-center gap-4 text-nrs-black/40 hover:text-nrs-black transition-colors group"
          >
            <ShoppingBag size={20} className="group-hover:scale-110 transition-transform" />
            <span className="hidden md:block text-xs uppercase tracking-widest">Bag</span>
          </button>
        </nav>

        <div className="mt-auto">
          <button
            onClick={() => router.push('/')}
            className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-widest text-nrs-black/40 hover:text-nrs-black transition-colors"
          >
            <ArrowLeft size={14} />
            Return to Atelier
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT - Pushed to the right to make space for sidebar */}
      <main className="flex-1 ml-20 md:ml-64">
        <div className="max-w-4xl mx-auto py-20 px-8">
          <div className="mb-12">
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-nrs-black/40 hover:text-nrs-black transition-colors mb-6 group"
            >
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              Back to Atelier
            </button>
            <h1 className="font-serif text-4xl md:text-5xl mb-3 text-nrs-black">My Account</h1>
            <p className="text-nrs-black/50">Manage your personal details, view orders and your curated wishlist.</p>
          </div>

          <div className="space-y-20">
            <ProfileHeader profile={profile} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
              <OrderHistory />
              <WishlistGrid />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
