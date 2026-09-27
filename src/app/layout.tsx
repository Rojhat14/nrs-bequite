import type { Metadata } from 'next'
import { Inter, Playfair_Display } from 'next/font/google'
import './globals.css'
import CartDrawer from '@/components/CartDrawer'
import Newsletter from '@/components/Newsletter'
import { AuthProvider } from '@/context/AuthContext'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-serif' })

export const metadata: Metadata = {
  title: "NRS | Boutique Luminous - The Art of Elegance",
  description: 'Experience the essence of quiet luxury. Exclusive, minimal, and sophisticated high-end fashion for the modern woman.',
  keywords: ['luxury fashion', 'boutique luminous', 'NRS fashion', 'premium clothing', 'quiet luxury'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${playfair.variable} font-sans bg-nrs-ivory text-nrs-black`}>
        <AuthProvider>
          {children}
          <Newsletter />
          <CartDrawer />
        </AuthProvider>
      </body>
    </html>
  )
}
