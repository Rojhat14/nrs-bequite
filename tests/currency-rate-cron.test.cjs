const test = require('node:test')
const assert = require('node:assert/strict')
const { loader } = require('./source-loader.cjs')

test('currency refresh is protected, stores the ECB rate, and invalidates the current-rate cache', async () => {
  const oldEnv = {
    cron: process.env.CRON_SECRET,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
  const oldFetch = global.fetch
  const stored = []
  const invalidated = []
  const xml = `<gesmes:Envelope><Cube><Cube time="2026-10-16"><Cube currency="USD" rate="1.1253"/><Cube currency="TRY" rate="55.7328"/></Cube></Cube></gesmes:Envelope>`
  process.env.CRON_SECRET = 'unit-test-cron-secret-value'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://nrs-test.example.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'unit-test-service-role'
  global.fetch = async () => new Response(xml, { status: 200, headers: { 'Content-Type': 'application/xml' } })

  try {
    const load = loader({
      'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
      'next/cache': { revalidateTag: (tag) => invalidated.push(tag) },
      '@supabase/supabase-js': { createClient: () => ({ from: (table) => ({
        upsert: async (row, options) => { stored.push({ table, row, options }); return { error: null } },
      }) }) },
    })
    const { GET } = load('src/app/api/cron/update-currency-rate/route.ts')
    const denied = await GET(new Request('https://nrs.test/api/cron/update-currency-rate'))
    assert.equal(denied.status, 401)
    assert.equal(stored.length, 0)

    const response = await GET(new Request('https://nrs.test/api/cron/update-currency-rate', {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    }))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      state: 'updated', base: 'USD', quote: 'TRY',
      fetchedAt: stored[0].row.fetched_at, rateDate: '2026-10-16',
    })
    assert.equal(stored[0].table, 'currency_reference_rates')
    assert.equal(stored[0].row.base_currency, 'USD')
    assert.equal(stored[0].row.quote_currency, 'TRY')
    assert.equal(stored[0].row.provider, 'ecb-euro-reference')
    assert.equal(stored[0].row.usd_try, 55.7328 / 1.1253)
    assert.deepEqual(stored[0].options, { onConflict: 'base_currency,quote_currency,rate_date' })
    assert.deepEqual(invalidated, ['currency-reference-rate'])
  } finally {
    global.fetch = oldFetch
    if (oldEnv.cron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = oldEnv.cron
    if (oldEnv.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldEnv.url
    if (oldEnv.service === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldEnv.service
  }
})
