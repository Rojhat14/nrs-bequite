'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

export default function Newsletter() {
  const pathname = usePathname();

  // Ürün detay veya admin sayfalarında newsletter'ı gizle
  if (pathname?.startsWith('/product/') || pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <section id="newsletter" className="py-24 bg-nrs-black text-nrs-ivory text-center px-6 scroll-mt-20">
      <div className="max-w-3xl mx-auto space-y-8">
        <h2 className="text-3xl md:text-4xl font-serif">NRS Özel Liste</h2>
        <p className="text-nrs-ivory/60 font-light text-lg">
          Yeni koleksiyonları, tesettür seçkisini ve sınırlı sayıdaki parçaları ilk keşfeden siz olun.
        </p>
        <p className="text-sm text-nrs-ivory/60">Bülten aboneliği yakında açılacak.</p>
      </div>
    </section>
  );
}
