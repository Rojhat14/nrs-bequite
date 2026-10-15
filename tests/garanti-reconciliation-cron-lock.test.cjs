const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')
const fixture = require('./payment-security-fixture.cjs')

test('scheduled reconciliation lease serializes invocations, is owner-token bound, and expires safely', async () => {
  const db = new PGlite()
  try {
    await fixture.setup(db)
    await db.exec(`CREATE FUNCTION public.nrs_garanti_service_role_request() RETURNS boolean LANGUAGE sql STABLE AS $$
      SELECT coalesce(current_setting('request.jwt.claim.role',true),'')='service_role' $$;`)
    await db.exec(fs.readFileSync('supabase/migrations/20261015110000_garanti_reconciliation_cron_lock.sql', 'utf8'))

    await db.query("select set_config('request.jwt.claim.role','authenticated',false)")
    await assert.rejects(db.query("select public.nrs_acquire_garanti_reconciliation_cron_lock('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')"),
      error => error.code === '42501')

    await db.query("select set_config('request.jwt.claim.role','service_role',false)")
    const first = await db.query("select public.nrs_acquire_garanti_reconciliation_cron_lock('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') as acquired")
    assert.equal(first.rows[0].acquired, true)
    const concurrent = await db.query("select public.nrs_acquire_garanti_reconciliation_cron_lock('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') as acquired")
    assert.equal(concurrent.rows[0].acquired, false)
    const wrongRelease = await db.query("select public.nrs_release_garanti_reconciliation_cron_lock('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') as released")
    assert.equal(wrongRelease.rows[0].released, false)
    const correctRelease = await db.query("select public.nrs_release_garanti_reconciliation_cron_lock('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') as released")
    assert.equal(correctRelease.rows[0].released, true)
    const second = await db.query("select public.nrs_acquire_garanti_reconciliation_cron_lock('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') as acquired")
    assert.equal(second.rows[0].acquired, true)

    await db.exec("update public.garanti_reconciliation_cron_locks set lease_expires_at=now()-interval '1 second'")
    const recovered = await db.query("select public.nrs_acquire_garanti_reconciliation_cron_lock('cccccccc-cccc-4ccc-8ccc-cccccccccccc') as acquired")
    assert.equal(recovered.rows[0].acquired, true)
  } finally { await db.close() }
})
