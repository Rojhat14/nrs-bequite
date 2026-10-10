import 'server-only'
import type { PaymentProvider } from './types'
import { readPaymentConfig, requirePaymentDeployment } from './config'

// Register the real bank adapter here AFTER its protocol is supplied and sandbox
// tests pass. No mock, guessed provider, legacy credentials or generic API URL
// fallback is allowed in production.
const providers: Readonly<Record<string, () => PaymentProvider>> = Object.freeze({})
export function getPaymentProvider(): PaymentProvider {
  const config = readPaymentConfig()
  if (!config.enabled || !Object.hasOwn(providers, config.provider)) throw new Error('Payment provider unavailable.')
  requirePaymentDeployment()
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
