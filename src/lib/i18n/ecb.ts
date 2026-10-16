import { USD_TRY_RATE_POLICY } from '@/lib/i18n/rate-policy'

export interface ParsedEcbRate { usdTry: number; rateDate: string }

export function parseEcbRate(xml: string): ParsedEcbRate {
  const dateMatch = xml.match(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]\s*>/)
  const rateDate = dateMatch?.[1]
  if (!rateDate || !Number.isFinite(Date.parse(`${rateDate}T00:00:00Z`))) throw new Error('ECB_DATE_INVALID')
  const read = (code: 'USD' | 'TRY') => {
    const match = xml.match(new RegExp(`<Cube\\s+currency=['"]${code}['"]\\s+rate=['"]([0-9]+(?:\\.[0-9]+)?)['"]\\s*\\/>`))
    return match ? Number(match[1]) : NaN
  }
  const usdPerEur = read('USD')
  const tryPerEur = read('TRY')
  const usdTry = tryPerEur / usdPerEur
  if (!Number.isFinite(usdPerEur) || !Number.isFinite(tryPerEur) || usdPerEur <= 0 || tryPerEur <= 0
    || !Number.isFinite(usdTry) || usdTry < 1 || usdTry > 200) throw new Error('ECB_RATE_INVALID')
  return { usdTry, rateDate }
}

export const ECB_PROVIDER = USD_TRY_RATE_POLICY.provider
