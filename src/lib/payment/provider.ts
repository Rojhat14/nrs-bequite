import 'server-only'
import type { PaymentProvider } from './types'
import { readPaymentConfig, requirePaymentDeployment } from './config'
import { GarantiProvider } from './garanti/adapter'
import { controlledLiveAccountAllowed } from './garanti/config'

// Real adapters fail closed without target DB, explicit mode and bank-approved
// configuration. Garanti live mode additionally requires an explicit bank
// confirmation of successful Production orderinq field behavior.
// No mock, legacy credential or generic API URL fallback is allowed.
const providers: Readonly<Record<string, () => PaymentProvider>> = Object.freeze({ 'garanti-oos': () => new GarantiProvider() })
export function getPaymentProvider(): PaymentProvider {
  const config = readPaymentConfig()
  if (!config.enabled || !Object.hasOwn(providers, config.provider)) throw new Error('Payment provider unavailable.')
  requirePaymentDeployment()
  if (config.provider === 'garanti-oos') return providers[config.provider]()
  for (const value of [config.baseUrl, config.callbackUrl, config.returnUrl]) {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Invalid payment URL.')
  }
  if (!config.merchantId || !config.apiKey || !config.apiSecret) throw new Error('Missing payment credentials.')
  return providers[config.provider]()
}
export function paymentAvailable() {
  try { getPaymentProvider(); return true } catch { return false }
}
export function paymentAvailableForUser(userId: string | null | undefined) {
  try {
    const provider = getPaymentProvider()
    if (provider.name !== 'garanti-oos') return false
    const garanti = provider as GarantiProvider
    if (garanti.config.mode === 'TEST') return true
    if (garanti.config.generalLivePayments === true && garanti.config.liveObservationOnly !== true) return true
    return !!userId && controlledLiveAccountAllowed(userId)
  } catch { return false }
}
