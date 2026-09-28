export const DEFAULT_ADMIN_SETTINGS = {
  storeName: 'NRS',
  currency: 'TRY',
  lowStockThreshold: 3,
  defaultProductStatus: 'draft',
} as const

// Centralized so this can be replaced by persistent settings later.
export const LOW_STOCK_THRESHOLD = DEFAULT_ADMIN_SETTINGS.lowStockThreshold
