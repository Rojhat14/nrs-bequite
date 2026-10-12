import 'server-only'
import type { PaymentMode } from './types'

export const PAYMENT_UNAVAILABLE = 'Online ödeme şu anda kullanılamıyor. Lütfen bizimle iletişime geçin.'
export function readPaymentConfig(env: NodeJS.ProcessEnv = process.env) {
  // A server-only switch. The UI reads availability from a safe public endpoint.
  const enabled = env.PAYMENT_ENABLED === 'true'
  const mode: PaymentMode | null = env.PAYMENT_MODE === 'sandbox' || env.PAYMENT_MODE === 'live' ? env.PAYMENT_MODE : null
  return { enabled, mode, provider: env.PAYMENT_PROVIDER || '', merchantId: env.PAYMENT_MERCHANT_ID || '',
    apiKey: env.PAYMENT_API_KEY || '', apiSecret: env.PAYMENT_API_SECRET || '',
    baseUrl: env.PAYMENT_BASE_URL || '', callbackUrl: env.PAYMENT_CALLBACK_URL || '',
    returnUrl: env.PAYMENT_3DS_RETURN_URL || '' }
}
export function requirePaymentMode(env: NodeJS.ProcessEnv = process.env): PaymentMode {
  const { mode } = readPaymentConfig(env)
  if (!mode) throw new Error('Payment mode must be explicitly configured.')
  if (mode === 'sandbox' && env.VERCEL_ENV === 'production') throw new Error('Sandbox payments cannot run in Production.')
  return mode
}
export function requirePaymentDeployment() {
  if (process.env.PAYMENT_DATABASE_VERIFIED !== 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Payment database is not verified.')
  }
}
