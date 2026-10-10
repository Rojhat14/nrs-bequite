// Synthetic local PostgreSQL only: no environment files or remote connections.
const test=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const f=require('./payment-security-fixture.cjs');
const migration='supabase/migrations/20261009150000_customer_access_hardening.sql';
let db;
test.beforeEach(async()=>{
 db=new PGlite();await f.setup(db);
 await db.exec('DROP TABLE public.profiles,public.wishlist');
 await db.exec(`CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id),first_name text,last_name text,phone text,email text,role text DEFAULT 'customer');
 CREATE TABLE public.wishlist(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),product_id text NOT NULL REFERENCES public.products(id));
 INSERT INTO public.profiles(id,first_name) VALUES('${f.userId}','Owner'),('${f.otherId}','Admin');
 INSERT INTO public.wishlist(user_id,product_id) VALUES('${f.userId}','product'),('${f.otherId}','product');
 ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
 GRANT ALL ON public.profiles,public.wishlist TO anon,authenticated;
 GRANT UPDATE(role), REFERENCES(id) ON public.profiles TO anon,authenticated;
 CREATE POLICY unsafe_profile ON public.profiles FOR ALL TO public USING(true) WITH CHECK(true);
 CREATE POLICY unsafe_wishlist ON public.wishlist FOR ALL TO public USING(true) WITH CHECK(true);`);
 await db.exec(f.read(migration));
});
test.afterEach(async()=>{await db?.close()});
async function as(role,id,fn) {
 await db.exec('SET ROLE '+role);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);
 try {return await fn()} finally {await db.exec('RESET ROLE')}
}
test('Customer RLS: owner isolation, profile edits/signup upsert and favorite insert/delete remain available',async()=>{
 await as('authenticated',f.userId,async()=>{
  assert.deepEqual((await db.query('select id from public.profiles')).rows,[{id:f.userId}]);
  assert.deepEqual((await db.query('select user_id from public.wishlist')).rows,[{user_id:f.userId}]);
  assert.equal((await db.query("update public.profiles set first_name='Updated' where id=$1 returning id",[f.userId])).rows.length,1);
  assert.equal((await db.query("update public.profiles set phone='123' where id=$1 returning id",[f.otherId])).rows.length,0);
  await db.query('insert into public.profiles(id,email) values($1,$2) on conflict(id) do nothing',[f.userId,'test@example.com']);
  await assert.rejects(db.query('insert into public.profiles(id) values($1) on conflict(id) do nothing',[f.otherId]),/row-level security/);
  await assert.rejects(db.query('insert into public.wishlist(user_id,product_id) values($1,$2)',[f.otherId,'product']),/row-level security/);
  await db.query('insert into public.wishlist(user_id,product_id) values($1,$2)',[f.userId,'product']);
  assert.equal((await db.query('delete from public.wishlist where user_id=$1 returning id',[f.otherId])).rows.length,0);
  assert.equal((await db.query('delete from public.wishlist where user_id=$1 returning id',[f.userId])).rows.length,2);
 });
 // Simulate a new authenticated user with no profile (email-confirmed signup).
 await db.query('delete from public.profiles where id=$1',[f.userId]);
 await as('authenticated',f.userId,()=>db.query('insert into public.profiles(id,first_name,last_name,phone,email) values($1,$2,$3,$4,$5) returning id',[f.userId,'New','Customer','123','new@example.com']));
 assert.equal((await db.query('select count(*)::int n from public.profiles')).rows[0].n,2);
});
test('Customer ACL: anonymous access, role escalation, ownership changes and destructive operations are denied',async()=>{
 for(const role of ['anon','authenticated']) await as(role,role==='anon'?null:f.userId,async()=>{
  for(const sql of ["update public.profiles set role='admin'","update public.profiles set id=gen_random_uuid()",
   'delete from public.profiles','truncate public.profiles','truncate public.wishlist',
   "update public.wishlist set product_id='product'","insert into public.profiles(id,role) values(gen_random_uuid(),'admin')"])
   await assert.rejects(db.exec(sql),/permission denied/);
  if(role==='anon') for(const table of ['profiles','wishlist']) {
   await assert.rejects(db.exec('select * from public.'+table),/permission denied/);
   await assert.rejects(db.exec('delete from public.'+table),/permission denied/);
  }
 });
 const grants=(await db.query("select has_table_privilege('authenticated','profiles','TRIGGER') trigger,has_table_privilege('authenticated','wishlist','REFERENCES') refs,has_column_privilege('authenticated','profiles','role','UPDATE') role_update")).rows[0];
 assert.deepEqual(grants,{trigger:false,refs:false,role_update:false});
});
test('Active admin read is revoked immediately when inactive; admin cannot write another customer profile/favorites',async()=>{
 await as('authenticated',f.otherId,async()=>{
  for(const table of ['profiles','wishlist']) assert.equal((await db.query('select * from public.'+table)).rows.length,2);
  assert.equal((await db.query('update public.profiles set phone=$1 where id=$2 returning id',['123',f.userId])).rows.length,0);
  assert.equal((await db.query('delete from public.wishlist where user_id=$1 returning id',[f.userId])).rows.length,0);
 });
 await db.exec('update public.admin_users set is_active=false');
 await as('authenticated',f.otherId,async()=>{
  assert.deepEqual((await db.query('select id from public.profiles')).rows,[{id:f.otherId}]);
  assert.deepEqual((await db.query('select user_id from public.wishlist')).rows,[{user_id:f.otherId}]);
  await assert.rejects(db.query('select public.nrs_admin_update_order_status($1,$2)',[f.orderId,'cancelled']),/not authorized/);
 });
});
test('Customer migration reruns without modifying records; drifted required fields abort before replacing policies',async()=>{
 const before=(await db.query('select * from public.profiles order by id')).rows;
 await db.exec(f.read(migration));await db.exec(f.read(migration));
 assert.deepEqual((await db.query('select * from public.profiles order by id')).rows,before);
 const policies=(await db.query("select policyname from pg_policies where tablename in ('profiles','wishlist') order by policyname")).rows;
 await db.exec('ALTER TABLE public.profiles ADD COLUMN required_legacy text NOT NULL DEFAULT \'legacy\'; ALTER TABLE public.profiles ALTER COLUMN required_legacy DROP DEFAULT');
 await assert.rejects(db.exec(f.read(migration)),/Required customer column without default/);await db.exec('ROLLBACK');
 assert.deepEqual((await db.query("select policyname from pg_policies where tablename in ('profiles','wishlist') order by policyname")).rows,policies);
 assert.equal((await db.query('select count(*)::int n from public.wishlist')).rows[0].n,2);
});
test('Existing serial wishlist IDs retain insert ability with USAGE only',async()=>{
 await db.exec('ALTER TABLE public.wishlist DROP COLUMN id; ALTER TABLE public.wishlist ADD COLUMN id bigserial PRIMARY KEY');
 await db.exec(f.read(migration));
 await as('authenticated',f.userId,()=>db.query('insert into public.wishlist(user_id,product_id) values($1,$2) returning id',[f.userId,'product']));
 assert.equal((await db.query("select has_sequence_privilege('authenticated','public.wishlist_id_seq','USAGE') u,has_sequence_privilege('authenticated','public.wishlist_id_seq','UPDATE') w")).rows[0].u,true);
 assert.equal((await db.query("select has_sequence_privilege('authenticated','public.wishlist_id_seq','UPDATE') w")).rows[0].w,false);
});
test('Final reconciliation removes reintroduced order/item exposure and keeps latest race-safe RPC unchanged',async()=>{
 await f.create(db);
 const rpc=(await db.query("select prosrc from pg_proc where oid='public.nrs_admin_update_order_status(uuid,text)'::regprocedure")).rows[0].prosrc;
 await db.exec(`GRANT ALL ON public.orders,public.order_items TO anon,authenticated;
 GRANT UPDATE(quantity) ON public.order_items TO anon;
 CREATE POLICY leaked_items ON public.order_items FOR ALL TO public USING(true) WITH CHECK(true);`);
 await db.exec(f.read(migration));await db.exec(f.read(migration));
 assert.equal((await db.query("select prosrc from pg_proc where oid='public.nrs_admin_update_order_status(uuid,text)'::regprocedure")).rows[0].prosrc,rpc);
 await as('anon',null,()=>assert.rejects(db.exec('select product_id from public.order_items'),/permission denied/));
 await as('authenticated',f.userId,async()=>{
  assert.equal((await db.query('select * from public.order_items')).rows.length,1);
  await assert.rejects(db.exec("update public.orders set status='paid'"),/permission denied/);
 });
 await db.exec('update public.admin_users set is_active=false');
 await as('authenticated',f.otherId,async()=>assert.equal((await db.query('select * from public.orders')).rows.length,0));
 // Existing NULL-owned legacy orders remain private; migration never changes ownership.
 await db.exec('ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL');
 await db.query("insert into public.orders(user_id,total_amount,status) values(null,100,'pending')");
 await db.exec(f.read(migration));
 await as('authenticated',f.userId,async()=>assert.equal((await db.query('select * from public.orders')).rows.length,1));
 assert.equal((await db.query('select count(*)::int n from public.orders where user_id is null')).rows[0].n,1);
});
test('Metadata audit SQL executes locally in a read-only transaction and leaves customer records intact',async()=>{
 const before=(await db.query('select * from public.profiles order by id')).rows;
 await db.exec(f.read('Raporlar/NRS_SUPABASE_SCHEMA_AUDIT_20261009.sql'));
 assert.deepEqual((await db.query('select * from public.profiles order by id')).rows,before);
});
