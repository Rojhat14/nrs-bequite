'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export default function Newsletter() {
  const pathname = usePathname();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  // Ürün detay veya admin sayfalarında newsletter'ı gizle
  if (pathname?.startsWith('/product/') || pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <section id="newsletter" className="py-24 bg-nrs-black text-nrs-ivory text-center px-6 scroll-mt-20">
      <div className="max-w-3xl mx-auto space-y-8">
        <h2 className="text-3xl md:text-4xl font-serif">NRS Özel Liste</h2>
        <p className="text-nrs-ivory/60 font-light text-lg">
          Yeni koleksiyonları, özel davetleri ve sınırlı sayıdaki parçaları ilk keşfeden siz olun.
        </p>
        {subscribed ? (
          <div className="py-4 text-nrs-rosegold font-serif italic text-lg">
            Özel listemize kaydınız alındı. Hoş geldiniz.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email) setSubscribed(true);
            }}
            className="flex flex-col md:flex-row gap-4 justify-center items-center max-w-md mx-auto"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-posta adresinizi girin"
              className="w-full bg-transparent border-b border-nrs-ivory/30 py-3 px-2 focus:outline-none focus:border-nrs-rosegold transition-colors font-sans text-sm"
            />
            <button
              type="submit"
              className="w-full md:w-auto px-8 py-3 bg-nrs-ivory text-nrs-black uppercase tracking-widest text-xs font-sans hover:bg-nrs-rosegold transition-all duration-500 whitespace-nowrap"
            >
              Katıl
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

