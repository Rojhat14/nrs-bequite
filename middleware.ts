import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  let refreshedCookies: Array<{
    name: string
    value: string
    options?: Record<string, unknown>
  }> = []

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
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        refreshedCookies = cookiesToSet
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const isLoginRoute = request.nextUrl.pathname === '/admin/login'

  if (isLoginRoute || user) return response

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/admin/login'
  loginUrl.search = ''
  const redirectResponse = NextResponse.redirect(loginUrl)
  refreshedCookies.forEach(({ name, value, options }) => {
    redirectResponse.cookies.set(name, value, options)
  })
  return redirectResponse
}

export const config = {
  matcher: ['/admin/:path*'],
}
