import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { contactEmail, contactPhone, contactPhoneLabel, contactAddress, whatsappUrl } from '@/lib/storefront-config';
import { getLegalDocument, LEGAL_ROUTES } from '@/lib/legal/documents';

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
            <address className="space-y-3 text-sm leading-6 not-italic text-nrs-ink/65 break-words">
              {contactEmail && <a className="block break-all hover:text-nrs-ink" href={`mailto:${contactEmail}`}>{contactEmail}</a>}
              {contactPhone && <a className="block hover:text-nrs-ink" href={`tel:${contactPhone}`}>{contactPhoneLabel}</a>}
              {whatsappUrl() && <a className="inline-flex min-h-11 items-center hover:text-nrs-ink" href={whatsappUrl()!} target="_blank" rel="noopener noreferrer">WhatsApp&apos;tan iletişime geç</a>}
              <p>{contactAddress}</p>
            </address>
          </div>

          {/* Shopping Section */}
          <div className="flex flex-col space-y-6">
            <h4 className="text-[11px] uppercase tracking-[0.2em] font-sans font-medium text-nrs-ink">
              Alışveriş
            </h4>
            <nav className="flex flex-col gap-3">
              {[
                { name: 'Yeni Gelenler', href: '/' },
                { name: 'Elbiseler', href: '/category/elbiseler' },
                { name: 'Üst Giyim', href: '/category/ust-giyim' },
                { name: 'Ceketler & Blazerlar', href: '/category/ceketler-blazerlar' },
                { name: 'Alt Giyim', href: '/category/alt-giyim' },
                { name: 'Takımlar', href: '/category/takimlar' },
                { name: 'Dış Giyim', href: '/category/dis-giyim' },
                { name: 'Koleksiyonlar', href: '/collections' },
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
                { name: 'İletişim', href: '/contact' },
                { name: 'Kargo ve Teslimat', href: '/kargo-ve-teslimat' },
                { name: 'İade ve Değişim', href: '/iade-ve-degisim' },
                { name: 'İptal Koşulları', href: '/iptal-kosullari' },
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

        <nav aria-label="Yasal" className="mb-12 border-t border-nrs-ink/10 pt-8">
          <h4 className="mb-5 text-[11px] uppercase tracking-[0.2em] font-sans font-medium text-nrs-ink">Yasal</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
            {LEGAL_ROUTES.filter(route => !['/iade-ve-degisim', '/iptal-kosullari', '/kargo-ve-teslimat'].includes(route)).map(route => (
              <Link key={route} href={route} className="flex min-h-11 items-center text-sm text-nrs-ink/65 hover:text-nrs-ink transition-colors font-light">
                {getLegalDocument(route.slice(1))!.title}
              </Link>
            ))}
          </div>
        </nav>

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
