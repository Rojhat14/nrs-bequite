const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { loader } = require('./source-loader.cjs');
const fixture = require('./payment-security-fixture.cjs');
const load = loader();
const { prepareOrderLegalRecord } = load('src/lib/legal/payment-preflight.ts');
const { createLegalAcceptance } = load('src/lib/legal/acceptance.ts');
const { parseCheckoutInput } = load('src/lib/payment/request.ts');
const { measurementFields } = load('src/lib/order-measurements.ts');
const variantId='44444444-4444-4444-8444-444444444444';
const customer={firstName:'Test',lastName:'Alıcı',email:'test@example.com',phone:'905551234567',address:'Beytepe',city:'Ankara',district:'Çankaya',postalCode:'06800',orderNote:'Kapıyı arayın'};
const items=[{productId:'product',variantId,quantity:1,measurements:{chest:92,waist:72,hips:98,height:168,length:110}}];
const summary={items:[{...items[0],measurementKind:'dress',name:'Test Ürün',description:'Pamuk',size:'M',unitPrice:100}],buyer:{name:'Test Alıcı',email:customer.email,phone:customer.phone,address:'Beytepe, Çankaya, Ankara, 06800'},orderNote:customer.orderNote,subtotal:120,discount:20,shipping:0,total:100,currency:'TRY',paymentMethod:'Havale / EFT — ödeme henüz doğrulanmadı',deliveryTerms:load('src/lib/delivery-policy.ts').DELIVERY_TERMS,orderedAt:new Date().toISOString()};
async function setup() {
 const db=new PGlite(); await fixture.setup(db);
 const foundation=fixture.read('supabase/migrations/20260928120000_product_database_foundation.sql');
 await db.exec(foundation.slice(foundation.indexOf('CREATE OR REPLACE FUNCTION public.nrs_is_active_admin()'),foundation.indexOf('REVOKE ALL ON FUNCTION public.nrs_is_active_admin()')));
 await db.exec(fs.readFileSync('supabase/migrations/20261009150000_customer_access_hardening.sql','utf8'));
 await db.exec(fs.readFileSync('Raporlar/NRS_SUPABASE_SECURITY_APPLY.sql','utf8'));

 // Synthetic fixture omits the real catalog foundation's service grants.
 await db.exec('GRANT SELECT,UPDATE ON public.products,public.product_variants TO service_role');
 await db.exec(fs.readFileSync('supabase/migrations/20261010130000_manual_order_details.sql','utf8'));
 return db;
}
async function create(db,changes={}) {
 const legal=prepareOrderLegalRecord(fixture.orderId,createLegalAcceptance(true),summary);
 const args={id:fixture.orderId,user:fixture.userId,key:fixture.orderId,hash:'b'.repeat(64),items,customer,legal,...changes};
 return db.query('SELECT public.nrs_create_manual_order($1::uuid,$2::uuid,$3::uuid,$4,$5::jsonb,$6::jsonb,$7::jsonb) AS result',[args.id,args.user,args.key,args.hash,JSON.stringify(args.items),JSON.stringify(args.customer),JSON.stringify(args.legal)]);
}
test('Measurements are product-appropriate, numeric and included in the immutable legal snapshot',()=>{
 assert.deepEqual(measurementFields('Pantolon'),['waist','hips','inseam','length']);
 assert.deepEqual(measurementFields('Şal'),[]);
 assert.ok(measurementFields('Elbise').includes('chest'));
 assert.deepEqual(parseCheckoutInput({items,customer}).items[0].measurements,items[0].measurements);
 for(const bad of [{chest:0},{chest:301},{chest:'92'},{unknown:12}]) assert.throws(()=>parseCheckoutInput({items:[{...items[0],measurements:bad}],customer}));
 const record=prepareOrderLegalRecord(fixture.orderId,createLegalAcceptance(true),summary);
 assert.deepEqual(record.order_summary.items[0].measurements,items[0].measurements);
 assert.equal(record.order_summary.orderNote,customer.orderNote);
});
test('Real SQL: service-only atomic unpaid order preserves address, sizes, measurements and versions; retry creates no duplicate',async()=>{
 const db=await setup(); try {
 await db.exec('SET ROLE service_role');
 assert.equal((await create(db)).rows[0].result.created,true);
 assert.equal((await create(db)).rows[0].result.created,false);
 await assert.rejects(()=>create(db,{hash:'c'.repeat(64)}),/retry mismatch/);
 await db.exec('RESET ROLE');
 const order=(await db.query('SELECT * FROM public.orders')).rows[0]; assert.equal(order.status,'pending'); assert.equal(order.shipping_address,'Beytepe'); assert.equal(Number(order.total_amount),100);
 const record=(await db.query('SELECT * FROM public.order_legal_records')).rows[0];
 assert.equal(record.contract_version,'v1.4'); assert.ok(record.accepted_at); assert.deepEqual(record.order_summary.items[0].measurements,items[0].measurements); assert.equal(record.order_summary.items[0].size,'M');
 assert.equal((await db.query('SELECT count(*)::int n FROM public.order_items')).rows[0].n,1);
 assert.equal((await db.query('SELECT count(*)::int n FROM public.payment_orders')).rows[0].n,0);
 assert.equal((await db.query('SELECT stock_quantity FROM public.product_variants')).rows[0].stock_quantity,1);
 await assert.rejects(()=>db.exec("UPDATE public.order_legal_records SET order_summary='{}'"),/cannot be updated or deleted/);
 } finally {await db.close()}
});
test('Real SQL: other customers and anon cannot read orders/measurements or call manual RPC; active admin can read',async()=>{
 const db=await setup(); try {
 await create(db);
 await db.exec('SET ROLE authenticated'); await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[fixture.userId]);
 assert.equal((await db.query('SELECT count(*)::int n FROM public.order_legal_records')).rows[0].n,1);
 await assert.rejects(()=>create(db),/permission denied/);
 await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[fixture.otherId]);
 await db.exec('RESET ROLE; UPDATE public.admin_users SET is_active=false; SET ROLE authenticated');
 assert.equal((await db.query('SELECT count(*)::int n FROM public.orders')).rows[0].n,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM public.order_legal_records')).rows[0].n,0);
 await db.exec('RESET ROLE; UPDATE public.admin_users SET is_active=true; SET ROLE authenticated');
 assert.equal((await db.query('SELECT count(*)::int n FROM public.order_legal_records')).rows[0].n,1);
 await db.exec('RESET ROLE; SET ROLE anon'); await assert.rejects(()=>create(db),/permission denied/); await assert.rejects(()=>db.query('SELECT * FROM public.orders'),/permission denied/);
 } finally {await db.close()}
});
test('Real SQL: price tampering and missing acceptance roll back all rows; migration replay cannot overwrite definitions',async()=>{
 const db=await setup(); try {
 const legal=prepareOrderLegalRecord(fixture.orderId,createLegalAcceptance(true),summary);
 await assert.rejects(()=>create(db,{legal:{...legal,contract_accepted:false}}),/acceptance/);
 await assert.rejects(()=>create(db,{legal:{...legal,pre_information_version:'v1.3'}}),/acceptance/);
 const forged=structuredClone(legal); forged.order_summary.items[0].unitPrice=1;
 await assert.rejects(()=>create(db,{legal:forged}),/quote changed/);
 assert.equal((await db.query('SELECT count(*)::int n FROM public.orders')).rows[0].n,0);
 await assert.rejects(()=>db.exec(fs.readFileSync('supabase/migrations/20261010130000_manual_order_details.sql','utf8')),/Unexpected existing/);
 await db.exec('ROLLBACK');
 assert.ok((await db.query("SELECT attnotnull FROM pg_attribute WHERE attrelid='public.orders'::regclass AND attname='user_id'")).rows[0].attnotnull);
 } finally {await db.close()}
});
test('Actual order endpoints fail closed when disabled and reject cross-origin requests',async()=>{
 const prior=process.env.ORDER_DATABASE_VERIFIED; process.env.ORDER_DATABASE_VERIFIED='false';
 try {for(const path of ['quote','create']) {
 const api=loader({'@/lib/supabase/server':{createSupabaseServerClient(){throw new Error('Must not connect')}}})(`src/app/api/orders/${path}/route.ts`);
 const req=origin=>new Request('https://example.com/api/orders/'+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'});
 assert.equal((await api.POST(req('https://example.com'))).status,503);
 assert.equal((await api.POST(req('https://attacker.example'))).status,403);
 }} finally {if(prior===undefined)delete process.env.ORDER_DATABASE_VERIFIED; else process.env.ORDER_DATABASE_VERIFIED=prior}
});

test('Actual admin detail renders the saved historical size, measurements, address, note and unpaid status',async()=>{
 const React=require('react'); const {renderToStaticMarkup}=require('react-dom/server');
 const data={order:{id:fixture.orderId,user_id:fixture.userId,status:'pending',created_at:new Date().toISOString(),total_amount:120,customer_name:'Test Alıcı',customer_email:customer.email,customer_phone:customer.phone,shipping_address:customer.address,shipping_city:customer.city,shipping_district:customer.district},items:[{id:'line',product_id:'product',quantity:1,price_at_purchase:100}],products:[{id:'product',name:'Changed catalog title'}],payment:null,legal:{order_summary:summary,accepted_at:new Date().toISOString(),contract_version:'v1.1',pre_information_version:'v1.1'}};
 const component={__esModule:true,default:()=>null};
 const page=loader({'@/lib/admin/data':{getOrderDetail:async()=>data,isMissingTable:()=>false},'next/navigation':{notFound(){throw new Error('not found')}},'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},'@/components/legal/OrderLegalDocuments':component,'@/components/admin/OrderStatusForm':component})("src/app/admin/(protected)/orders/[id]/page.tsx").default;
 const html=renderToStaticMarkup(await page({params:Promise.resolve({id:fixture.orderId})}));
 for(const text of ['Test Ürün','Beden: M','Göğüs çevresi: 92 cm','Bel çevresi: 72 cm','İstenen ürün boyu: 110 cm','Beytepe','Kapıyı arayın','Doğrulanmış ödeme kaydı yok',customer.email,customer.phone]) assert.ok(html.includes(text),text);
});

test('Actual create endpoint binds authenticated owner and consent to the real SQL transaction, with safe retry',async()=>{
 const db=await setup(); const saved=process.env.ORDER_DATABASE_VERIFIED; process.env.ORDER_DATABASE_VERIFIED='true';
 try {
 const {quoteHash}=load('src/lib/payment/repository.ts');
 const serviceDb={from(){return {select(){return this},eq(column,key){this.key=key;return this},async maybeSingle(){const result=await db.query('SELECT id,user_id,manual_request_hash FROM public.orders WHERE manual_request_key=$1::uuid',[this.key]);return {data:result.rows[0]||null,error:null}}}},async rpc(name,args){assert.equal(name,'nrs_create_manual_order');const result=await db.query('SELECT public.nrs_create_manual_order($1::uuid,$2::uuid,$3::uuid,$4,$5::jsonb,$6::jsonb,$7::jsonb) AS result',[args.p_order_id,args.p_user_id,args.p_key,args.p_hash,JSON.stringify(args.p_items),JSON.stringify(args.p_customer),JSON.stringify(args.p_legal)]);return {data:result.rows[0].result,error:null}}};
 const api=loader({'@/lib/supabase/server':{createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:{id:fixture.userId}}})}})},'@/lib/payment/repository':{paymentDatabase:()=>serviceDb,createPaymentRepository:()=>({quote:async()=>({summary,hash:quoteHash(summary)})})}})('src/app/api/orders/create/route.ts');
 const body={...createLegalAcceptance(true),items,customer,quoteHash:quoteHash(summary),idempotencyKey:fixture.orderId,userId:fixture.otherId,total:1};
 const request=()=>new Request('https://example.com/api/orders/create',{method:'POST',headers:{origin:'https://example.com','content-type':'application/json'},body:JSON.stringify(body)});
 const result=await api.POST(request()); assert.equal(result.status,200); const first=await result.json(); assert.equal(first.paid,false);
 const second=await (await api.POST(request())).json(); assert.equal(second.orderId,first.orderId);
 const order=(await db.query('SELECT user_id,total_amount FROM public.orders')).rows[0]; assert.equal(order.user_id,fixture.userId); assert.equal(Number(order.total_amount),100);
 body.contractAccepted=false; assert.equal((await api.POST(request())).status,409);
 assert.equal((await db.query('SELECT count(*)::int n FROM public.orders')).rows[0].n,1);
 } finally {if(saved===undefined)delete process.env.ORDER_DATABASE_VERIFIED;else process.env.ORDER_DATABASE_VERIFIED=saved;await db.close()}
});

test('Mandatory dress, trousers, tops and suit measurements reject omissions, implausible values and standard size alone',()=>{
 const {validateRequiredMeasurements,requiredMeasurements}=load('src/lib/order-measurements.ts');
 for(const kind of ['dress','trousers','top','suit']) {
   assert.throws(()=>validateRequiredMeasurements({},kind),/zorunludur/);
   const values={chest:92,waist:72,hips:98,height:168,shoulder:38,sleeve:58,length:110,inseam:75};
   for(const field of requiredMeasurements(kind)) {const missing={...values};delete missing[field];assert.throws(()=>validateRequiredMeasurements(missing,kind),/zorunludur/)}
   assert.ok(validateRequiredMeasurements(values,kind));
 }
 for(const value of [-1,0,10,999,NaN,Infinity]) assert.throws(()=>validateRequiredMeasurements({...items[0].measurements,chest:value},'dress'));
});
test('Real SQL rejects a current order with missing measurements and leaves no records',async()=>{
 const db=await setup();try {
  const legal=prepareOrderLegalRecord(fixture.orderId,createLegalAcceptance(true),summary);
  legal.order_summary=structuredClone(legal.order_summary);
  delete legal.order_summary.items[0].measurements.height;
  const malformed=structuredClone(items);delete malformed[0].measurements.height;
  await assert.rejects(()=>create(db,{items:malformed,legal}),/required measurements missing/);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.orders')).rows[0].n,0);
 }finally{await db.close()}
});
test('Real SQL manual transfer needs active admin, exact money and a real reference; replay is safe and browser cannot call it',async()=>{
 const db=await setup();try {
  await create(db);
  const confirm=(actor=fixture.otherId,amount=100,reference='BANK-12345')=>db.query('SELECT public.nrs_confirm_manual_transfer($1::uuid,$2::uuid,$3::numeric,$4)',[fixture.orderId,actor,amount,reference]);
  await db.exec('SET ROLE service_role');
  await assert.rejects(()=>confirm(fixture.userId),/not authorized/);
  await assert.rejects(()=>confirm(fixture.otherId,1),/invalid transfer/);
  await assert.rejects(()=>confirm(fixture.otherId,100,''),/invalid transfer/);
  await confirm();await confirm();
  await assert.rejects(()=>confirm(fixture.otherId,100,'OTHER-REF'),/already confirmed/);
  await db.exec('RESET ROLE');
  const row=(await db.query('SELECT * FROM public.orders')).rows[0];assert.equal(row.status,'processing');assert.ok(row.manual_paid_at);assert.equal(row.manual_payment_confirmed_by,fixture.otherId);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.payment_events')).rows[0].n,0);
  await db.exec('SET ROLE authenticated');await assert.rejects(()=>confirm(),/permission denied/);
 }finally{await db.close()}
});


test('Real cart persistence keeps separate product measurements through reload and quantity changes',()=>{
 const previous=global.localStorage; const previousWindow=global.window; const values=new Map();
 global.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 global.window={localStorage:global.localStorage};
 try {
  const first=loader()('src/store/useCart.ts'); const cart=first.useCart;
  cart.getState().addItem({id:'dress',title:'Elbise',price:'100',variantId,category:'Elbise'});
  cart.getState().addItem({id:'pants',title:'Pantolon',price:'200',variantId:'pants-variant',category:'Pantolon'});
  const [dress,pants]=cart.getState().items;
  cart.getState().updateMeasurements(first.getCartItemId(dress),items[0].measurements);
  const pantsMeasurements={waist:72,hips:98,inseam:75,length:105};
  cart.getState().updateMeasurements(first.getCartItemId(pants),pantsMeasurements);
  cart.getState().updateQuantity(first.getCartItemId(dress),2);
  const restored=loader()('src/store/useCart.ts').useCart.getState();
  assert.deepEqual(restored.items[0].measurements,items[0].measurements);
  assert.deepEqual(restored.items[1].measurements,pantsMeasurements);
  assert.equal(restored.items[0].quantity,2);assert.equal(restored.shippingAmount,0);
 }finally{if(previous===undefined)delete global.localStorage;else global.localStorage=previous;if(previousWindow===undefined)delete global.window;else global.window=previousWindow}
});
