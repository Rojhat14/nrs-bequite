/** Compatibility surface for old callers and historical order snapshots. */
export const OPENING_CAMPAIGN = Object.freeze({
  id: 'retired',
  name: '',
  discountLabel: '',
  rateBasisPoints: 0,
  announcement: '',
})

export function isOpeningCampaignActive() {
  return false
}

export function getOpeningCampaign() {
  return null
}

export function discountForUnitMinor(_unitPriceMinor: number, _active = false) {
  return 0
}

export function calculateOpeningTotals(
  lines: Array<{ unitPriceMinor: number; quantity: number }>,
  shippingMinor = 0,
  _active = false,
) {
  let subtotalMinor = 0
  for (const line of lines) {
    if (!Number.isSafeInteger(line.unitPriceMinor) || line.unitPriceMinor < 0
      || !Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      throw new Error('Invalid cart price input.')
    }
    subtotalMinor += line.unitPriceMinor * line.quantity
  }
  if (!Number.isSafeInteger(shippingMinor) || shippingMinor < 0
    || ![subtotalMinor, subtotalMinor + shippingMinor].every(Number.isSafeInteger)) {
    throw new Error('Cart total is outside the supported range.')
  }
  return { subtotalMinor, discountMinor: 0, shippingMinor, totalMinor: subtotalMinor + shippingMinor, campaign: null }
}

export function discountedUnitMinor(unitPriceMinor: number, _active = false) {
  return unitPriceMinor
}
