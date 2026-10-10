export const COOKIE_CONSENT_KEY = 'nrs-cookie-consent-v1'
export const COOKIE_CONSENT_EVENT = 'nrs-cookie-consent-change'
export const COOKIE_CONSENT_LIFETIME_MS = 180 * 24 * 60 * 60 * 1000
export function readAdvertisingConsent(): boolean | null {
  try {
    const data = JSON.parse(localStorage.getItem(COOKIE_CONSENT_KEY) || 'null')
    if (!data || data.version !== 1 || typeof data.advertising !== 'boolean' || !Number.isFinite(data.savedAt)
      || data.savedAt > Date.now() || Date.now() - data.savedAt >= COOKIE_CONSENT_LIFETIME_MS) return null
    return data.advertising
  } catch { return null }
}
export function saveAdvertisingConsent(advertising: boolean) {
  try { localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ version: 1, advertising, savedAt: Date.now() })) } catch { /* storage may be blocked */ }
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: advertising }))
}
