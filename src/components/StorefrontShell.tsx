'use client'

import { usePathname } from 'next/navigation'
import CartDrawer from '@/components/CartDrawer'
import Footer from '@/components/Footer'
import Navigation from '@/components/Navigation'
import Newsletter from '@/components/Newsletter'

export default function StorefrontShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/'
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')

  if (isAdminRoute) return <>{children}</>

  return (
    <>
      <Navigation introFinished={true} />
      {children}
      <Footer />
      <Newsletter />
      <CartDrawer />
    </>
  )
}
