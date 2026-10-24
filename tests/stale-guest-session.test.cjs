const test = require('node:test')
const assert = require('node:assert/strict')
const { loader } = require('./source-loader.cjs')

test('An expired browser session can continue as guest when the server rejects it', async () => {
  const savedEnabled = process.env.PAYMENT_ENABLED
  const savedNodeEnv = process.env.NODE_ENV
  process.env.PAYMENT_ENABLED = 'true'
  process.env.NODE_ENV = 'production'

  const access = loader()('src/lib/payment/access.ts')
  const cookies = new Map()
  const jar = {
    get: name => cookies.has(name) ? { value: cookies.get(name).value } : undefined,
    set: (name, value, options) => cookies.set(name, { value, options }),
  }
  const initiateCalls = []
  const responseJson = (body, init) => new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  class GarantiProvider {}

  try {
    const route = loader({
      'next/server': { NextResponse: { json: responseJson } },
      'next/headers': { cookies: async () => jar },
      '@/lib/payment/provider': {
        paymentAvailable: () => true,
        paymentAvailableForUser: () => true,
        getPaymentProvider: () => ({}),
      },
      '@/lib/payment/http': {
        boundedJson: async request => request.json(),
        sameOrigin: () => true,
        unavailable: () => responseJson({ error: 'unavailable' }, { status: 503 }),
      },
      '@/lib/supabase/server': {
        // The browser may still show an old session, but the secure server
        // identity check correctly concludes that it is no longer valid.
        createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
      },
      '@/lib/payment/repository': { createPaymentRepository: () => ({}) },
      '@/lib/payment/service': {
        initiatePayment: async (...args) => {
          initiateCalls.push(args)
          return { orderId: 'synthetic-order', redirectUrl: 'https://bank.example.test/hosted' }
        },
      },
      '@/lib/i18n/rates': { getCurrentUsdTryRate: async () => null },
      '@/lib/payment/garanti/adapter': { GarantiProvider },
    })('src/app/api/payment/create/route.ts')

    const response = await route.POST(new Request('https://nrs.example/api/payment/create', {
      method: 'POST', headers: { origin: 'https://nrs.example', 'content-type': 'application/json' }, body: '{}',
    }))
    assert.equal(response.status, 200)
    const responseText = await response.text()
    assert.deepEqual(JSON.parse(responseText), { orderId: 'synthetic-order', redirectUrl: 'https://bank.example.test/hosted' })
    assert.equal(initiateCalls.length, 1)
    assert.equal(initiateCalls[0][1], null, 'expired browser identity must not be treated as an authenticated owner')
    const token = cookies.get(access.GUEST_COOKIE)
    assert.match(token.value, /^[0-9a-f]{64}$/)
    assert.equal(token.options.httpOnly, true)
    assert.equal(token.options.secure, true)
    assert.equal(token.options.sameSite, 'lax')
    assert.equal(token.options.path, '/')
    assert.equal(token.options.maxAge, access.GUEST_ACCESS_SECONDS)
    assert.equal(initiateCalls[0][2], access.hashGuestToken(token.value))
    assert.equal(responseText.includes(token.value), false)
  } finally {
    if (savedEnabled === undefined) delete process.env.PAYMENT_ENABLED
    else process.env.PAYMENT_ENABLED = savedEnabled
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = savedNodeEnv
  }
})
