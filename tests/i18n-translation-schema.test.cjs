const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { PGlite } = require('@electric-sql/pglite')

const sql = fs.readFileSync('supabase/migrations/20261016130000_storefront_translations.sql', 'utf8')

test('translation migration allows published translations, protects writes, and keeps hidden products private', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE TABLE public.products(id text PRIMARY KEY, status text NOT NULL, payment_test_only boolean NOT NULL);
      CREATE TABLE public.categories(id uuid PRIMARY KEY, is_active boolean NOT NULL);
      CREATE TABLE public.collections(id uuid PRIMARY KEY, is_active boolean NOT NULL);
      INSERT INTO public.products VALUES ('public-item','active',false),('private-item','active',true),('draft-item','draft',false);
      INSERT INTO public.categories VALUES ('11111111-1111-4111-8111-111111111111',true),('22222222-2222-4222-8222-222222222222',false);
      INSERT INTO public.collections VALUES ('33333333-3333-4333-8333-333333333333',true);
      CREATE FUNCTION public.nrs_is_active_admin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
      GRANT EXECUTE ON FUNCTION public.nrs_is_active_admin() TO authenticated;
      GRANT SELECT ON public.products, public.categories, public.collections TO anon, authenticated;
    `)
    await db.exec(sql)
    await db.exec(`
      INSERT INTO public.storefront_translations VALUES
        ('product','public-item','en',repeat('a',64),'{}',now(),null),
        ('product','private-item','en',repeat('b',64),'{}',now(),null),
        ('product','draft-item','ar',repeat('c',64),'{}',now(),null),
        ('category','11111111-1111-4111-8111-111111111111','en',repeat('d',64),'{}',now(),null),
        ('category','22222222-2222-4222-8222-222222222222','en',repeat('e',64),'{}',now(),null),
        ('page','about','ar',repeat('f',64),'{}',now(),null);
      SET ROLE anon;
    `)
    const visible = await db.query('select entity_type,entity_id from public.storefront_translations order by entity_type,entity_id')
    assert.deepEqual(visible.rows, [
      { entity_type: 'category', entity_id: '11111111-1111-4111-8111-111111111111' },
      { entity_type: 'page', entity_id: 'about' },
      { entity_type: 'product', entity_id: 'public-item' },
    ])
    const rls = await db.query("select relrowsecurity from pg_class where oid='public.storefront_translations'::regclass")
    assert.equal(rls.rows[0].relrowsecurity, true)
    const anonInsert = await db.query("select has_table_privilege('anon','public.storefront_translations','INSERT') AS can_insert")
    assert.equal(anonInsert.rows[0].can_insert, false)
  } finally { await db.close() }
})
