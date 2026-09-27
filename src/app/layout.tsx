import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import CartDrawer from '@/components/CartDrawer'
import Newsletter from '@/components/Newsletter'
import Footer from '@/components/Footer'
import { AuthProvider } from '@/context/AuthContext'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-serif' })

export const metadata: Metadata = {
  title: "NRS | Çağdaş Kadın Modası",
  description: 'NRS — modern kadın için tasarlanan rafine siluetler, seçkin dokular ve zamansız tasarımlar.',
  keywords: ['luxury fashion', 'NRS moda', 'premium kadın giyim', 'contemporary fashion', 'lüks giyim'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans bg-nrs-ivory text-nrs-black`}>
        <AuthProvider>
          {children}
          <Footer />
          <Newsletter />
          <CartDrawer />
        </AuthProvider>
      </body>
    </html>
  )
}
