const test=require('node:test'),assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {build,targetRef}=require('../scripts/build-garanti-test-bootstrap.cjs');
const platform=`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA auth TO authenticated;`;
test('Empty TEST bootstrap creates secured schema, existing RPCs and two products, with no orders or admin provisioning',async()=>{
 const db=new PGlite();await db.exec(platform);
 try{
  await db.exec(build());
  assert.equal((await db.query('select count(*)::int n from public.products')).rows[0].n,2);
  for(const table of ['orders','order_items','payment_orders','payment_events','order_legal_records','admin_users'])
   assert.equal((await db.query(`select count(*)::int n from public.${table}`)).rows[0].n,0);
  assert.equal((await db.query("select count(*)::int n from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='public' and c.relkind='r' and not c.relrowsecurity")).rows[0].n,0);
  assert.equal((await db.query("select has_function_privilege('anon','public.nrs_finalize_payment(jsonb,text)','EXECUTE') allowed")).rows[0].allowed,false);
  assert.equal((await db.query("select has_function_privilege('service_role','public.nrs_finalize_payment(jsonb,text)','EXECUTE') allowed")).rows[0].allowed,true);
  await db.exec('SET ROLE anon');
  assert.equal((await db.query('select count(*)::int n from public.products')).rows[0].n,2);
  await assert.rejects(db.query('select * from public.orders'));
  await db.exec('RESET ROLE');
  await assert.rejects(db.exec(build()),/empty public schema/);await db.exec('ROLLBACK');
  assert.equal((await db.query('select count(*)::int n from public.products')).rows[0].n,2);
 }finally{await db.close()}
});
test('Bootstrap refuses a populated/live application schema without modifying data',async()=>{
 const db=new PGlite();await db.exec(platform+"CREATE TABLE public.orders(id int);INSERT INTO public.orders VALUES(7)");
 try{await assert.rejects(db.exec(build()),/empty public schema/);await db.exec('ROLLBACK');
 assert.equal((await db.query('select id from public.orders')).rows[0].id,7);
 assert.equal((await db.query("select to_regclass('public.payment_orders') exists")).rows[0].exists,null);
 assert.equal(targetRef,'dzuxhwtbuojnhibzfxqy');}finally{await db.close()}
});
