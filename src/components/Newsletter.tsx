'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export default function Newsletter() {
  const pathname = usePathname();

  // Ürün detay sayfalarında (/product/...) newsletter'ı gizle
  if (pathname?.startsWith('/product/')) {
    return null;
  }

  return (
    <section className="py-24 bg-nrs-black text-nrs-ivory text-center px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <h2 className="text-3xl md:text-4xl font-serif">NRS Private List</h2>
        <p className="text-nrs-ivory/60 font-light text-lg">
          Be the first to discover new collections, private events and exclusive pieces.
        </p>
        <div className="flex flex-col md:flex-row gap-4 justify-center items-center max-w-md mx-auto">
          <input
            type="email"
            placeholder="Enter your email address"
            className="w-full bg-transparent border-b border-nrs-ivory/30 py-3 px-2 focus:outline-none focus:border-nrs-rosegold transition-colors font-sans text-sm"
          />
          <button className="w-full md:w-auto px-8 py-3 bg-nrs-ivory text-nrs-black uppercase tracking-widest text-xs font-sans hover:bg-nrs-rosegold transition-all duration-500">
            Join
          </button>
        </div>
      </div>
    </section>
  );
}
