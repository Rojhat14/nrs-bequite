'use client'

import { createContext, useContext } from 'react'

export interface StorefrontNavCategory {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
}

export interface StorefrontNavCollection {
  id: string
  name: string
  slug: string
}

const StorefrontCatalogContext = createContext<{
  categories: StorefrontNavCategory[]
  collections: StorefrontNavCollection[]
}>({ categories: [], collections: [] })

export const StorefrontCatalogProvider = StorefrontCatalogContext.Provider

export function useStorefrontCatalog() {
  return useContext(StorefrontCatalogContext)
}
