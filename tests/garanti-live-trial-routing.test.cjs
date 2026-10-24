const test = require('node:test')
const assert = require('node:assert/strict')
const { loader } = require('./source-loader.cjs')

const variantId = '55555555-5555-4555-8555-555555555555'
const orderId = '11111111-1111-4111-8111-111111111111'
const request = productId => ({
  contractAccepted: true,
  contractVersion: 'v1.5',
  preInformationVersion: 'v1.5',
  idempotencyKey: '22222222-2222-4222-8222-222222222222',
  quoteHash: 'a'.repeat(64),
  items: [{ productId, variantId, quantity: 1 }],
  customer: { firstName: 'Test', lastName: 'Buyer', email: 'test@example.com', phone: '905551234567', address: 'Test', city: 'Ankara', district: 'Test', postalCode: '06000' },
})

test('single-finalize allowance accepts only the private trial or exact public deneme product', async () => {
  const calls = []
  const db = { rpc: async (name, args) => { calls.push({ name, args }); return { data: { created: true, order: { id: orderId, state: 'initiating' } }, error: null } } }
  const load = loader({
    '@supabase/supabase-js': { createClient: () => db },
    './config': { requirePaymentDeployment() {} },
    './garanti/config': { garantiObservationOnly: () => false, garantiLiveObservationOnly: () => true,
      garantiLiveSingleFinalizeArmed: () => true },
    '@/lib/payment/garanti/adapter': { GarantiProvider: class GarantiProvider {} },
    '@/lib/legal/payment-preflight': { prepareOrderLegalRecord: () => ({}) },
    '@/lib/delivery-policy': { SHIPPING_MINOR: 0, DELIVERY_TERMS: '' },
    '@/lib/order-measurements': { measurementKind: () => 'accessory', validateOptionalMeasurements: () => ({}) },
    '@/lib/storage/products': { getProductImageUrl: () => '' },
    '@/lib/legal/order-summary': { assertFinalLegalOrderSummary() {} },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({}) },
    'next/headers': { cookies: async () => ({ get: () => null }) },
  })
  Object.assign(process.env, { PAYMENT_DATABASE_VERIFIED: 'true', SUPABASE_SERVICE_ROLE_KEY: 'synthetic',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', PAYMENT_PROVIDER: 'garanti-oos' })
  const repo = load('src/lib/payment/repository.ts').createPaymentRepository()
  const ordinary = request('catalog-3-try')
  await assert.rejects(repo.createAtomic(ordinary, 'allowed-user', null, { summary: { total: 3 }, hash: ordinary.quoteHash }),
    error => error.code === 'CONTROLLED_ITEM_REQUIRED' && /ürün veya sepet/.test(error.message))
  assert.equal(calls.length, 0, 'a same-price catalog item must not reach any order RPC')

  const privateTrial = request('nrs-garanti-live-3try')
  const wrongQuantity = { ...privateTrial, items: [{ ...privateTrial.items[0], quantity: 2 }] }
  await assert.rejects(repo.createAtomic(wrongQuantity, 'allowed-user', null, { summary: { total: 3 }, hash: wrongQuantity.quoteHash }),
    error => error.code === 'CONTROLLED_ITEM_REQUIRED')
  assert.equal(calls.length, 0, 'the private allowance requires exactly one unit')

  await repo.createAtomic(privateTrial, 'allowed-user', null, { summary: { total: 3 }, hash: privateTrial.quoteHash })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'nrs_create_garanti_live_single_finalize_order')
  assert.equal(calls[0].args.p_items[0].productId, 'nrs-garanti-live-3try')
  assert.equal(calls[0].args.p_items[0].quantity, 1)
  assert.equal(calls[0].args.p_authorized_user_id, 'allowed-user')

  const publicDeneme = request('deneme')
  await repo.createAtomic(publicDeneme, 'allowed-user', null, { summary: { total: 3 }, hash: publicDeneme.quoteHash })
  assert.equal(calls.length, 2)
  assert.equal(calls[1].name, 'nrs_create_garanti_live_single_finalize_order')
  assert.equal(calls[1].args.p_items[0].productId, 'deneme')
  assert.equal(calls[1].args.p_items[0].quantity, 1)
  assert.equal(calls[1].args.p_authorized_user_id, 'allowed-user')
})

test('checkout returns a safe explanation when a same-price catalog item cannot use the private allowance', async () => {
  let load
  const { POST } = (load = loader({
    '@/lib/payment/provider': { paymentAvailable: () => true, paymentAvailableForUser: () => true, getPaymentProvider: () => ({}) },
    '@/lib/payment/http': { boundedJson: async () => ({}), sameOrigin: () => true, unavailable: () => Response.json({}, { status: 503 }) },
    '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'allowed-user' } } }) } }) },
    '@/lib/payment/repository': { createPaymentRepository: () => ({}) },
    '@/lib/payment/service': { initiatePayment: async () => {
      const ErrorType = load('src/lib/payment/start-error.ts').PaymentStartError
      throw new ErrorType('CONTROLLED_ITEM_REQUIRED', 'quote', 'internal detail')
    } },
    './garanti/adapter': { GarantiProvider: class GarantiProvider {} },
  }))('src/app/api/payment/create/route.ts')
  process.env.PAYMENT_ENABLED = 'true'
  const response = await POST(new Request('https://nrsbequiteluminous.com/api/payment/create', {
    method: 'POST', headers: { origin: 'https://nrsbequiteluminous.com', 'content-type': 'application/json' }, body: '{}',
  }))
  const body = await response.json()
  assert.equal(response.status, 409)
  assert.equal(body.errorCode, 'NRS-PAY-UNKNOWN')
  assert.match(body.error, /Ödeme başlatılamadı/)
  assert.match(body.trackingNumber, /^[A-F0-9]{16}$/)
  assert.doesNotMatch(body.error, /internal detail/)
})
