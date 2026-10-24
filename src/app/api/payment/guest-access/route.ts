import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { GUEST_ACCESS_SECONDS, GUEST_COOKIE, hashGuestToken, newGuestToken } from '@/lib/payment/access'
import { sameOrigin } from '@/lib/payment/http'

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 403 })
  const jar = await cookies()
  const existing = jar.get(GUEST_COOKIE)?.value
  if (existing) {
    try {
      hashGuestToken(existing)
      return NextResponse.json({ ready: true }, { headers: { 'Cache-Control': 'no-store' } })
    } catch { /* replace malformed capability */ }
  }
  jar.set(GUEST_COOKIE, newGuestToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: GUEST_ACCESS_SECONDS,
  })
  return NextResponse.json({ ready: true }, { headers: { 'Cache-Control': 'no-store' } })
}
