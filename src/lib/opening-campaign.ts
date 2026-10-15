/**
 * The opening offer is deliberately defined in one place. Its public active
 * switch is read by both browser and server bundles; normal catalog prices
 * remain untouched when the offer is enabled or disabled.
 */
export const OPENING_CAMPAIGN = Object.freeze({
  id: 'nrs-opening-20-percent',
  name: 'Açılışa Özel %20 İndirim',
  discountLabel: '%20 indirim',
  rateBasisPoints: 2000,
  announcement: 'Açılışa özel tüm ürünlerde sepette %20 indirim.',
})

export function isOpeningCampaignActive() {
  return process.env.NEXT_PUBLIC_OPENING_CAMPAIGN_ACTIVE !== 'false'
}

export function getOpeningCampaign() {
  return isOpeningCampaignActive() ? OPENING_CAMPAIGN : null
}

export function discountForUnitMinor(unitPriceMinor: number, active = isOpeningCampaignActive()) {
  if (!active || !Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 0) return 0
  return Math.round(unitPriceMinor * OPENING_CAMPAIGN.rateBasisPoints / 10000)
}

export function calculateOpeningTotals(
  lines: Array<{ unitPriceMinor: number; quantity: number }>,
  shippingMinor = 0,
  active = isOpeningCampaignActive(),
) {
  let subtotalMinor = 0
  let discountMinor = 0
  for (const line of lines) {
    if (!Number.isSafeInteger(line.unitPriceMinor) || line.unitPriceMinor < 0
      || !Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      throw new Error('Invalid campaign price input.')
    }
    subtotalMinor += line.unitPriceMinor * line.quantity
    discountMinor += discountForUnitMinor(line.unitPriceMinor, active) * line.quantity
  }
  if (!Number.isSafeInteger(shippingMinor) || shippingMinor < 0
    || ![subtotalMinor, discountMinor, subtotalMinor - discountMinor, subtotalMinor - discountMinor + shippingMinor].every(Number.isSafeInteger)) {
    throw new Error('Campaign total is outside the supported range.')
  }
  return {
    subtotalMinor,
    discountMinor,
    shippingMinor,
    totalMinor: subtotalMinor - discountMinor + shippingMinor,
    campaign: active ? OPENING_CAMPAIGN : null,
  }
}

export function discountedUnitMinor(unitPriceMinor: number, active = isOpeningCampaignActive()) {
  return unitPriceMinor - discountForUnitMinor(unitPriceMinor, active)
}
