export const LIVE_OBSERVATION_PRODUCT_ID = 'nrs-garanti-live-3try'
export const LIVE_CONTROLLED_CATALOG_PRODUCT_ID = 'deneme'

export function isLiveSingleFinalizeCheckout(items: readonly { productId: string; quantity: number }[], amountMinor: number) {
  return amountMinor === 300 && items.length === 1
    && [LIVE_OBSERVATION_PRODUCT_ID, LIVE_CONTROLLED_CATALOG_PRODUCT_ID].includes(items[0]?.productId || '')
    && items[0]?.quantity === 1
}

export interface LiveObservationProductRow {
  id: string
  name: string
  description: string | null
  price_amount: number | string
  currency: string
  status: string
  in_stock: boolean
  payment_test_only: boolean
}

export function isLiveObservationProduct(row: LiveObservationProductRow | null | undefined) {
  return row?.id === LIVE_OBSERVATION_PRODUCT_ID
    && row.payment_test_only === true
    && row.status === 'active'
    && row.currency === 'TRY'
    && Math.round(Number(row.price_amount) * 100) === 300
    && row.in_stock === true
}
