const test=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
const f=require('./payment-security-fixture.cjs');

const secondId='55555555-5555-4555-8555-555555555555';
const thirdId='66666666-6666-4666-8666-666666666666';
const variantId='44444444-4444-4444-8444-444444444444';
const customer={firstName:'Test',lastName:'Alıcı',email:'test@example.com',phone:'905551234567',address:'Beytepe',city:'Ankara',district:'Çankaya',postalCode:''};
function snapshot(qty){return {items:[{productId:'product',name:'Test Ürün',description:'Pamuk',size:'M',quantity:qty,unitPrice:100}],
 buyer:{name:'Test Alıcı',email:'test@example.com',phone:'905551234567',address:'Beytepe, Çankaya, Ankara'},subtotal:120*qty,discount:20*qty,shipping:20,total:100*qty+20,currency:'TRY',paymentMethod:'Online kartla ödeme',deliveryTerms:'Teyit edilmiş süre',orderedAt:new Date().toISOString()}}
async function create(db,id,key=id,qty=1){
 const items=[{productId:'product',variantId,quantity:qty}];
 return db.query('select public.nrs_create_payment_order($1::uuid,$2::uuid,null,$3::uuid,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8) result',
  [id,f.userId,key,'a'.repeat(64),JSON.stringify(items),JSON.stringify(customer),JSON.stringify(f.historicalRecord(id,snapshot(qty))),'test-bank']);
}
async function cancel(db,id=f.orderId,owner=f.userId){return db.query('select public.nrs_customer_cancel_order($1::uuid,$2::uuid) result',[id,owner])}
async function fixture(){const db=new PGlite();await f.setup(db);return db}

test('Customer cancellation is owner-only and idempotently releases an unsent reservation once',async()=>{
 const db=await fixture();try{
  await f.create(db);
  await db.exec('SET ROLE service_role');
  try {
   assert.equal((await cancel(db,f.orderId,f.otherId)).rows[0].result,'not_found');
   assert.equal((await cancel(db)).rows[0].result,'cancelled');
   assert.equal((await cancel(db)).rows[0].result,'cancelled');
  } finally {await db.exec('RESET ROLE')}
  assert.deepEqual(await f.state(db),{status:'cancelled',state:'failed',stock_quantity:1,events:0,released:1});
  await db.exec('SET ROLE authenticated');
  await assert.rejects(cancel(db),/permission denied/);
  await db.exec('RESET ROLE');
 }finally{await db.close()}
});

test('A used bank handoff stays pending for reconciliation and cannot release stock',async()=>{
 const db=await fixture();try{
  await f.create(db);
  await db.query("select public.nrs_store_payment_redirect($1::uuid,'https://shop.example/handoff?token=x')",[f.orderId]);
  await db.query("update public.payment_orders set redirect_url=redirect_url||'&used=1' where order_id=$1::uuid",[f.orderId]);
  assert.equal((await cancel(db)).rows[0].result,'needs_reconcile');
  assert.deepEqual(await f.state(db),{status:'payment_pending',state:'pending',stock_quantity:0,events:0,released:0});
 }finally{await db.close()}
});

test('Paid callback wins before cancellation; paid order is directed to refund workflow',async()=>{
 const db=await fixture();try{
  await f.create(db);await f.finalize(db);
  assert.equal((await cancel(db)).rows[0].result,'paid');
  await f.finalize(db);
  assert.deepEqual(await f.state(db),{status:'paid',state:'paid',stock_quantity:0,events:1,released:0});
 }finally{await db.close()}
});

test('Concurrent used-handoff cancellation and signed paid callback cannot cancel or release a paid order',async()=>{
 const db=await fixture();try{
  await f.create(db);
  await db.query("select public.nrs_store_payment_redirect($1::uuid,'https://shop.example/handoff?token=x')",[f.orderId]);
  await db.query("update public.payment_orders set redirect_url=redirect_url||'&used=1' where order_id=$1::uuid",[f.orderId]);
  const [cancelled,settled]=await Promise.allSettled([cancel(db),f.finalize(db)]);
  assert.equal(settled.status,'fulfilled');
  assert.ok(cancelled.status==='fulfilled' || cancelled.status==='rejected');
  assert.deepEqual(await f.state(db),{status:'paid',state:'paid',stock_quantity:0,events:1,released:0});
 }finally{await db.close()}
});

test('Concurrent unsent cancellation/callback leaves exactly one safe terminal outcome',async()=>{
 const db=await fixture();try{
  await f.create(db);
  const [cancelled,settled]=await Promise.allSettled([cancel(db),f.finalize(db)]);
  const state=await f.state(db);
  assert.ok((state.status==='cancelled' && state.state==='failed' && state.stock_quantity===1 && state.released===1 && settled.status==='rejected')
    || (state.status==='paid' && state.state==='paid' && state.stock_quantity===0 && state.released===0 && cancelled.status==='fulfilled'));
  assert.ok(state.events===0 || state.events===1);
 }finally{await db.close()}
});

test('Independent same-owner order has a different key and its own stock validation',async()=>{
 const db=await fixture();try{
  await db.query('update public.product_variants set stock_quantity=4');
  assert.equal((await db.query('select stock_quantity from public.product_variants')).rows[0].stock_quantity,4);
  assert.equal((await create(db,f.orderId)).rows[0].result.created,true);
  assert.equal((await create(db,secondId)).rows[0].result.created,true);
  assert.equal((await create(db,thirdId,thirdId,2)).rows[0].result.created,true);
  await assert.rejects(create(db,'77777777-7777-4777-8777-777777777777',undefined,1),/stock unavailable/);
  assert.equal((await db.query('select count(*)::int count from public.payment_orders')).rows[0].count,3);
  assert.equal((await db.query('select stock_quantity from public.product_variants')).rows[0].stock_quantity,0);
  const sameKey=await create(db,thirdId,thirdId,2);
  assert.equal(sameKey.rows[0].result.created,false);
  assert.equal((await db.query('select stock_quantity from public.product_variants')).rows[0].stock_quantity,0);
 }finally{await db.close()}
});

test('Customer API binds cancellation to the authenticated owner and reconciles without initiating a sale',()=>{
 const route=fs.readFileSync('src/app/api/orders/[id]/cancel/route.ts','utf8');
 assert.match(route,/auth\.auth\.getUser\(\)/);
 assert.match(route,/p_user_id:\s*user\.id/);
 assert.match(route,/nrs_customer_cancel_order/);
 assert.match(route,/provider\.reconcile\(order\.merchantReference\)/);
 assert.match(route,/finalizeAtomic\(verified, provider\.name\)/);
 assert.doesNotMatch(route,/\.initiate\(/);
 const ui=fs.readFileSync('src/app/profile/components/OrderHistory.tsx','utf8');
 assert.ok(ui.includes('payment_pending'));
 assert.ok(ui.includes("t('orderStatusCancelled')"),'cancelled orders retain a localized status label');
 assert.ok(fs.readFileSync('src/lib/i18n/messages.ts','utf8').includes("orderStatusCancelled: 'İptal edildi'"));
 assert.doesNotMatch(ui,/Siparişi İptal Et|cancelOrder\(/);
 const handoff=fs.readFileSync('src/app/api/payment/garanti/handoff/route.ts','utf8');
 assert.match(handoff,/Referrer-Policy': 'strict-origin'/);
 assert.match(handoff,/claimGarantiHandoff\(order, redirect\)/);
});
