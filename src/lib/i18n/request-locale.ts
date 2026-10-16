import 'server-only'
import { headers } from 'next/headers'
import { isLocale, localeFromCookieHeader, type Locale } from '@/lib/i18n/messages'

export async function getRequestLocale(): Promise<Locale> {
  try {
    const value = (await headers()).get('x-nrs-locale')
    if (isLocale(value)) return value
    const path = (await headers()).get('x-nrs-path')
    const pathLocale = path?.match(/^\/(en|ar)(?:\/|$)/)?.[1]
    if (isLocale(pathLocale)) return pathLocale
    return localeFromCookieHeader((await headers()).get('cookie'))
  } catch {
    // Unit tests and non-request rendering default safely to the canonical locale.
    return 'tr'
  }
}
