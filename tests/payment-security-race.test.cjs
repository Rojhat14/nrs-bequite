// Optional native PostgreSQL test. Packages are installed outside this project.
// Creates its OWN synthetic temporary cluster; accepts no database URL/secret.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {pathToFileURL}=require('node:url');
const f=require('./payment-security-fixture.cjs');
const {loader}=require('./source-loader.cjs');
const load=loader();
const {prepareOrderLegalRecord}=load('src/lib/legal/payment-preflight.ts');
const {createLegalAcceptance}=load('src/lib/legal/acceptance.ts');
const packages=process.env.NRS_LOCAL_POSTGRES_PACKAGES;
const enabled=!!packages;
let cluster,observer,adminClient,callbackClient;
const wrap=client=>({exec:sql=>client.query(sql),query:(sql,args)=>client.query(sql,args)});
async function availablePort() {
 const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;
}
test.before(async()=>{
 if(!enabled)return;
 const {default:EmbeddedPostgres}=await import(pathToFileURL(path.join(packages,'node_modules/embedded-postgres/dist/index.js')).href);
 const dir=fs.mkdtempSync('/private/tmp/nrs-security-race-');
 cluster=new EmbeddedPostgres({databaseDir:path.join(dir,'db'),user:'postgres',password:'synthetic-local-test-only',
  port:await availablePort(),persistent:true,createPostgresUser:false,
  postgresFlags:['-h','127.0.0.1','-k',dir],onLog:()=>{},onError:error=>console.error(String(error))});
 const initialiseTimeout=setTimeout(()=>{throw new Error('Local PostgreSQL startup timed out')},20000);
 try {await cluster.initialise();await cluster.start()} finally {clearTimeout(initialiseTimeout)}
 observer=cluster.getPgClient('postgres','127.0.0.1');await observer.connect();
 await f.setup(wrap(observer));
 adminClient=cluster.getPgClient('postgres','127.0.0.1');callbackClient=cluster.getPgClient('postgres','127.0.0.1');
 await adminClient.connect();await callbackClient.connect();
 for(const client of [observer,adminClient,callbackClient]) await client.query("set statement_timeout='8s'");
});

async function newOrder(client,id,owner) {
 const summary={items:[{productId:'product',name:'Test Ürün',description:'Pamuk',size:'M',quantity:1,unitPrice:100}],
  buyer:{name:'Test Alıcı',email:'test@example.com',phone:'905551234567',address:'Beytepe, Çankaya, Ankara'},
  subtotal:120,discount:20,shipping:20,total:120,currency:'TRY',paymentMethod:'Online kartla ödeme',deliveryTerms:'Teyit edilmiş süre',orderedAt:new Date().toISOString()};
 return client.query('select public.nrs_create_payment_order($1::uuid,$2::uuid,null,$1::uuid,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7) result',
  [id,owner,'a'.repeat(64),JSON.stringify([{productId:'product',variantId:'44444444-4444-4444-8444-444444444444',quantity:1}]),
   JSON.stringify({firstName:'Test',lastName:'Alıcı',email:'test@example.com',phone:'905551234567',address:'Beytepe',city:'Ankara',district:'Çankaya',postalCode:''}),
   JSON.stringify(f.historicalRecord(id,summary)),'test-bank']);
}
for(const sameKey of [false,true]) test(`Native PostgreSQL: concurrent creation ${sameKey?'same idempotency key':'two buyers, last stock'}`,{skip:!enabled,timeout:20000},async()=>{
 await observer.query('TRUNCATE public.orders CASCADE');
 await observer.query('update public.product_variants set stock_quantity=1');
 await adminClient.query('SET ROLE service_role');await callbackClient.query('SET ROLE service_role');
 await adminClient.query('BEGIN');
 try {
  // Hold the exact lock used by creation before starting the competing call.
  await adminClient.query('RESET ROLE');
  if(sameKey) await adminClient.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[f.orderId]);
  else await adminClient.query("select id from public.products where id='product' for update");
  await adminClient.query('SET ROLE service_role');
  const pid=(await callbackClient.query('select pg_backend_pid() pid')).rows[0].pid;
  const waiting=newOrder(callbackClient,sameKey?f.orderId:f.otherId,sameKey?f.userId:f.otherId)
   .then(result=>({ok:true,result}),error=>({ok:false,error}));
  await waitBlocked(pid);
  const first=await newOrder(adminClient,f.orderId,f.userId);
  assert.equal(first.rows[0].result.created,true);
  await adminClient.query('COMMIT');
  const second=await waiting;
  if(sameKey) {assert.equal(second.ok,true);assert.equal(second.result.rows[0].result.created,false)}
  else {assert.equal(second.ok,false);assert.match(second.error.message,/stock unavailable/)}
  assert.equal((await observer.query('select count(*)::int n from public.orders')).rows[0].n,1);
  assert.equal((await observer.query('select count(*)::int n from public.order_legal_records')).rows[0].n,1);
  assert.equal((await observer.query('select stock_quantity from public.product_variants')).rows[0].stock_quantity,0);
 } finally {
  await adminClient.query('ROLLBACK');await adminClient.query('RESET ROLE');await callbackClient.query('RESET ROLE');
 }
});
test.after(async()=>{
 for(const client of [adminClient,callbackClient,observer]) if(client) await client.end();
 if(cluster) await cluster.stop();
});
async function waitBlocked(pid) {
 const until=Date.now()+5000;
 while(Date.now()<until) {
  const {rows}=await observer.query("select wait_event_type from pg_stat_activity where pid=$1",[pid]);
  if(rows[0]?.wait_event_type==='Lock') return;
  await new Promise(resolve=>setTimeout(resolve,10));
 }
 throw new Error('Second transaction did not demonstrably wait on a PostgreSQL lock');
}
async function prepare() {
 // Only this newly created synthetic cluster. No customer/live records exist.
 await observer.query('TRUNCATE public.orders CASCADE');
 await observer.query('update public.product_variants set stock_quantity=1');
 await f.create(wrap(observer));
 await adminClient.query('SET ROLE authenticated');
 await adminClient.query("select set_config('request.jwt.claim.sub',$1,false)",[f.otherId]);
 await callbackClient.query('SET ROLE service_role');
}
for(const first of ['admin','callback']) test(`Native PostgreSQL: concurrent cancellation/paid callback (${first} locks first)`,{skip:!enabled,timeout:20000},async()=>{
 await prepare();
 assert.match((await observer.query('select version() v')).rows[0].v,/PostgreSQL/);
 const leading=first==='admin'?adminClient:callbackClient;
 const waiting=first==='admin'?callbackClient:adminClient;
 const pid=(await waiting.query('select pg_backend_pid() pid')).rows[0].pid;
 await leading.query('BEGIN');
 try {
  // Hold the same first row lock as BOTH production RPCs. Calls really overlap
  // on independent server connections; no sleep-based fake Promise race.
  // Test superuser holds the definer's first lock; restore actual caller role
  // before invoking either RPC. Do not grant browser roles table access.
  await leading.query('RESET ROLE');
  await leading.query('select order_id from public.payment_orders where order_id=$1::uuid for update',[f.orderId]);
  await leading.query('SET ROLE '+(first==='admin'?'authenticated':'service_role'));
  const cancel=()=>adminClient.query('select public.nrs_admin_update_order_status($1::uuid,$2)',[f.orderId,'cancelled']);
  const settle=()=>callbackClient.query('select public.nrs_finalize_payment($1::jsonb,$2)',[JSON.stringify(f.callback()),'test-bank']);
  const blocked=(first==='admin'?settle():cancel()).then(()=>({ok:true}),error=>({ok:false,error}));
  await waitBlocked(pid);
  if(first==='admin') {
   await leading.query('SAVEPOINT expected_rejection');
   await assert.rejects(cancel(),/Unresolved online payment/);
   await leading.query('ROLLBACK TO SAVEPOINT expected_rejection');
  } else await settle();
  await leading.query('COMMIT');
  const result=await blocked;
  if(first==='admin') assert.equal(result.ok,true);
  else {assert.equal(result.ok,false);assert.match(result.error.message,/payment state cannot/)}
  await f.finalize(wrap(callbackClient));
  assert.deepEqual(await f.state(wrap(observer)),{status:'paid',state:'paid',stock_quantity:0,events:1,released:0});
 } finally {
  await leading.query('ROLLBACK');
  await adminClient.query('RESET ROLE');await callbackClient.query('RESET ROLE');
 }
});
