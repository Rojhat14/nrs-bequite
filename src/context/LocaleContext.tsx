'use client'

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { isLocale, message, type Locale, type MessageKey } from '@/lib/i18n/messages'
import { formatMoney, formatMinor, type DisplayRate } from '@/lib/i18n/money'

interface LocaleValue { locale: Locale; rate: DisplayRate | null }
const LocaleContext = createContext<LocaleValue>({ locale: 'tr', rate: null })

export function LocaleProvider({ locale, rate, children }: LocaleValue & { children: ReactNode }) {
  return <LocaleContext.Provider value={{ locale: isLocale(locale) ? locale : 'tr', rate }}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const value = useContext(LocaleContext)
  const t = useCallback((key: MessageKey) => message(value.locale, key), [value.locale])
  const money = useCallback((amountTry: number) => formatMoney(amountTry, value.locale, value.rate), [value.locale, value.rate])
  const minorMoney = useCallback((minorTry: number) => formatMinor(minorTry, value.locale, value.rate), [value.locale, value.rate])
  return useMemo(() => ({ ...value, t, money, minorMoney, fxAvailable: value.locale === 'tr' || value.rate !== null }), [value, t, money, minorMoney])
}
