const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')
const { pathToFileURL } = require('node:url')
const { PGlite } = require('@electric-sql/pglite')
const fixture = require('./payment-security-fixture.cjs')
const { loader } = require('./source-loader.cjs')

test('Guest owner migration keeps browser table access closed and permits an expiring server capability', async () => {
  const db = new PGlite()
  try {
    await fixture.setup(db)
    await db.exec(fs.readFileSync('supabase/migrations/20261024150000_guest_checkout_owner.sql', 'utf8'))

    const nullable = await db.query("SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='user_id'")
    assert.equal(nullable.rows[0].is_nullable, 'YES')
    const foreignKey = await db.query("SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid='public.orders'::regclass AND contype='f' AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.orders'::regclass AND attname='user_id')]")
    assert.equal(foreignKey.rows[0].n, 1)
    for (const [role, table, privilege] of [
      ['anon', 'orders', 'SELECT'], ['anon', 'orders', 'INSERT'], ['anon', 'order_items', 'SELECT'],
      ['anon', 'payment_orders', 'SELECT'], ['authenticated', 'payment_orders', 'INSERT'],
    ]) {
      assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) AS allowed', [role, `public.${table}`, privilege])).rows[0].allowed, false)
    }
    assert.equal((await db.query("SELECT has_function_privilege('anon','public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)','EXECUTE') AS allowed")).rows[0].allowed, false)

    const guestHash = 'a'.repeat(64)
    const guestLegal = fixture.historicalRecord(fixture.orderId, fixture.summary)
    const result = await db.query('SELECT public.nrs_create_payment_order($1::uuid,NULL,$2,$1::uuid,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7) AS result', [
      fixture.orderId, guestHash, 'b'.repeat(64), JSON.stringify(fixture.items), JSON.stringify(fixture.customer), JSON.stringify(guestLegal), 'test-bank',
    ])
    assert.equal(result.rows[0].result.created, true)
    const stored = (await db.query('SELECT o.user_id,p.guest_hash,p.guest_expires_at FROM public.orders o JOIN public.payment_orders p ON p.order_id=o.id WHERE o.id=$1::uuid', [fixture.orderId])).rows[0]
    assert.equal(stored.user_id, null)
    assert.equal(stored.guest_hash, guestHash)
    assert.ok(new Date(stored.guest_expires_at).getTime() > Date.now())
    assert.equal((await db.query('SELECT public.nrs_read_payment_order($1::uuid,NULL,$2) AS result', [fixture.orderId, 'c'.repeat(64)])).rows[0].result, null)
    assert.ok((await db.query('SELECT public.nrs_read_payment_order($1::uuid,NULL,$2) AS result', [fixture.orderId, guestHash])).rows[0].result)
    const retry = await db.query('SELECT public.nrs_create_payment_order($1::uuid,NULL,$2,$1::uuid,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7) AS result', [
      fixture.orderId, guestHash, 'b'.repeat(64), JSON.stringify(fixture.items), JSON.stringify(fixture.customer), JSON.stringify(guestLegal), 'test-bank',
    ])
    assert.equal(retry.rows[0].result.created, false)
    await assert.rejects(db.query('SELECT public.nrs_create_payment_order($1::uuid,NULL,$2,$1::uuid,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7) AS result', [
      fixture.orderId, 'c'.repeat(64), 'b'.repeat(64), JSON.stringify(fixture.items), JSON.stringify(fixture.customer), JSON.stringify(guestLegal), 'test-bank',
    ]), /idempotency ownership\/content mismatch/)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.orders')).rows[0].n, 1)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.payment_stock_reservations')).rows[0].n, 1)
  } finally { await db.close() }
})

const nativePackages = process.env.NRS_LOCAL_POSTGRES_PACKAGES
test('Native PostgreSQL: guest owner migration applies and keeps anonymous access closed', { skip: !nativePackages, timeout: 30000 }, async () => {
  const { default: EmbeddedPostgres } = await import(pathToFileURL(path.join(nativePackages, 'node_modules/embedded-postgres/dist/index.js')).href)
  const dir = fs.mkdtempSync('/private/tmp/nrs-guest-owner-pg-')
  const server = net.createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  const cluster = new EmbeddedPostgres({ databaseDir: path.join(dir, 'db'), user: 'postgres', password: 'synthetic-local-test-only',
    port, persistent: true, createPostgresUser: false, postgresFlags: ['-h', '127.0.0.1', '-k', dir], onLog: () => {}, onError: error => { throw error } })
  await cluster.initialise(); await cluster.start()
  const client = cluster.getPgClient('postgres', '127.0.0.1')
  try {
    await client.connect()
    const db = { exec: sql => client.query(sql), query: (sql, params) => client.query(sql, params) }
    await fixture.setup(db)
    await db.exec(fs.readFileSync('supabase/migrations/20261024150000_guest_checkout_owner.sql', 'utf8'))
    const owner = await db.query("SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='user_id'")
    assert.equal(owner.rows[0].is_nullable, 'YES')
    assert.equal((await db.query("SELECT has_table_privilege('anon','public.orders','SELECT') AS allowed")).rows[0].allowed, false)
    const legal = fixture.historicalRecord(fixture.orderId, fixture.summary)
    const params = [fixture.orderId, 'a'.repeat(64), 'b'.repeat(64), JSON.stringify(fixture.items), JSON.stringify(fixture.customer), JSON.stringify(legal), 'test-bank']
    const created = await db.query('SELECT public.nrs_create_payment_order($1::uuid,NULL,$2,$1::uuid,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7) AS result', params)
    assert.equal(created.rows[0].result.created, true)
    const retry = await db.query('SELECT public.nrs_create_payment_order($1::uuid,NULL,$2,$1::uuid,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7) AS result', params)
    assert.equal(retry.rows[0].result.created, false)
    assert.ok((await db.query('SELECT public.nrs_read_payment_order($1::uuid,NULL,$2) AS result', [fixture.orderId, 'a'.repeat(64)])).rows[0].result)
    assert.equal((await db.query('SELECT public.nrs_read_payment_order($1::uuid,NULL,$2) AS result', [fixture.orderId, 'c'.repeat(64)])).rows[0].result, null)
  } finally {
    await client.end()
    await cluster.stop()
  }
})

test('Guest checkout UI starts with delivery information and cart checkout goes straight to /checkout', () => {
  const page = fs.readFileSync('src/app/checkout/page.tsx', 'utf8')
  const cart = fs.readFileSync('src/components/CartDrawer.tsx', 'utf8')
  assert.match(page, /useState\(2\).*account sign-in is optional/)
  assert.doesNotMatch(page, /if \(!user\) \{ setAuthOpen/)
  assert.doesNotMatch(page, /Kartla ödeme için hesabınıza giriş yapın/)
  assert.match(cart, /router\.push\('\/checkout'\)/)
  assert.doesNotMatch(cart, /İncele/)
})

test('Guest access cookie is HttpOnly, scoped to the site, and never returned in JSON', async () => {
  const access = loader()('src/lib/payment/access.ts')
  const saved = new Map()
  const jar = { get: name => saved.has(name) ? { value: saved.get(name).value } : undefined,
    set: (name, value, options) => saved.set(name, { value, options }) }
  const route = loader({ 'next/headers': { cookies: async () => jar },
    '@/lib/payment/http': { sameOrigin: request => request.headers.get('origin') === new URL(request.url).origin } })
    ('src/app/api/payment/guest-access/route.ts')
  const request = new Request('https://shop.example/api/payment/guest-access', { method: 'POST', headers: { origin: 'https://shop.example' }, body: '{}' })
  const response = await route.POST(request)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { ready: true })
  const cookie = saved.get(access.GUEST_COOKIE)
  assert.match(cookie.value, /^[0-9a-f]{64}$/)
  assert.equal(cookie.options.httpOnly, true)
  assert.equal(cookie.options.sameSite, 'lax')
  assert.equal(cookie.options.path, '/')
  assert.equal(cookie.options.maxAge, access.GUEST_ACCESS_SECONDS)
  assert.equal(access.hashGuestToken(cookie.value).length, 64)
  const rejected = await route.POST(new Request('https://shop.example/api/payment/guest-access', { method: 'POST', headers: { origin: 'https://attacker.example' }, body: '{}' }))
  assert.equal(rejected.status, 403)
})
