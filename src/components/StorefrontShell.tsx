'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import CartDrawer from '@/components/CartDrawer'
import CartPriceSync from '@/components/CartPriceSync'
import Navigation from '@/components/Navigation'
import Newsletter from '@/components/Newsletter'
import { StorefrontCatalogProvider, type StorefrontNavCategory, type StorefrontNavCollection } from '@/context/StorefrontCatalogContext'
import { getOpeningCampaign } from '@/lib/opening-campaign'

export default function StorefrontShell({ children, categories, collections, footer }: { children: React.ReactNode; categories: StorefrontNavCategory[]; collections: StorefrontNavCollection[]; footer: ReactNode }) {
  const pathname = usePathname() || '/'
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')

  if (isAdminRoute) return <>{children}</>
  const campaign = getOpeningCampaign()

  return (
    <StorefrontCatalogProvider value={{ categories, collections }}>
      {campaign && <div role="status" className="relative z-[61] flex min-h-9 items-center justify-center bg-nrs-ink px-4 py-2 text-center text-[11px] tracking-wide text-nrs-canvas sm:text-xs">
        {campaign.announcement}
      </div>}
      <Navigation introFinished={true} />
      <CartPriceSync />
      {children}
      {footer}
      <Newsletter />
      <CartDrawer />
    </StorefrontCatalogProvider>
  )
}
