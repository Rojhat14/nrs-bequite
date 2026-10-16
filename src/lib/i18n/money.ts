import type { Locale } from '@/lib/i18n/messages'

export interface DisplayRate {
  usdTry: number
  fetchedAt: string
  rateDate?: string
}

export function displayCurrency(locale: Locale, rate: DisplayRate | null) {
  return locale === 'tr' || !rate ? 'TRY' : 'USD'
}

export function tryToDisplayMinor(amountTryMinor: number, locale: Locale, rate: DisplayRate | null) {
  if (!Number.isSafeInteger(amountTryMinor) || amountTryMinor < 0) throw new Error('Invalid money amount.')
  if (locale === 'tr' || !rate) return amountTryMinor
  return Math.round(amountTryMinor / rate.usdTry)
}

export function formatMoney(amountTry: number, locale: Locale, rate: DisplayRate | null) {
  const amountTryMinor = Math.round(amountTry * 100)
  const currency = displayCurrency(locale, rate)
  const minor = tryToDisplayMinor(amountTryMinor, locale, rate)
  return new Intl.NumberFormat(locale === 'ar' ? 'ar' : locale === 'en' ? 'en-US' : 'tr-TR', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(minor / 100)
}

/** Largest-remainder allocation makes rounded USD line values add to the displayed total. */
export function allocateDisplayMinor(valuesTryMinor: number[], locale: Locale, rate: DisplayRate | null) {
  if (locale === 'tr' || !rate) return valuesTryMinor.map(value => Math.round(value))
  if (valuesTryMinor.some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error('Invalid line values.')
  const exact = valuesTryMinor.map(value => value / rate.usdTry)
  const floors = exact.map(value => Math.floor(value))
  const target = Math.round(valuesTryMinor.reduce((sum, value) => sum + value, 0) / rate.usdTry)
  let pennies = target - floors.reduce((sum, value) => sum + value, 0)
  const order = exact.map((value, index) => ({ index, remainder: value - floors[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (let i = 0; i < pennies; i++) floors[order[i % order.length].index]++
  return floors
}

export function formatMinor(minor: number, locale: Locale, rate: DisplayRate | null) {
  const currency = displayCurrency(locale, rate)
  return new Intl.NumberFormat(locale === 'ar' ? 'ar' : locale === 'en' ? 'en-US' : 'tr-TR', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(minor / 100)
}
