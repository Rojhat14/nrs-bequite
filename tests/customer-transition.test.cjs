// User-supplied definition and actual migration SQL; synthetic PostgreSQL only.
const test=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const f=require('./payment-security-fixture.cjs');
const live=f.read('tests/fixtures/nrs-live-admin-order-status.sql');
const first=f.read('supabase/migrations/20261009120000_order_access_hardening.sql');
const tables=['profiles','wishlist','orders','order_items'];
async function rows(db) {
 const result={};
 for(const table of tables) result[table]=(await db.query('SELECT to_jsonb(t) row FROM public.'+table+' t ORDER BY to_jsonb(t)::text')).rows;
 return result;
}
async function as(db,id,fn) {
 await db.exec('SET ROLE authenticated');
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);
 try {await fn()} finally {await db.exec('RESET ROLE')}
}
test('Supplied live source differs from repo legacy only in comments and UPDATE formatting',()=>{
 const legacy=f.read('supabase/migrations/20260928130000_admin_panel_access.sql').match(/FUNCTION public\.nrs_admin_update_order_status[\s\S]*?AS \$\$([\s\S]*?)\$\$;/)[1];
 const supplied=live.split('AS $function$')[1].split('$function$;')[0];
 assert.equal(legacy.replace(/^  --[^\n]*\n/gm,'').replace('UPDATE public.orders\n  SET status = p_status\n  WHERE id = p_order_id;','UPDATE public.orders SET status = p_status WHERE id = p_order_id;'),supplied);
});
test('First transaction closes all four tables before payment storage exists; final chain retains records and service ACL',async()=>{
 const db=new PGlite();let before,service;
 const acl=async()=> (await db.query("SELECT c.relname,a.privilege_type FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.relname IN ('profiles','wishlist','orders','order_items') AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname='service_role') ORDER BY 1,2")).rows;
 try {
 await f.setup(db,true,{
  beforeOrder:async()=>{
   await db.exec(live);
   await db.exec(`GRANT ALL ON profiles,wishlist,orders,order_items TO anon,authenticated,service_role;
    CREATE POLICY order_items_policy ON order_items USING(true);
    INSERT INTO profiles(id,first_name,email) VALUES('${f.userId}','Owner','owner@test');
    INSERT INTO wishlist(user_id,product_id) VALUES('${f.userId}','product');
    INSERT INTO orders(id,user_id,total_amount,status) VALUES('${f.otherId}','${f.userId}',100,'pending');
    INSERT INTO order_items(order_id,product_id,quantity,price_at_purchase) VALUES('${f.otherId}','product',1,100);`);
   before=await rows(db);service=await acl();
  },
  afterOrder:async()=>{
   assert.deepEqual(await rows(db),before);assert.deepEqual(await acl(),service);
   for(const table of ['payment_orders','payment_events','payment_stock_reservations','order_legal_records']) assert.equal((await db.query('SELECT to_regclass($1) relation',['public.'+table])).rows[0].relation,null);
   await as(db,f.userId,async()=>{
    for(const table of tables) assert.equal((await db.query('SELECT * FROM '+table)).rows.length,1);
    await db.query("UPDATE profiles SET phone='123' WHERE id=$1",[f.userId]);
    await db.query('INSERT INTO profiles(id,email) VALUES($1,$2) ON CONFLICT(id) DO NOTHING',[f.userId,'owner@test']);
    await db.query('INSERT INTO wishlist(user_id,product_id) VALUES($1,$2)',[f.userId,'another']);
    await db.exec("DELETE FROM wishlist WHERE product_id='another'");
    await assert.rejects(db.exec("UPDATE orders SET status='paid'"),/permission denied/);
   });
   await db.exec('SET ROLE anon');try {for(const table of tables) await assert.rejects(db.exec('SELECT * FROM '+table),/permission denied/)}finally{await db.exec('RESET ROLE')}
   await db.exec(`UPDATE admin_users SET is_active=true; UPDATE orders SET status=NULL WHERE id='${f.otherId}'`);
   await as(db,f.otherId,()=>assert.rejects(db.query('SELECT nrs_admin_update_order_status($1,$2)',[f.otherId,'shipped']),/unknown current order status/));
   await db.exec(`UPDATE orders SET status='pending' WHERE id='${f.otherId}'`);
   await db.exec('BEGIN');
   await db.exec("CREATE OR REPLACE FUNCTION nrs_is_active_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$SELECT NULL::boolean$$");
   await as(db,f.otherId,async()=>{
    await db.exec('SAVEPOINT auth_probe');
    await assert.rejects(db.query('SELECT nrs_admin_update_order_status($1,$2)',[f.otherId,'cancelled']),/not authorized/);
    await db.exec('ROLLBACK TO auth_probe');
   });
   await db.exec('ROLLBACK');
   await assert.rejects(db.exec(first),/Already hardened/);await db.exec('ROLLBACK');
   before=await rows(db);
  }
 });
 assert.deepEqual(await rows(db),before);assert.deepEqual(await acl(),service);
 await db.exec(f.read('supabase/migrations/20261009150000_customer_access_hardening.sql'));
 await db.exec(f.read('Raporlar/NRS_SUPABASE_SECURITY_APPLY.sql'));
 assert.deepEqual(await rows(db),before);assert.deepEqual(await acl(),service);
 } finally {await db.close()}
});
for(const [name,mutation,pattern] of [
 ['recorded migration',"CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY); INSERT INTO supabase_migrations.schema_migrations VALUES('20261009120000')",/already recorded/],
 ['nullable ownership','ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL',/NOT NULL/],
 ['required profile column missing','ALTER TABLE profiles DROP COLUMN email',/profile field/],
 ['service PUBLIC dependency','GRANT SELECT ON profiles TO PUBLIC',/depend on PUBLIC/],
]) test('First stage rolls back on '+name,async()=>{
 const db=new PGlite();let before;
 try {
  await assert.rejects(f.setup(db,true,{beforeOrder:async()=>{await db.exec(mutation);before=await rows(db)}}),pattern);
  await db.exec('ROLLBACK');assert.deepEqual(await rows(db),before);
 } finally {await db.close()}
});
test('Unreviewed live body aborts the first transaction without overwriting RPC or customer data',async()=>{
 const db=new PGlite();let before,body;
 try {
 await assert.rejects(f.setup(db,true,{beforeOrder:async()=>{
  await db.exec(live.replace("IF NOT public.nrs_is_active_admin() THEN","IF false THEN"));
  before=await rows(db);body=(await db.query("SELECT prosrc FROM pg_proc WHERE oid='public.nrs_admin_update_order_status(uuid,text)'::regprocedure")).rows[0].prosrc;
 }}),/unreviewed legacy admin RPC/);
 await db.exec('ROLLBACK');assert.deepEqual(await rows(db),before);
 assert.equal((await db.query("SELECT prosrc FROM pg_proc WHERE oid='public.nrs_admin_update_order_status(uuid,text)'::regprocedure")).rows[0].prosrc,body);
 } finally {await db.close()}
});
