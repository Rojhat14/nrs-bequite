const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
const f=require('./payment-security-fixture.cjs');
const sql=fs.readFileSync('supabase/test-setup/dzuxhwtbuojnhibzfxqy-garanti-observation-attempts.sql','utf8');
const variant='90000000-0000-4000-8000-000000000011';
const first='10000000-0000-4000-8000-000000000001',second='10000000-0000-4000-8000-000000000002',third='10000000-0000-4000-8000-000000000003';
async function create(db,name,id,key=id,user=f.userId,hash='a'.repeat(64)){
 const summary={items:[{productId:'garanti-test-accessory',name:'Test Ürün',description:'Pamuk',size:'M',quantity:1,unitPrice:100}],buyer:{name:'Test Alıcı',email:'test@example.com',phone:'905551234567',address:'Beytepe, Çankaya, Ankara'},subtotal:120,discount:20,shipping:20,total:120,currency:'TRY',paymentMethod:'Online kartla ödeme',deliveryTerms:'Test',orderedAt:new Date().toISOString()};
 return (await db.query(`SELECT public.${name}($1::uuid,$2::uuid,null,$3::uuid,$4,$5::jsonb,$6::jsonb,$7::jsonb,'garanti-oos') result`,[id,user,key,hash,JSON.stringify([{productId:'garanti-test-accessory',variantId:variant,quantity:1}]),JSON.stringify({firstName:'Test',lastName:'Alıcı',email:'test@example.com',phone:'905551234567',address:'Beytepe',city:'Ankara',district:'Çankaya',postalCode:''}),JSON.stringify(f.historicalRecord(id,summary))])).rows[0].result;
}
test('TEST distinct attempts preserve old evidence/stock and exact-key idempotency; standard RPC still blocks pending',async()=>{
 const db=new PGlite();try{
  await f.setup(db);await db.exec(`CREATE TABLE public.garanti_test_return_diagnostics(id integer);SET app.nrs_test_project_ref='dzuxhwtbuojnhibzfxqy';INSERT INTO products VALUES('garanti-test-accessory','Test Ürün','Pamuk',100,120,'TRY','active',true);INSERT INTO product_variants VALUES('${variant}','garanti-test-accessory','M',5,true);`);
  const original=(await db.query("SELECT pg_get_functiondef('public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'::regprocedure) body")).rows[0].body;
  await db.exec(sql);assert.equal((await db.query("SELECT pg_get_functiondef('public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)'::regprocedure) body")).rows[0].body,original);
  await create(db,'nrs_create_payment_order',first);
  await db.query('SELECT public.nrs_store_payment_redirect($1::uuid,$2)',[first,'https://nrs-bequite-garanti-test.vercel.app/handoff?token=synthetic&used=1']);
  const before=(await db.query('SELECT to_jsonb(p) row FROM payment_orders p WHERE order_id=$1::uuid',[first])).rows[0].row;
  await assert.rejects(create(db,'nrs_create_payment_order',second),/Unresolved payment/);
  assert.equal((await create(db,'nrs_create_garanti_test_observation_order',second)).created,true);
  const retries=await Promise.all([create(db,'nrs_create_garanti_test_observation_order',third,second),create(db,'nrs_create_garanti_test_observation_order',third,second)]);
  for(const retry of retries){assert.equal(retry.created,false);assert.equal(retry.order.id,second)}
  await assert.rejects(create(db,'nrs_create_garanti_test_observation_order',third,second,f.otherId),/idempotency/);
  await assert.rejects(create(db,'nrs_create_garanti_test_observation_order',third,second,f.userId,'b'.repeat(64)),/idempotency/);
  assert.deepEqual((await db.query('SELECT to_jsonb(p) row FROM payment_orders p WHERE order_id=$1::uuid',[first])).rows[0].row,before);
  const counts=(await db.query(`SELECT (SELECT count(*)::int FROM payment_orders) payments,(SELECT count(*)::int FROM payment_stock_reservations WHERE released) released,(SELECT stock_quantity FROM product_variants WHERE id='${variant}') stock,(SELECT count(*)::int FROM payment_events) events`)).rows[0];
  assert.deepEqual(counts,{payments:2,released:0,stock:3,events:0});
  for(const role of ['anon','authenticated'])assert.equal((await db.query(`SELECT has_function_privilege('${role}','public.nrs_create_garanti_test_observation_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)','EXECUTE') allowed`)).rows[0].allowed,false);
  assert.equal((await db.query("SELECT has_function_privilege('service_role','public.nrs_create_garanti_test_observation_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)','EXECUTE') allowed")).rows[0].allowed,true);
  await db.exec('DELETE FROM garanti_test_observation_policy');await assert.rejects(create(db,'nrs_create_garanti_test_observation_order',third),/Isolated/);
 }finally{await db.close()}
});
test('TEST policy refuses installation outside the fixed test project',async()=>{
 const db=new PGlite();try{await f.setup(db);await assert.rejects(db.exec(sql),/Isolated Garanti TEST/)}finally{await db.close()}
});
