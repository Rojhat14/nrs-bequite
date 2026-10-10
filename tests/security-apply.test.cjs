// Single Dashboard SQL artifact on synthetic PostgreSQL, never a remote DB.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const f=require('./payment-security-fixture.cjs');
const sql=fs.readFileSync('Raporlar/NRS_SUPABASE_SECURITY_APPLY.sql','utf8');
let db;
test.beforeEach(async()=>{
 db=new PGlite();await f.setup(db);
 await db.exec('DROP TABLE public.profiles,public.wishlist');
 const foundation=f.read('supabase/migrations/20260928120000_product_database_foundation.sql');
 await db.exec(foundation.slice(foundation.indexOf('CREATE OR REPLACE FUNCTION public.nrs_is_active_admin()'),foundation.indexOf('REVOKE ALL ON FUNCTION public.nrs_is_active_admin()')));
 await db.exec(`REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
 ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),first_name text,last_name text,phone text,email text,role text DEFAULT 'customer');
 CREATE TABLE public.wishlist(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),product_id text NOT NULL);
 INSERT INTO public.profiles(id,first_name) VALUES('${f.userId}','Owner'),('${f.otherId}','Admin');
 INSERT INTO public.wishlist(user_id,product_id) VALUES('${f.userId}','product'),('${f.otherId}','product');
 GRANT ALL ON public.profiles,public.wishlist TO anon,authenticated;
 GRANT UPDATE(role),REFERENCES(id) ON public.profiles TO anon,authenticated;
 GRANT UPDATE(quantity) ON public.order_items TO anon,authenticated;`);
 await f.create(db);
});
test.afterEach(async()=>{await db?.close()});
async function snapshot() {
 const out={};
 for(const t of ['profiles','wishlist','orders','order_items','admin_users','payment_orders','payment_events','payment_stock_reservations','order_legal_records','product_variants'])
  out[t]=(await db.query('select to_jsonb(t) row from public.'+t+' t order by to_jsonb(t)::text')).rows;
 out.functions=(await db.query("select p.oid,p.prosrc,p.proacl,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.oid")).rows;
 out.columns=(await db.query("select table_name,column_name,is_nullable,data_type,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position")).rows;
 out.service=(await db.query("select c.relname,a.privilege_type,a.is_grantable from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a where n.nspname='public' and c.relkind='r' and a.grantee=(select oid from pg_roles where rolname='service_role') order by c.relname,a.privilege_type")).rows;
 return out;
}
async function as(id,fn) {
 await db.exec('SET ROLE authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 try{return await fn()}finally{await db.exec('RESET ROLE')}
}
test('Single SQL: data, order NOT NULL/schema, admin records, service grants and all RPC bodies/ACLs remain identical',async()=>{
 const before=await snapshot();await db.exec(sql);
 assert.deepEqual(await snapshot(),before);
 await as(f.userId,async()=>{
  assert.equal((await db.query('select * from public.profiles')).rows.length,1);
  assert.equal((await db.query('select * from public.wishlist')).rows.length,1);
  assert.equal((await db.query('select * from public.order_items')).rows.length,1);
  for(const q of ["update public.orders set status='paid'","update public.profiles set role='admin'",'update public.order_items set quantity=99'])
   await assert.rejects(db.exec(q),/permission denied/);
  await db.query('update public.profiles set phone=$1 where id=$2',['123',f.userId]);
  await db.query('insert into public.wishlist(user_id,product_id) values($1,$2)',[f.userId,'product']);
  await assert.rejects(db.query('insert into public.wishlist(user_id,product_id) values($1,$2)',[f.otherId,'product']),/row-level security/);
 });
 await as(f.otherId,async()=>assert.equal((await db.query('select * from public.orders')).rows.length,1));
 await db.exec('update public.admin_users set is_active=false');
 await as(f.otherId,async()=>assert.equal((await db.query('select * from public.orders')).rows.length,0));
 await db.exec('SET ROLE anon');
 try{for(const t of ['orders','order_items','profiles','wishlist']) await assert.rejects(db.exec('select * from public.'+t),/permission denied/)}finally{await db.exec('RESET ROLE')}
});
for(const [name,drift,pattern] of [
 ['unknown definer',"CREATE FUNCTION public.unreviewed() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN NULL; END $$",/unknown\/changed SECURITY DEFINER/],
 ['changed known body',"CREATE OR REPLACE FUNCTION public.nrs_is_active_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT true $$",/unknown\/changed SECURITY DEFINER/],
 ['unexpected policy',"CREATE POLICY legacy_unknown ON public.profiles FOR ALL TO public USING(true)",/unreviewed policy/],
 ['nullable owner','ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL',/NOT NULL/],
 ['browser admin column privilege','GRANT UPDATE(is_active) ON public.admin_users TO authenticated',/admin registry write/],
 ['payment RPC exposure','GRANT EXECUTE ON FUNCTION public.nrs_finalize_payment(jsonb,text) TO authenticated',/service-only payment RPC permissions/],
 ['role membership','CREATE ROLE unexpected_role; GRANT unexpected_role TO authenticated',/role capabilities\/membership/],
]) test('Single SQL stops before mutation: '+name,async()=>{
 await db.exec(drift);const before=await snapshot();
 const policies=(await db.query("select * from pg_policies where schemaname='public' order by tablename,policyname")).rows;
 await assert.rejects(db.exec(sql),pattern);await db.exec('ROLLBACK');
 assert.deepEqual(await snapshot(),before);
 assert.deepEqual((await db.query("select * from pg_policies where schemaname='public' order by tablename,policyname")).rows,policies);
});
test('Single SQL reads history without replay or write; repeat only reconciles ACLs and serial favorites stay usable',async()=>{
 await db.exec("CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY); INSERT INTO supabase_migrations.schema_migrations VALUES ('20261009140000'); ALTER TABLE public.wishlist DROP COLUMN id; ALTER TABLE public.wishlist ADD COLUMN id bigserial PRIMARY KEY");
 const before=await snapshot();await db.exec(sql);await db.exec(sql);
 assert.deepEqual(await snapshot(),before);
 assert.deepEqual((await db.query('select * from supabase_migrations.schema_migrations')).rows,[{version:'20261009140000'}]);
 await as(f.userId,()=>db.query('insert into public.wishlist(user_id,product_id) values($1,$2)',[f.userId,'product']));
 assert.equal((await db.query("select has_sequence_privilege('authenticated','public.wishlist_id_seq','UPDATE') allowed")).rows[0].allowed,false);
});
test('SQL artifact never redefines RPCs, runs prior migration files or performs customer DML/schema conversion',()=>{
 assert.doesNotMatch(sql,/CREATE(?: OR REPLACE)? FUNCTION|ALTER COLUMN|INSERT INTO public\.|UPDATE public\.|DELETE FROM public\.|TRUNCATE public\.|DROP TABLE/);
});
