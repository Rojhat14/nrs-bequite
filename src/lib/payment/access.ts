import 'server-only'
import { randomBytes, createHash } from 'node:crypto'
export const GUEST_COOKIE = 'nrs-order-access'
export const GUEST_ACCESS_SECONDS = 60 * 60 * 24 * 30
export function hashGuestToken(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new Error('Invalid access token.')
  return createHash('sha256').update(token).digest('hex')
}
export function newGuestToken() { return randomBytes(32).toString('hex') }
