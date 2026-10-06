import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import StorefrontShell from '@/components/StorefrontShell'
import MotionProvider from '@/components/MotionProvider'
import Footer from '@/components/Footer'
import MetaPixel from '@/components/MetaPixel'
import { getStorefrontNavigationData } from '@/lib/products'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-serif' })

export const metadata: Metadata = {
  metadataBase: new URL('https://nrsbequiteluminous.com'),
  other: { 'facebook-domain-verification': 'dquxm83v1pw19h4ju9sq2g64ikxq7g' },
  title: "NRS | Çağdaş Kadın Modası",
  description: 'NRS — modern kadın için tasarlanan rafine siluetler, seçkin dokular ve zamansız tasarımlar.',
  keywords: ['luxury fashion', 'NRS moda', 'premium kadın giyim', 'contemporary fashion', 'lüks giyim'],
  openGraph: {
    type: 'website',
    siteName: 'NRS Bequite Luminous',
    title: 'NRS Bequite Luminous | Çağdaş Kadın Modası',
    description: 'NRS — modern kadın için tasarlanan rafine siluetler, seçkin dokular ve zamansız tasarımlar.',
    url: 'https://nrsbequiteluminous.com/',
    images: [{
      url: 'https://nrsbequiteluminous.com/Logo/Gemini_Generated_Image_fy30oqfy30oqfy30.png',
      width: 1024,
      height: 1024,
      alt: 'NRS Bequite Luminous',
    }],
  },
  twitter: { card: 'summary_large_image' },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const navigationData = await getStorefrontNavigationData()
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans bg-nrs-canvas text-nrs-ink`}>
        <MetaPixel />
        <AuthProvider>
          <MotionProvider>
            <StorefrontShell categories={navigationData.categories} collections={navigationData.collections} footer={<Footer />}>{children}</StorefrontShell>
          </MotionProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
