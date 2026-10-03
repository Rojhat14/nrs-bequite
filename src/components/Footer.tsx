'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-nrs-canvas border-t border-nrs-ink/5 pt-20 pb-10 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">

          {/* Brand Section */}
          <div className="col-span-1 md:col-span-1 flex flex-col items-start space-y-6">
            <Link href="/" className="flex flex-col items-start group">
              <Image
                src="/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png"
                alt="NRS Logo"
                width={160}
                height={64}
                className="h-16 w-auto object-contain transition-transform duration-700 group-hover:scale-105"
              />
              <span className="text-[10px] uppercase tracking-[0.4em] font-sans text-nrs-ink/60 mt-4">
                Zarafetin Sanatı
              </span>
            </Link>
            <p className="text-sm text-nrs-ink/60 font-light leading-relaxed max-w-xs font-sans">
              Modern kadının özgün duruşu için tasarlanan rafine siluetler ve zamansız detaylar.
            </p>
          </div>

          {/* Shopping Section */}
          <div className="flex flex-col space-y-6">
            <h4 className="text-[11px] uppercase tracking-[0.2em] font-sans font-medium text-nrs-ink">
              Alışveriş
            </h4>
            <nav className="flex flex-col gap-3">
              {[
                { name: 'Yeni Gelenler', href: '/' },
                { name: 'Elbiseler', href: '/category/dresses' },
                { name: 'Üst Giyim', href: '/category/tops' },
                { name: 'Ceketler & Blazerlar', href: '/category/blazers' },
                { name: 'Alt Giyim', href: '/category/bottoms' },
                { name: 'Takımlar', href: '/category/suits' },
                { name: 'Koleksiyonlar', href: '/collections' },
                { name: 'Seçkiler', href: '/curated' },
                { name: 'İndirim', href: '/category/sale' },
              ].map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-sm text-nrs-ink/65 hover:text-nrs-ink transition-colors font-light font-sans"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* NRS Section */}
          <div className="flex flex-col space-y-6">
            <h4 className="text-[11px] uppercase tracking-[0.2em] font-sans font-medium text-nrs-ink">
              NRS
            </h4>
            <nav className="flex flex-col gap-3">
              {[
                { name: 'NRS Hakkında', href: '/about' },
                { name: 'NRS Kadını', href: '/about#woman' },
                { name: 'Atölye', href: '/about#atelier' },
                { name: 'Özel Liste', href: '/#newsletter' },
                { name: 'İletişim', href: '/contact' },
              ].map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-sm text-nrs-ink/65 hover:text-nrs-ink transition-colors font-light font-sans"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>

          {/* Customer Service Section */}
          <div className="flex flex-col space-y-6">
            <h4 className="text-[11px] uppercase tracking-[0.2em] font-sans font-medium text-nrs-ink">
              Müşteri Hizmetleri
            </h4>
            <nav className="flex flex-col gap-3">
              {[
                { name: 'Kargo & Teslimat', href: '/shipping' },
                { name: 'İade & Değişim', href: '/returns' },
                { name: 'Beden Rehberi', href: '/size-guide' },
                { name: 'Bakım Rehberi', href: '/care-guide' },
                { name: 'Sıkça Sorulan Sorular', href: '/faq' },
              ].map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-sm text-nrs-ink/65 hover:text-nrs-ink transition-colors font-light font-sans"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="pt-10 border-t border-nrs-ink/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-[10px] uppercase tracking-widest text-nrs-ink/30 font-sans">
            © {new Date().getFullYear()} NRS. Tüm Hakları Saklıdır.
          </p>
          <div className="flex gap-6">
            {/* Social icons would go here */}
            <span className="text-[10px] uppercase tracking-widest text-nrs-ink/30 font-sans transition-colors">
              Instagram
            </span>
            <span className="text-[10px] uppercase tracking-widest text-nrs-ink/30 font-sans transition-colors">
              Pinterest
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
