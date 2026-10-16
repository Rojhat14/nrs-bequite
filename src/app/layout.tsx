import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Inter, Noto_Naskh_Arabic, Playfair_Display } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { LocaleProvider } from '@/context/LocaleContext'
import StorefrontShell from '@/components/StorefrontShell'
import MotionProvider from '@/components/MotionProvider'
import Footer from '@/components/Footer'
import MetaPixel from '@/components/MetaPixel'
import CookieConsent from '@/components/CookieConsent'
import { CardPaymentProvider } from '@/lib/feature-flags'
import { paymentAvailable, paymentAvailableForUser } from '@/lib/payment/provider'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getStorefrontNavigationData } from '@/lib/products'
import type { Locale } from '@/lib/i18n/messages'
import { getCurrentUsdTryRate } from '@/lib/i18n/rates'
import { getRequestLocale } from '@/lib/i18n/request-locale'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-serif' })
const arabic = Noto_Naskh_Arabic({ subsets: ['arabic', 'latin'], variable: '--font-arabic', display: 'swap' })
const metadataCopy = {
  tr: { title: 'NRS | Çağdaş Kadın Modası', description: 'NRS — modern kadın için tasarlanan rafine siluetler, seçkin dokular ve zamansız tasarımlar.' },
  en: { title: 'NRS | Contemporary Womenswear', description: 'Refined silhouettes, considered textures and timeless contemporary designs by NRS Bequite Luminous.' },
  ar: { title: 'NRS | أزياء نسائية عصرية', description: 'تصاميم عصرية بخطوط راقية وخامات منتقاة من NRS Bequite Luminous.' },
} as const

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers()
  const locale: Locale = await getRequestLocale()
  const currentPath = requestHeaders.get('x-nrs-path') || '/'
  const basePath = currentPath.replace(/^\/(?:en|ar)(?=\/|$)/, '') || '/'
  const localized = (target: Locale) => `https://nrsbequiteluminous.com${target === 'tr' ? '' : `/${target}`}${basePath === '/' ? '' : basePath}`
  const copy = metadataCopy[locale]
  return {
    metadataBase: new URL('https://nrsbequiteluminous.com'),
    other: { 'facebook-domain-verification': 'dquxm83v1pw19h4ju9sq2g64ikxq7g' },
    title: copy.title,
    description: copy.description,
    keywords: ['luxury fashion', 'NRS moda', 'premium womenswear', 'contemporary fashion'],
    alternates: {
      canonical: localized(locale),
      languages: { tr: localized('tr'), en: localized('en'), ar: localized('ar'), 'x-default': localized('tr') },
    },
    openGraph: {
      type: 'website', siteName: 'NRS Bequite Luminous', title: copy.title,
      description: copy.description, url: localized(locale), locale: locale === 'ar' ? 'ar_AR' : locale === 'en' ? 'en_US' : 'tr_TR',
      images: [{ url: 'https://nrsbequiteluminous.com/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png', width: 1024, height: 1024, alt: 'NRS Bequite Luminous' }],
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale: Locale = await getRequestLocale()
  const [navigationData, rate] = await Promise.all([getStorefrontNavigationData(), getCurrentUsdTryRate()])
  let cardPaymentEnabled = false
  if (process.env.VERCEL_ENV === 'production') {
    try {
      const auth = await createSupabaseServerClient()
      const { data: { user } } = await auth.auth.getUser()
      cardPaymentEnabled = paymentAvailableForUser(user?.id)
    } catch { cardPaymentEnabled = false }
  } else {
    cardPaymentEnabled = paymentAvailable()
  }
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} ${arabic.variable} ${locale === 'ar' ? 'font-arabic' : 'font-sans'} bg-nrs-canvas text-nrs-ink`}>
        <LocaleProvider locale={locale} rate={rate}>
          <MetaPixel /><CookieConsent />
          <CardPaymentProvider value={cardPaymentEnabled}><AuthProvider>
            <MotionProvider>
              <StorefrontShell categories={navigationData.categories} collections={navigationData.collections} footer={<Footer />}>{children}</StorefrontShell>
            </MotionProvider>
          </AuthProvider></CardPaymentProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
