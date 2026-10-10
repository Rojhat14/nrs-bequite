'use client'
import { createContext, createElement, useContext, type ReactNode } from 'react'
// Safe default for tests, unavailable configuration and initial rendering.
// PAYMENT_ENABLED is server-only; RootLayout exposes only the final boolean.
export const ENABLE_CARD_PAYMENT: boolean = false
export const CardPaymentContext = createContext(ENABLE_CARD_PAYMENT)
export function CardPaymentProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return createElement(CardPaymentContext.Provider, { value }, children)
}
export function useCardPaymentEnabled() { return useContext(CardPaymentContext) }
