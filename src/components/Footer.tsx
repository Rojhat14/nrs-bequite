'use client'

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { contactEmail, contactPhone, contactPhoneLabel, contactAddress, whatsappUrl } from '@/lib/storefront-config';
import { getLegalDocument, LEGAL_ROUTES } from '@/lib/legal/documents';
import { useLocale } from '@/context/LocaleContext';
import { localePrefix } from '@/lib/i18n/messages'
import { localizedLegalTitle } from '@/lib/legal/translation-titles'

export default function Footer() {
  const { locale, t } = useLocale()
  const prefix = localePrefix(locale)
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
  return (
    <footer className="bg-nrs-canvas border-t border-nrs-ink/5 pt-20 pb-10 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">

          {/* Brand Section */}
          <div className="col-span-1 md:col-span-1 flex flex-col items-start space-y-6">
            <Link href={`${prefix}/`} className="flex flex-col items-start group">
              <Image
                src="/Logo/nrs-wordmark.png"
                alt="NRS Boutique Luminous"
                width={660}
                height={320}
                className="h-14 w-auto object-contain transition-transform duration-700 group-hover:scale-105"
              />
              <span className="text-[10px] uppercase tracking-[0.4em] font-sans text-nrs-ink/60 mt-4">
                {copy('Zarafetin Sanatı', 'The Art of Elegance', 'فن الأناقة')}
              </span>
            </Link>
            <p className="text-sm text-nrs-ink/60 font-light leading-relaxed max-w-xs font-sans">
              {copy('Modern kadının özgün duruşu için tasarlanan rafine siluetler ve zamansız detaylar.', 'Refined silhouettes and timeless details for the modern woman.', 'خطوط راقية وتفاصيل خالدة صُممت للمرأة العصرية.')}
            </p>
            <address className="space-y-3 text-sm leading-6 not-italic text-nrs-ink/65 break-words">
              {contactEmail && <a className="block break-all hover:text-nrs-ink" href={`mailto:${contactEmail}`}>{contactEmail}</a>}
              {contactPhone && <a className="block hover:text-nrs-ink" href={`tel:${contactPhone}`}>{contactPhoneLabel}</a>}
              {whatsappUrl() && <a className="inline-flex min-h-11 items-center hover:text-nrs-ink" href={whatsappUrl()!} target="_blank" rel="noopener noreferrer">{copy('WhatsApp’tan iletişime geç', 'Contact us on WhatsApp', 'تواصل معنا عبر واتساب')}</a>}
              <p>{contactAddress}</p>
            </address>
          </div>

          {/* Shopping Section */}
          <div className="flex flex-col space-y-6">
            <h4 className="text-[11px] uppercase tracking-[0.2em] font-sans font-medium text-nrs-ink">
              {copy('Alışveriş', 'Shop', 'تسوقي')}
            </h4>
            <nav className="flex flex-col gap-3">
              {[
                { name: copy('Yeni Gelenler', 'New arrivals', 'وصل حديثاً'), href: `${prefix}/collections/yeni-gelenler` },
                { name: copy('Elbiseler', 'Dresses', 'فساتين'), href: `${prefix}/category/elbiseler` },
                { name: copy('Tulumlar', 'Jumpsuits', 'جمبسوت'), href: `${prefix}/category/tulumlar` },
                { name: copy('Üst Giyim', 'Tops', 'قمصان وبلوزات'), href: `${prefix}/category/ust-giyim` },
                { name: copy('Ceketler & Blazerlar', 'Jackets & blazers', 'سترات وبليزرات'), href: `${prefix}/category/ceketler-blazerlar` },
                { name: copy('Alt Giyim', 'Bottoms', 'ملابس سفلية'), href: `${prefix}/category/alt-giyim` },
                { name: copy('Takımlar', 'Sets', 'أطقم'), href: `${prefix}/category/takimlar` },
                { name: copy('Dış Giyim', 'Outerwear', 'ملابس خارجية'), href: `${prefix}/category/dis-giyim` },
                { name: t('collections'), href: `${prefix}/collections` },
                { name: t('sale'), href: `${prefix}/category/sale` },
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
                { name: copy('NRS Hakkında', 'About NRS', 'عن NRS'), href: `${prefix}/about` },
                { name: copy('NRS Kadını', 'The NRS Woman', 'امرأة NRS'), href: `${prefix}/about#woman` },
                { name: copy('Atölye', 'The Atelier', 'المشغل'), href: `${prefix}/about#atelier` },
                { name: t('contact'), href: `${prefix}/contact` },
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
              {copy('Müşteri Hizmetleri', 'Customer care', 'خدمة العملاء')}
            </h4>
            <nav className="flex flex-col gap-3">
              {[
                { name: t('contact'), href: `${prefix}/contact` },
                { name: copy('Kargo ve Teslimat', 'Shipping and delivery', 'الشحن والتوصيل'), href: `${prefix}/kargo-ve-teslimat` },
                { name: t('returns'), href: `${prefix}/iade-ve-degisim` },
                { name: copy('İptal Koşulları', 'Cancellation terms', 'شروط الإلغاء'), href: `${prefix}/iptal-kosullari` },
                { name: copy('Beden Rehberi', 'Size guide', 'دليل المقاسات'), href: `${prefix}/size-guide` },
                { name: copy('Bakım Rehberi', 'Care guide', 'دليل العناية'), href: `${prefix}/care-guide` },
                { name: copy('Sıkça Sorulan Sorular', 'Frequently asked questions', 'الأسئلة الشائعة'), href: `${prefix}/faq` },
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
          <h4 className="mb-5 text-[11px] uppercase tracking-[0.2em] font-sans font-medium text-nrs-ink">{copy('Yasal', 'Legal', 'معلومات قانونية')}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-2">
            {LEGAL_ROUTES.filter(route => !['/iade-ve-degisim', '/iptal-kosullari', '/kargo-ve-teslimat'].includes(route)).map(route => (
              <Link key={route} href={`${prefix}${route}`} className="flex min-h-11 items-center text-sm text-nrs-ink/65 hover:text-nrs-ink transition-colors font-light">
                {localizedLegalTitle(route.slice(1), locale) || getLegalDocument(route.slice(1))!.title}
              </Link>
            ))}
          </div>
        </nav>

        <p className="mb-8 text-xs leading-6 text-nrs-ink/55">{copy('Kredi ve banka kartıyla 3D Secure güvenli ödeme · Havale / EFT · Türkiye geneli ücretsiz kargo', '3D Secure card payment · Bank transfer · Free shipping within Türkiye', 'دفع آمن بالبطاقة عبر 3D Secure · تحويل بنكي · شحن مجاني داخل تركيا')}</p>
        <div className="pt-10 border-t border-nrs-ink/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-[10px] uppercase tracking-widest text-nrs-ink/30 font-sans">
            © {new Date().getFullYear()} NRS. {copy('Tüm Hakları Saklıdır.', 'All rights reserved.', 'جميع الحقوق محفوظة.')}
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
