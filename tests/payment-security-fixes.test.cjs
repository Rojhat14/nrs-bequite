const test=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const f=require('./payment-security-fixture.cjs');
const {loader}=require('./source-loader.cjs');
let db;
test.beforeEach(async()=>{db=new PGlite();await f.setup(db)});
test.afterEach(async()=>{await db?.close()});

for(const paymentState of ['initiating','pending']) test(`PostgreSQL: admin cannot cancel ${paymentState}; delayed paid settles and replays once`,async()=>{
 await f.create(db);
 if(paymentState==='pending') await db.query("select public.nrs_store_payment_redirect($1::uuid,'https://bank.invalid/test')",[f.orderId]);
 const before=await f.state(db);
 await assert.rejects(f.admin(db),/Unresolved online payment/);
 assert.deepEqual(await f.state(db),before);
 await f.finalize(db); await f.finalize(db); await f.finalize(db,{eventId:'second-paid'});
 assert.deepEqual(await f.state(db),{status:'paid',state:'paid',stock_quantity:0,events:2,released:0});
 await assert.rejects(f.admin(db),/payment state cannot/);
});

test('PostgreSQL: verified failed releases reservation exactly once; contradiction rolls back',async()=>{
 await f.create(db);
 await assert.rejects(f.admin(db),/Unresolved/);
 await f.finalize(db,{status:'failed',threeDS:'failed'});
 await f.finalize(db,{status:'failed',threeDS:'failed'});
 await f.finalize(db,{status:'failed',threeDS:'failed',eventId:'failed-again'});
 const settled=await f.state(db);
 assert.deepEqual(settled,{status:'cancelled',state:'failed',stock_quantity:1,events:2,released:1});
 await assert.rejects(f.finalize(db,{eventId:'contradictory-paid'}),/terminal state conflict/);
 assert.deepEqual(await f.state(db),settled);
});

test('PostgreSQL: provider-authenticated reconciliation resolves uncertain initiation as paid',async()=>{
 await f.create(db);await assert.rejects(f.admin(db),/Unresolved/);
 const {reconcilePayment}=loader()('src/lib/payment/service.ts');
 const provider={name:'test-bank',merchantId:'test',reconcile:async()=>f.callback()};
 const repository={finalizeAtomic:async(payment,name)=>db.query('select public.nrs_finalize_payment($1::jsonb,$2)',[JSON.stringify(payment),name])};
 await reconcilePayment(f.orderId,repository,provider);await reconcilePayment(f.orderId,repository,provider);
 assert.deepEqual(await f.state(db),{status:'paid',state:'paid',stock_quantity:0,events:1,released:0});
 provider.reconcile=async()=>f.callback({threeDS:'failed'});
 await assert.rejects(reconcilePayment(f.orderId,repository,provider),/verification failed/);
});

for(const oldStatus of [null,'unknown-legacy']) test(`PostgreSQL: old status ${oldStatus} fails closed without partial writes`,async()=>{
 await db.exec('ALTER TABLE public.orders DROP CONSTRAINT orders_status_check');
 await db.query('insert into public.orders(id,user_id,total_amount,status) values($1::uuid,$2::uuid,100,$3)',[f.orderId,f.userId,oldStatus]);
 const before=await f.state(db);
 for(const next of ['cancelled','shipped']) await assert.rejects(f.admin(db,next),/unknown current order status/);
 assert.deepEqual(await f.state(db),before);
});

test('PostgreSQL: new NULL/unknown statuses and invalid transitions are rejected; offline transitions preserved',async()=>{
 await db.query("insert into public.orders(id,user_id,total_amount,status) values($1::uuid,$2::uuid,100,'pending')",[f.orderId,f.userId]);
 const before=await f.state(db);
 for(const next of [null,'invented','paid']) await assert.rejects(f.admin(db,next),/unsupported operational/);
 await assert.rejects(f.admin(db,'shipped'),/unpaid/);
 assert.deepEqual(await f.state(db),before);
 await f.admin(db);assert.equal((await f.state(db)).status,'cancelled');
 await assert.rejects(f.admin(db,'processing'),/not editable/);
 await db.query("update public.orders set status='processing' where id=$1::uuid",[f.orderId]);
 await assert.rejects(f.admin(db,'pending'),/unsupported fulfillment/);
 await f.admin(db,'shipped');await f.admin(db,'delivered');
 await assert.rejects(f.admin(db,'cancelled'),/not editable/);
 assert.equal((await f.state(db)).status,'delivered');
});

for(const missing of ['processing','shipped','delivered','pending']) test(`PostgreSQL: preflight rejects CHECK missing ${missing} without replacing RPC or data`,async()=>{
 const before=(await db.query("select prosrc from pg_proc where oid='public.nrs_admin_update_order_status(uuid,text)'::regprocedure")).rows[0].prosrc;
 const states=['pending','payment_pending','paid','processing','shipped','delivered','cancelled'].filter(x=>x!==missing);
 await db.exec(`ALTER TABLE public.orders DROP CONSTRAINT orders_status_check; ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK(status IN(${states.map(x=>"'"+x+"'").join(',')}))`);
 await assert.rejects(db.exec(f.read(f.correction)),new RegExp(`Status ${missing} incompatible`));await db.exec('ROLLBACK');
 assert.equal((await db.query("select prosrc from pg_proc where oid='public.nrs_admin_update_order_status(uuid,text)'::regprocedure")).rows[0].prosrc,before);
 assert.equal((await db.query('select count(*)::int n from public.orders')).rows[0].n,0);
});

test('PostgreSQL: compatible status CHECK reruns safely; composite constraint and enum divergence fail',async()=>{
 await db.exec(f.read(f.correction));
 await db.exec("ALTER TABLE public.orders ADD CONSTRAINT composite_status CHECK(status<>'paid' OR total_amount>0)");
 await assert.rejects(db.exec(f.read(f.correction)),/Review composite status constraint/);await db.exec('ROLLBACK');
 await db.exec("ALTER TABLE public.orders DROP CONSTRAINT composite_status; ALTER TABLE public.orders DROP CONSTRAINT orders_status_check; ALTER TABLE public.orders ALTER COLUMN status DROP DEFAULT; CREATE TYPE legacy_status AS ENUM ('pending','paid'); ALTER TABLE public.orders ALTER COLUMN status TYPE legacy_status USING status::legacy_status");
 await assert.rejects(db.exec(f.read(f.correction)),/enum\/domain status requires explicit review/);await db.exec('ROLLBACK');
});

test('PostgreSQL: existing cancelled/unresolved conflict aborts preflight rather than guessing settlement',async()=>{
 await f.create(db);await db.exec("update public.orders set status='cancelled'");
 await assert.rejects(db.exec(f.read(f.correction)),/Existing unresolved payment\/order conflict/);await db.exec('ROLLBACK');
 assert.deepEqual(await f.state(db),{status:'cancelled',state:'initiating',stock_quantity:0,events:0,released:0});
});

test('Admin UI hides status mutation while online settlement is unresolved, preserving offline cancellation',()=>{
 const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
 const Form=loader({react:{...React,useState:initial=>[initial,()=>{}]},'next/navigation':{useRouter:()=>({refresh(){}})},'@/app/admin/(protected)/actions':{updateOrderStatus:async()=>({ok:true})}})('src/components/admin/OrderStatusForm.tsx').default;
 for(const paymentState of ['initiating','pending']) {
  const html=renderToStaticMarkup(React.createElement(Form,{orderId:f.orderId,status:'payment_pending',paymentState}));
  assert.doesNotMatch(html,/name="status"/);assert.match(html,/henüz kesinleşmedi/);
 }
 assert.match(renderToStaticMarkup(React.createElement(Form,{orderId:f.orderId,status:'pending'})),/value="cancelled"/);
});


test('PostgreSQL: text domain constraints require explicit schema review rather than bypassing preflight',async()=>{
 await db.exec("ALTER TABLE public.orders DROP CONSTRAINT orders_status_check; ALTER TABLE public.orders ALTER COLUMN status DROP DEFAULT; CREATE DOMAIN legacy_status_text AS text CHECK(VALUE IN ('pending','paid')); ALTER TABLE public.orders ALTER COLUMN status TYPE legacy_status_text USING status::legacy_status_text");
 await assert.rejects(db.exec(f.read(f.correction)),/enum\/domain status requires explicit review/);await db.exec('ROLLBACK');
});
