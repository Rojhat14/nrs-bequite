'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import CartDrawer from '@/components/CartDrawer'
import Navigation from '@/components/Navigation'
import Newsletter from '@/components/Newsletter'
import { StorefrontCatalogProvider, type StorefrontNavCategory, type StorefrontNavCollection } from '@/context/StorefrontCatalogContext'

export default function StorefrontShell({ children, categories, collections, footer }: { children: React.ReactNode; categories: StorefrontNavCategory[]; collections: StorefrontNavCollection[]; footer: ReactNode }) {
  const pathname = usePathname() || '/'
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')

  if (isAdminRoute) return <>{children}</>

  return (
    <StorefrontCatalogProvider value={{ categories, collections }}>
      <Navigation introFinished={true} />
      {children}
      {footer}
      <Newsletter />
      <CartDrawer />
    </StorefrontCatalogProvider>
  )
}
