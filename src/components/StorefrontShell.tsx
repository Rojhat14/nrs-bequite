'use client'

import { usePathname } from 'next/navigation'
import CartDrawer from '@/components/CartDrawer'
import Footer from '@/components/Footer'
import Navigation from '@/components/Navigation'
import Newsletter from '@/components/Newsletter'
import { StorefrontCatalogProvider, type StorefrontNavCategory, type StorefrontNavCollection } from '@/context/StorefrontCatalogContext'

export default function StorefrontShell({ children, categories, collections }: { children: React.ReactNode; categories: StorefrontNavCategory[]; collections: StorefrontNavCollection[] }) {
  const pathname = usePathname() || '/'
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')

  if (isAdminRoute) return <>{children}</>

  return (
    <StorefrontCatalogProvider value={{ categories, collections }}>
      <Navigation introFinished={true} />
      {children}
      <Footer />
      <Newsletter />
      <CartDrawer />
    </StorefrontCatalogProvider>
  )
}
