'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { COOKIE_CONSENT_EVENT, readAdvertisingConsent } from '@/lib/cookie-consent'

const PIXEL_ID = '1141376638847457'

type PixelFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[][]
  push?: PixelFunction
  loaded: boolean
  version: string
}

declare global {
  interface Window {
    fbq?: PixelFunction
    _fbq?: PixelFunction
    __nrsMetaPixel?: { initialized: boolean; lastPath: string | null }
  }
}

export default function MetaPixel() {
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    setAllowed(readAdvertisingConsent() === true)
    const change = (event: Event) => {
      const accepted = (event as CustomEvent).detail === true
      setAllowed(accepted)
      if (!accepted) { window.fbq?.('consent', 'revoke'); setReady(false) }
    }
    window.addEventListener(COOKIE_CONSENT_EVENT, change)
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, change)
  }, [])

  useEffect(() => {
    if (!allowed || !pathname || /^\/(admin|checkout|profile)(\/|$)/.test(pathname)) return
    if (!window.fbq) {
      // Queue commands before the asynchronous Meta library is downloaded.
      const fbq = ((...args: unknown[]) => {
        if (fbq.callMethod) fbq.callMethod(...args)
        else fbq.queue.push(args)
      }) as PixelFunction
      fbq.queue = []
      fbq.push = fbq
      fbq.loaded = true
      fbq.version = '2.0'
      window.fbq = fbq
      if (!window._fbq) window._fbq = fbq
    }

    window.fbq('consent', 'grant')
    const state = window.__nrsMetaPixel ??= { initialized: false, lastPath: null }
    if (!state.initialized) {
      // Only explicit PageView events; no automatic commerce event detection.
      window.fbq('set', 'autoConfig', false, PIXEL_ID)
      window.fbq('init', PIXEL_ID)
      state.initialized = true
    }
    if (state.lastPath !== pathname) {
      window.fbq('trackSingle', PIXEL_ID, 'PageView')
      state.lastPath = pathname
    }
    setReady(true)
  }, [pathname, allowed])

  if (!ready || !allowed) return null
  return <Script id="nrs-meta-pixel" src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive" />
}
