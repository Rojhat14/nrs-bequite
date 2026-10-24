const test = require('node:test')
const assert = require('node:assert/strict')
const { loader } = require('./source-loader.cjs')

function findNode(node, predicate) {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) return node.map(value => findNode(value, predicate)).find(Boolean) || null
  if (predicate(node)) return node
  return findNode(node.props?.children, predicate)
}

function accountModalHarness(mode) {
  const state = [mode === 'login', 'buyer@example.test', 'synthetic-password', 'Ada', 'Test', '905551234567']
  let cursor = 0
  const session = { user: { id: 'synthetic-user', email: 'buyer@example.test' } }
  const calls = []
  const supabase = { auth: {
    async signInWithPassword() { calls.push('login'); return { data: { session }, error: null } },
    async signUp() { calls.push('signup'); return { data: { user: session.user, session }, error: null } },
    async getSession() { calls.push('session'); return { data: { session }, error: null } },
  }, from() { return { async upsert() { calls.push('profile-upsert'); return { error: null } } } } }
  const fakeReact = { useState(initial) {
    const index = cursor++
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial
    return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
  } }
  const Modal = loader({
    react: fakeReact,
    'framer-motion': { m: { div: function Div() {} }, AnimatePresence: function AnimatePresence() {}, useReducedMotion: () => false },
    'lucide-react': { X: function X() {} },
    '@/lib/supabase': { supabase },
    '@/hooks/useDialog': { useDialog: () => ({ current: null }) },
    '@/context/LocaleContext': { useLocale: () => ({ t: key => key }) },
  })('src/components/AccountModal.tsx').default
  return { calls, render(onClose, onAuthenticated) { cursor = 0; return Modal({ isOpen: true, onClose, onAuthenticated }) } }
}

test('A session transition invalidates the guest catalog scope so checkout refreshes the same persisted cart', () => {
  const scope = loader()('src/lib/cart-catalog-sync.ts').cartCatalogSyncScope
  const productIds = ['dress', 'dress']
  assert.equal(scope('tr', null, productIds), 'tr:guest:dress')
  assert.equal(scope('tr', 'synthetic-user', productIds), 'tr:synthetic-user:dress')
  assert.notEqual(scope('tr', null, productIds), scope('tr', 'synthetic-user', productIds))
  assert.notEqual(scope('tr', 'synthetic-user', productIds), scope('en', 'synthetic-user', productIds))
})

test('CartPriceSync refetches active variant identities after account auth changes, without changing the cart payload', async () => {
  const oldFetch = global.fetch
  const items = [{ id: 'dress', variantId: '11111111-1111-4111-8111-111111111111', size: '36', quantity: 2, measurements: { chest: 92 } }]
  const syncCalls = []
  const statusCalls = []
  const store = { items, syncCatalogPrices: (...args) => syncCalls.push(args), setCatalogPricesSynced: (...args) => statusCalls.push(args) }
  let auth = { user: null, loading: false }
  let refs = []
  let hookIndex = 0
  let effects = []
  const fakeReact = {
    useRef(initial) { const index = hookIndex++; if (!refs[index]) refs[index] = { current: initial }; return refs[index] },
    useMemo(factory) { hookIndex++; return factory() },
    useEffect(effect) { hookIndex++; effects.push(effect) },
  }
  const component = loader({
    react: fakeReact,
    '@/store/useCart': { useCart: selector => selector(store) },
    '@/context/LocaleContext': { useLocale: () => ({ locale: 'tr' }) },
    '@/context/AuthContext': { useAuth: () => auth },
  })('src/components/CartPriceSync.tsx').default
  let requests = 0
  global.fetch = async (_url, options) => {
    requests++
    const requestBody = JSON.parse(options.body)
    assert.deepEqual(requestBody.ids, ['dress'])
    assert.equal(Object.hasOwn(requestBody, 'items'), false)
    return { ok: true, json: async () => ({ products: [{ id: 'dress', price: 120, compareAtPrice: null }], variants: [{ id: '22222222-2222-4222-8222-222222222222', productId: 'dress', size: '36' }] }) }
  }
  async function renderAndRunEffect() {
    hookIndex = 0
    effects = []
    component()
    effects[0]()
    await new Promise(resolve => setImmediate(resolve))
  }
  try {
    await renderAndRunEffect()
    auth = { user: { id: 'synthetic-user' }, loading: false }
    await renderAndRunEffect()
    assert.equal(requests, 2)
    assert.equal(syncCalls.length, 2)
    assert.equal(syncCalls[0][2], 'tr:guest:dress')
    assert.equal(syncCalls[1][2], 'tr:synthetic-user:dress')
    assert.deepEqual(items, [{ id: 'dress', variantId: '11111111-1111-4111-8111-111111111111', size: '36', quantity: 2, measurements: { chest: 92 } }])
  } finally { global.fetch = oldFetch }
})

test('A persisted exact-size cart line refreshes a stale variant ID without losing size, quantity, measurements, or current prices', () => {
  const previousStorage = global.localStorage
  const previousWindow = global.window
  const values = new Map()
  global.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  global.window = { localStorage: global.localStorage }
  try {
    const { useCart, getCartItemId } = loader()('src/store/useCart.ts')
    const cart = useCart.getState()
    cart.addItem({ id: 'dress', slug: 'dress', title: 'Old title', price: '₺100', variantId: '11111111-1111-4111-8111-111111111111', size: '36', category: 'Elbise' }, 2)
    const line = useCart.getState().items[0]
    const measurements = { chest: 92, waist: 72 }
    useCart.getState().updateMeasurements(getCartItemId(line), measurements)

    useCart.getState().syncCatalogPrices(
      [{ id: 'dress', title: 'Current title', price: 120, compareAtPrice: null }],
      [{ id: '22222222-2222-4222-8222-222222222222', productId: 'dress', size: '36' }],
      'tr:synthetic-user:dress',
    )

    const refreshed = useCart.getState().items[0]
    assert.equal(useCart.getState().items.length, 1)
    assert.equal(refreshed.variantId, '22222222-2222-4222-8222-222222222222')
    assert.equal(refreshed.size, '36')
    assert.equal(refreshed.quantity, 2)
    assert.deepEqual(refreshed.measurements, measurements)
    assert.equal(refreshed.title, 'Current title')
    assert.equal(refreshed.price, '₺120')
    assert.equal(useCart.getState().catalogPricesSyncedFor, 'tr:synthetic-user:dress')
  } finally {
    if (previousStorage === undefined) delete global.localStorage; else global.localStorage = previousStorage
    if (previousWindow === undefined) delete global.window; else global.window = previousWindow
  }
})

test('Variant refresh never guesses from a retired letter size to a different numeric size', () => {
  const previousStorage = global.localStorage
  const previousWindow = global.window
  const values = new Map()
  global.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  global.window = { localStorage: global.localStorage }
  try {
    const { useCart } = loader()('src/store/useCart.ts')
    const retired = '33333333-3333-4333-8333-333333333333'
    useCart.getState().addItem({ id: 'dress', title: 'Dress', price: '₺100', variantId: retired, size: 'S' })
    useCart.getState().syncCatalogPrices([], [{ id: '44444444-4444-4444-8444-444444444444', productId: 'dress', size: '32' }], 'tr:user:dress')
    assert.equal(useCart.getState().items[0].variantId, retired)
    assert.equal(useCart.getState().items[0].size, 'S')
  } finally {
    if (previousStorage === undefined) delete global.localStorage; else global.localStorage = previousStorage
    if (previousWindow === undefined) delete global.window; else global.window = previousWindow
  }
})

test('The cart catalog endpoint returns active size identities only and excludes stock quantities', async () => {
  const mockDb = {
    from(table) {
      const query = {
        select() { return this },
        in() { return this },
        eq() { return this },
        then(resolve, reject) {
          const data = table === 'products'
            ? [{ id: 'dress', name: 'Dress', price_amount: 120, compare_at_price: null, fulfillment_mode: 'made_to_order' }]
            : [{ id: '22222222-2222-4222-8222-222222222222', product_id: 'dress', size: '36', is_active: true, stock_quantity: 7 }]
          return Promise.resolve({ data, error: null }).then(resolve, reject)
        },
      }
      return query
    },
  }
  const route = loader({ '@/lib/supabase/server': { createSupabaseServerClient: async () => mockDb } })('src/app/api/storefront/cart-products/route.ts')
  const response = await route.POST(new Request('https://nrs.test/api/storefront/cart-products', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: ['dress'] }),
  }))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body.variants, [{ id: '22222222-2222-4222-8222-222222222222', productId: 'dress', size: '36' }])
  assert.equal(JSON.stringify(body).includes('stock_quantity'), false)
})

test('A quote endpoint identifies a missing delivery field instead of collapsing it to a generic checkout failure', async () => {
  const saved = process.env.ORDER_DATABASE_VERIFIED
  process.env.ORDER_DATABASE_VERIFIED = 'true'
  try {
    const route = loader({
      '@/lib/supabase/server': { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'synthetic-user' } } }) } }) },
      '@/lib/payment/repository': { createPaymentRepository() { throw new Error('Repository must not be reached for invalid customer data') } },
    })('src/app/api/orders/quote/route.ts')
    const response = await route.POST(new Request('https://nrs.test/api/orders/quote', {
      method: 'POST', headers: { origin: 'https://nrs.test', 'content-type': 'application/json' },
      body: JSON.stringify({ items: [{ productId: 'dress', variantId: '22222222-2222-4222-8222-222222222222', quantity: 1 }], customer: {
        firstName: 'Ada', lastName: 'Test', email: 'buyer@example.test', phone: '905551234567', address: '', city: 'Ankara', district: 'Çankaya', postalCode: '06800',
      } }),
    }))
    assert.equal(response.status, 422)
    assert.deepEqual(await response.json(), { code: 'CUSTOMER_FIELD_INVALID', field: 'address', reason: 'required' })
  } finally {
    if (saved === undefined) delete process.env.ORDER_DATABASE_VERIFIED
    else process.env.ORDER_DATABASE_VERIFIED = saved
  }
})

test('A sign-in event wins over a delayed initial session read and checkout can wait for profile hydration', async () => {
  let listener
  let resolveInitialSession
  let resolveProfile
  const initialSession = new Promise(resolve => { resolveInitialSession = resolve })
  const profileRead = new Promise(resolve => { resolveProfile = resolve })
  const authUser = { id: 'synthetic-user', email: 'buyer@example.test', user_metadata: { first_name: 'Ada', last_name: 'Test', phone: '905551234567' } }
  const supabase = {
    auth: {
      onAuthStateChange(callback) { listener = callback; return { data: { subscription: { unsubscribe() {} } } } },
      getSession: () => initialSession,
      signOut: async () => ({ error: null }),
    },
    from() { return { select() { return this }, eq() { return this }, maybeSingle: () => profileRead } },
  }
  const slots = []
  let cursor = 0
  let effects = []
  const fakeReact = {
    createContext: () => ({ Provider: function Provider() {} }),
    useContext: () => null,
    useEffect(effect) { effects.push(effect) },
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    },
  }
  const AuthProvider = loader({ react: fakeReact, '@/lib/supabase': { supabase } })('src/context/AuthContext.tsx').AuthProvider

  AuthProvider({ children: null })
  effects[0]()
  await new Promise(resolve => setImmediate(resolve))
  listener('SIGNED_IN', { user: authUser })
  resolveInitialSession({ data: { session: null }, error: null })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(slots[0].id, 'synthetic-user')
  assert.equal(slots[2], false)

  cursor = 0
  effects = []
  AuthProvider({ children: null })
  effects[1]()
  assert.equal(slots[3], true)
  resolveProfile({ data: { id: 'synthetic-user', first_name: 'Ada', last_name: 'Test' }, error: null })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(slots[1], { id: 'synthetic-user', first_name: 'Ada', last_name: 'Test' })
  assert.equal(slots[3], false)
})

test('Checkout account registration and existing-account login return to the same page without a cart-clearing reload', async t => {
  for (const mode of ['signup', 'login']) await t.test(mode, async () => {
    const harness = accountModalHarness(mode)
    let continued = 0
    let closed = 0
    const tree = harness.render(() => { closed++ }, () => { continued++ })
    if (mode === 'signup') {
      const registration = tree
      for (const [id, value] of [['account-first-name', 'Ada'], ['account-last-name', 'Test'], ['account-phone', '905551234567'], ['account-email', 'buyer@example.test'], ['account-password', 'synthetic-password']]) {
        findNode(registration, node => node.type === 'input' && node.props.id === id)?.props.onChange({ target: { value } })
      }
    }
    const current = harness.render(() => { closed++ }, () => { continued++ })
    const form = findNode(current, node => node.type === 'form')
    assert.ok(form)
    await form.props.onSubmit({ preventDefault() {} })
    assert.equal(continued, 1)
    assert.equal(closed, 1)
    assert.ok(harness.calls.includes(mode === 'signup' ? 'signup' : 'login'))
    assert.equal(harness.calls.includes('session'), true)
    if (mode === 'signup') assert.ok(harness.calls.includes('profile-upsert'))
  })
})

function cartPriceSyncHarness(fetchImpl) {
  const items = [{ id: 'dress', title: 'Elbise', price: '₺100', quantity: 1 }]
  const syncCalls = []
  const statusCalls = []
  const store = { items, syncCatalogPrices: (...args) => syncCalls.push(args), setCatalogPricesSynced: (...args) => statusCalls.push(args) }
  const refs = []
  let hookIndex = 0
  let effects = []
  const fakeReact = {
    useRef(initial) { const index = hookIndex++; if (!refs[index]) refs[index] = { current: initial }; return refs[index] },
    useMemo(factory) { hookIndex++; return factory() },
    useEffect(effect) { hookIndex++; effects.push(effect) },
  }
  const component = loader({
    react: fakeReact,
    '@/store/useCart': { useCart: selector => selector(store) },
    '@/context/LocaleContext': { useLocale: () => ({ locale: 'tr' }) },
    '@/context/AuthContext': { useAuth: () => ({ user: null, loading: false }) },
  })('src/components/CartPriceSync.tsx').default
  return { syncCalls, statusCalls, run() { hookIndex = 0; effects = []; component(); return effects[0]() }, install() { const old = global.fetch; global.fetch = fetchImpl; return () => { global.fetch = old } } }
}
const okCatalog = { ok: true, json: async () => ({ products: [{ id: 'dress', price: 100, compareAtPrice: null }], variants: [] }) }
const waitFor = async (check, ms = 5000) => { const end = Date.now() + ms; while (!check()) { if (Date.now() > end) throw new Error('timeout'); await new Promise(resolve => setTimeout(resolve, 20)) } }

test('CartPriceSync retries a failed catalog price request', async () => {
  let requests = 0
  const harness = cartPriceSyncHarness(async () => { requests++; return requests === 1 ? { ok: false, json: async () => ({}) } : okCatalog })
  const restore = harness.install()
  try {
    harness.run()
    await waitFor(() => harness.syncCalls.length === 1)
    assert.equal(requests, 2)
    assert.equal(harness.syncCalls[0][2], 'tr:guest:dress')
    assert.equal(harness.statusCalls.some(call => call[2] === true), false)
  } finally { restore() }
})

test('CartPriceSync reports a final failure after bounded retries', async () => {
  let requests = 0
  const harness = cartPriceSyncHarness(async () => { requests++; throw new TypeError('network down') })
  const restore = harness.install()
  try {
    harness.run()
    await waitFor(() => harness.statusCalls.some(call => call[2] === true), 8000)
    assert.equal(requests, 3)
    assert.equal(harness.syncCalls.length, 0)
    assert.deepEqual(harness.statusCalls.at(-1), [false, 'tr:guest:dress', true])
  } finally { restore() }
})

test('CartPriceSync retries after an in-flight request is cancelled', async () => {
  let requests = 0
  let resolveRequest
  const harness = cartPriceSyncHarness(() => { requests++; return new Promise(resolve => { resolveRequest = resolve }) })
  const restore = harness.install()
  try {
    const cleanup = harness.run()
    cleanup()
    resolveRequest(okCatalog)
    await new Promise(resolve => setImmediate(resolve))
    harness.run()
    await waitFor(() => requests === 2)
    resolveRequest(okCatalog)
    await waitFor(() => harness.syncCalls.length === 1)
  } finally { restore() }
})

test('A Supabase session read that never settles (in-app browser lock) does not keep checkout waiting forever', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const supabase = { auth: {
    onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } } },
    getSession: () => new Promise(() => {}),
    signOut: async () => ({ error: null }),
  }, from() { return {} } }
  const slots = []
  let cursor = 0
  const effects = []
  const fakeReact = {
    createContext: () => ({ Provider: function Provider() {} }),
    useContext: () => null,
    useEffect(effect) { effects.push(effect) },
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    },
  }
  const auth = loader({ react: fakeReact, '@/lib/supabase': { supabase } })('src/context/AuthContext.tsx')
  auth.AuthProvider({ children: null })
  const cleanup = effects[0]()
  assert.equal(slots[2], true)
  t.mock.timers.tick(auth.AUTH_INIT_TIMEOUT_MS - 1)
  assert.equal(slots[2], true)
  t.mock.timers.tick(1)
  assert.equal(slots[2], false)
  assert.equal(slots[0], null)
  cleanup()
})

test('Checkout payment keys are valid v4 UUIDs even where crypto.randomUUID is unavailable', () => {
  const { randomUuid } = loader()('src/lib/uuid.ts')
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  assert.match(randomUuid(), pattern)
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  const webcrypto = globalThis.crypto
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: bytes => webcrypto.getRandomValues(bytes) } })
  try {
    const values = new Set(Array.from({ length: 50 }, () => randomUuid()))
    assert.equal(values.size, 50)
    for (const value of values) assert.match(value, pattern)
  } finally { Object.defineProperty(globalThis, 'crypto', original) }
})
