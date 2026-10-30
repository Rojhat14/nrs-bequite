const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', customer = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const order = n => `00000000-0000-4000-8000-00000000000${n}`;

async function database() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
  CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  CREATE TABLE public.admin_users(user_id uuid primary key, role text, is_active boolean);
  INSERT INTO public.admin_users VALUES('${admin}','admin',true);
  CREATE FUNCTION public.nrs_is_active_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
    SELECT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id=(SELECT auth.uid()) AND au.role='admin' AND au.is_active) $$;
  CREATE TABLE public.orders(id uuid primary key, status text not null, manual_paid_at timestamptz);
  CREATE TABLE public.payment_orders(order_id uuid primary key references public.orders(id) ON DELETE RESTRICT, state text);
  INSERT INTO public.orders VALUES
    ('${order(1)}','cancelled',null),  -- unpaid cancel: archivable
    ('${order(2)}','cancelled',null),  -- failed card attempt: archivable
    ('${order(3)}','cancelled',now()), -- confirmed transfer: keep
    ('${order(4)}','cancelled',null),  -- paid online: keep
    ('${order(5)}','pending',null);    -- not cancelled: keep
  INSERT INTO public.payment_orders VALUES('${order(2)}','failed'),('${order(4)}','paid');`);
  await db.exec(fs.readFileSync('supabase/migrations/20261030140000_admin_order_archive.sql', 'utf8'));
  return db;
}
const as = (db, id) => db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
const archived = async db => (await db.query('select id from public.orders where admin_archived_at is not null order by id')).rows.map(row => row.id);

test('only unpaid cancelled orders can be archived, and only by an active admin', async () => {
  const db = await database();
  await as(db, customer);
  await assert.rejects(db.query('select public.nrs_admin_set_order_archived($1,true)', [order(1)]), /not authorized/);
  await assert.rejects(db.query('select public.nrs_admin_archive_unpaid_cancelled_orders()'), /not authorized/);
  await as(db, admin);
  for (const id of [order(3), order(4)]) await assert.rejects(db.query('select public.nrs_admin_set_order_archived($1,true)', [id]), /paid or unresolved/);
  await assert.rejects(db.query('select public.nrs_admin_set_order_archived($1,true)', [order(5)]), /only cancelled/);
  await db.query('select public.nrs_admin_set_order_archived($1,true)', [order(1)]);
  assert.deepEqual(await archived(db), [order(1)]);
  await db.query('select public.nrs_admin_set_order_archived($1,false)', [order(1)]);
  assert.deepEqual(await archived(db), []);
});

test('bulk archive takes every unpaid cancelled order and nothing else; rows are kept', async () => {
  const db = await database();
  await as(db, admin);
  const { rows } = await db.query('select public.nrs_admin_archive_unpaid_cancelled_orders() as n');
  assert.equal(rows[0].n, 2);
  assert.deepEqual(await archived(db), [order(1), order(2)]);
  assert.equal((await db.query('select count(*)::int as n from public.orders')).rows[0].n, 5);
  assert.equal((await db.query('select public.nrs_admin_archive_unpaid_cancelled_orders() as n')).rows[0].n, 0);
});
