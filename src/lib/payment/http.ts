import 'server-only'
import { NextResponse } from 'next/server'
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  return origin !== null && origin === new URL(request.url).origin
}
export async function boundedJson(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new Error('Invalid content type.')
  return JSON.parse(await boundedText(request)) as unknown
}
export async function boundedText(request: Request) {
  if (Number(request.headers.get('content-length')) > 65536) throw new Error('Request too large.')
  if (!request.body) throw new Error('Missing request body.')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.length
      if (length > 65536) { await reader.cancel(); throw new Error('Request too large.') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  return Buffer.concat(chunks).toString('utf8')
}
export const unavailable = () => NextResponse.json(
  { error: 'Online ödeme şu anda kullanılamıyor. Lütfen bizimle iletişime geçin.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
