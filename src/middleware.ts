import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const LOCALES = ['tr', 'en', 'ar'] as const
type Locale = (typeof LOCALES)[number]

function pageLocale(pathname: string): Locale | null {
  const match = pathname.match(/^\/(en|ar)(?:\/|$)/)
  return match ? match[1] as Locale : null
}

function excludedFromLocale(pathname: string) {
  return pathname === '/api' || pathname.startsWith('/api/')
    || pathname === '/admin' || pathname.startsWith('/admin/')
    || pathname === '/auth' || pathname.startsWith('/auth/')
    || pathname === '/.well-known' || pathname.startsWith('/.well-known/')
    || pathname.startsWith('/_next/') || pathname.startsWith('/static/')
    || /\.(?:xml|txt|json|ico|png|jpe?g|webp|avif|svg|gif|css|js|woff2?|ttf|otf|pdf|map)$/i.test(pathname)
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const explicitLocale = pageLocale(pathname)
  const basePath = explicitLocale ? pathname.replace(/^\/(?:en|ar)(?=\/|$)/, '') || '/' : pathname
  const localeExcluded = excludedFromLocale(basePath)
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/')

  // Language prefixes only affect customer-facing page requests. API, auth,
  // admin, bank callbacks, feeds, webhooks and static assets keep their paths.
  if (!localeExcluded && explicitLocale) {
    const internalUrl = request.nextUrl.clone()
    internalUrl.pathname = basePath
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nrs-locale', explicitLocale)
    requestHeaders.set('x-nrs-path', pathname)
    // Next's rewrite request override carries the locale into the server
    // render. Keep the same preference in the request Cookie header so the
    // first HTML response is localized even on runtimes that omit custom
    // request headers while resolving a rewrite.
    const forwardedCookies = request.cookies.getAll().filter(cookie => cookie.name !== 'nrs-locale')
    forwardedCookies.push({ name: 'nrs-locale', value: explicitLocale })
    requestHeaders.set('cookie', forwardedCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; '))
    const response = NextResponse.rewrite(internalUrl, { request: { headers: requestHeaders } })
    response.cookies.set('nrs-locale', explicitLocale, {
      path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', secure: request.nextUrl.protocol === 'https:',
    })
    return response
  }

  if (!localeExcluded && !explicitLocale) {
    // Next may invoke middleware again after an internal rewrite. Preserve the
    // original public locale path so that the rewritten page does not render
    // in Turkish on its first response.
    const forwardedPath = request.headers.get('x-nrs-path')
    const forwardedLocale = forwardedPath ? pageLocale(forwardedPath) : null
    const forwardedBasePath = forwardedPath?.replace(/^\/(?:en|ar)(?=\/|$)/, '') || (forwardedLocale ? '/' : '')
    const isLocaleRewrite = Boolean(forwardedLocale && forwardedBasePath === pathname)
    if (isLocaleRewrite) {
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set('x-nrs-locale', forwardedLocale!)
      return await protectAdmin(request, NextResponse.next({ request: { headers: requestHeaders } }), isAdmin)
    }
    const preferred = request.cookies.get('nrs-locale')?.value
    if ((preferred === 'en' || preferred === 'ar') && pathname !== '/admin/login') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = `/${preferred}${pathname === '/' ? '' : pathname}`
      return NextResponse.redirect(redirectUrl, 307)
    }
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nrs-locale', 'tr')
    requestHeaders.set('x-nrs-path', pathname)
    return await protectAdmin(request, NextResponse.next({ request: { headers: requestHeaders } }), isAdmin)
  }

  return await protectAdmin(request, NextResponse.next(), isAdmin)
}

async function protectAdmin(request: NextRequest, response: NextResponse, isAdmin: boolean) {
  if (!isAdmin) return response
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    if (request.nextUrl.pathname === '/admin/login') return response
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/admin/login'
    loginUrl.search = '?reason=setup'
    return NextResponse.redirect(loginUrl)
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return request.cookies.getAll() },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (request.nextUrl.pathname === '/admin/login' || user) return response
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/admin/login'
  loginUrl.search = ''
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
