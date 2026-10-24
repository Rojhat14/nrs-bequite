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
const summary={items:[{...items[0],measurementKind:'dress',name:'Test Ürün',description:'Pamuk',size:'M',unitPrice:100}],buyer:{name:'Test Alıcı',email:customer.email,phone:customer.phone,address:'Beytepe, Çankaya, Ankara, 06800'},orderNote:customer.orderNote,subtotal:100,discount:0,shipping:0,total:100,currency:'TRY',paymentMethod:'Havale / EFT — ödeme henüz doğrulanmadı',deliveryTerms:load('src/lib/delivery-policy.ts').DELIVERY_TERMS,orderedAt:new Date().toISOString()};
async function setup() {
 const db=new PGlite(); await fixture.setup(db,true,{omitManualOrderColumns:true});
 await db.exec('UPDATE public.products SET compare_at_price=price_amount');
 const foundation=fixture.read('supabase/migrations/20260928120000_product_database_foundation.sql');
 await db.exec(foundation.slice(foundation.indexOf('CREATE OR REPLACE FUNCTION public.nrs_is_active_admin()'),foundation.indexOf('REVOKE ALL ON FUNCTION public.nrs_is_active_admin()')));
 await db.exec(fs.readFileSync('supabase/migrations/20261009150000_customer_access_hardening.sql','utf8'));
 await db.exec(fs.readFileSync('Raporlar/NRS_SUPABASE_SECURITY_APPLY.sql','utf8'));

 // Synthetic fixture omits the real catalog foundation's service grants.
 await db.exec('GRANT SELECT,UPDATE ON public.products,public.product_variants TO service_role');
 await db.exec(fs.readFileSync('supabase/migrations/20261010130000_manual_order_details.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261015120000_opening_campaign_checkout.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261019120000_optional_personal_measurements.sql','utf8'));
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
 assert.equal(record.contract_version,'v1.5'); assert.ok(record.accepted_at); assert.deepEqual(record.order_summary.items[0].measurements,items[0].measurements); assert.equal(record.order_summary.items[0].size,'M');
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

test('Personal measurements are optional for every garment; every supplied value remains validated',()=>{
 const {validateOptionalMeasurements}=load('src/lib/order-measurements.ts');
 const {parseCheckoutInput}=load('src/lib/payment/request.ts');
 for(const item of [{productId:'product',variantId,quantity:1},{productId:'product',variantId,quantity:1,measurements:{}}]) {
  const parsed=parseCheckoutInput({items:[item],customer});
  assert.equal(Object.hasOwn(parsed.items[0],'measurements'),false);
 }
 for(const value of [undefined,{}, {chest:92}, {waist:72,hips:98}, {length:110,inseam:75}]) assert.doesNotThrow(()=>validateOptionalMeasurements(value));
 for(const value of [-1,0,10,999,NaN,Infinity,'92',null]) assert.throws(()=>validateOptionalMeasurements({chest:value}));
 assert.throws(()=>validateOptionalMeasurements({unknown:12}));
});
test('Real SQL accepts a current order with omitted/partial personal measurements and still rejects invalid values',async()=>{
 const db=await setup();try {
  const legal=prepareOrderLegalRecord(fixture.orderId,createLegalAcceptance(true),summary);
  legal.order_summary=structuredClone(legal.order_summary);
  delete legal.order_summary.items[0].measurements;
  const omitted=structuredClone(items);delete omitted[0].measurements;
  await db.exec('SET ROLE service_role');
  assert.equal((await create(db,{items:omitted,legal})).rows[0].result.created,true);
  await db.exec('RESET ROLE');
  const invalidDb=await setup();
  const invalidLegal=structuredClone(legal); invalidLegal.order_summary.items[0].measurements={chest:999}
  try { await assert.rejects(()=>create(invalidDb,{items:[{...items[0],measurements:{chest:999}}],legal:invalidLegal}),/invalid measurement range/); assert.equal((await invalidDb.query('SELECT count(*)::int n FROM public.orders')).rows[0].n,0) }
  finally { await invalidDb.close() }
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

test('A pre-auth cart with a retired variant fails quote validation; exact-size refresh lets the same line quote without re-adding it',async()=>{
 const h=await orderedOrderHarness();try{
  const replacement='77777777-7777-4777-8777-777777777777';
  await h.db.exec(`RESET ROLE; UPDATE public.product_variants SET is_active=false,size='S' WHERE id='${variantId}';
    INSERT INTO public.product_variants(id,product_id,size,stock_quantity,is_active) VALUES('${replacement}','product','M',10,true)`);
  const repository=h.repository.createPaymentRepository(true);
  await assert.rejects(()=>repository.quote([{productId:'product',variantId,quantity:1}],customer),error=>error.code==='VARIANT_UNAVAILABLE'&&error.productId==='product');
  const sameSelection=await repository.quote([{productId:'product',variantId:replacement,quantity:1,measurements:{chest:92}}],customer);
  assert.equal(sameSelection.summary.items[0].variantId,replacement);
  assert.equal(sameSelection.summary.items[0].size,'M');
  assert.deepEqual(sameSelection.summary.items[0].measurements,{chest:92});
 }finally{await h.close()}
});

// Exercise real quote/parser/create code against the real, unchanged manual RPC.
async function orderedOrderHarness() {
 const db=await setup();
 const ids=[variantId,'55555555-5555-4555-8555-555555555555','aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa'];
 await db.exec(`UPDATE public.products SET name='Test Elbise'; UPDATE public.product_variants SET stock_quantity=10;
 INSERT INTO public.products(id,name,description,price_amount,compare_at_price,currency,status,in_stock) VALUES
 ('pants','Test Pantolon','Pamuk',200,220,'TRY','active',true),('top','Test Bluz','Pamuk',300,320,'TRY','active',true);
 INSERT INTO public.product_variants(id,product_id,size,stock_quantity,is_active) VALUES
 ('${ids[1]}','pants','L',10,true),('${ids[2]}','top','S',10,true)`);
 const lines=[{...items[0]}, {productId:'pants',variantId:ids[1],quantity:2,measurements:{waist:80,hips:104,inseam:78,length:108}},
 {productId:'top',variantId:ids[2],quantity:3,measurements:{chest:100,waist:82,shoulder:42,sleeve:62,length:68}}];
 await db.exec('UPDATE public.products SET compare_at_price=price_amount');
 const calls=[];
 const serviceDb={from(table){return {select(){return this},in(column,keys){this.column=column;this.keys=keys;return this},eq(column,key){this.key=key;return this},
 async maybeSingle(){const r=await db.query('SELECT id,user_id,manual_request_hash FROM public.orders WHERE manual_request_key=$1::uuid',[this.key]);return {data:r.rows[0]||null,error:null}},
 then(resolve,reject){return db.query(`SELECT * FROM public.${table}`).then(r=>({data:r.rows.filter(row=>this.keys.includes(row[this.column])).map(row=>table==='products'?{...row,price_amount:Number(row.price_amount),compare_at_price:Number(row.compare_at_price),categories:[],product_images:[]}:row),error:null})).then(resolve,reject)}
 }},async rpc(name,args){calls.push(structuredClone(args));try{const r=await db.query('SELECT public.nrs_create_manual_order($1::uuid,$2::uuid,$3::uuid,$4,$5::jsonb,$6::jsonb,$7::jsonb) AS result',
 [args.p_order_id,args.p_user_id,args.p_key,args.p_hash,JSON.stringify(args.p_items),JSON.stringify(args.p_customer),JSON.stringify(args.p_legal)]);return {data:r.rows[0].result,error:null}}catch(error){return {data:null,error}}}};
 const saved=Object.fromEntries(['ORDER_DATABASE_VERIFIED','SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SUPABASE_URL'].map(k=>[k,process.env[k]]));
 Object.assign(process.env,{ORDER_DATABASE_VERIFIED:'true',SUPABASE_SERVICE_ROLE_KEY:'local-synthetic-only',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1'});
 const repository=loader({'@supabase/supabase-js':{createClient:()=>serviceDb}})('src/lib/payment/repository.ts');
 const mocks={'@/lib/supabase/server':{createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:{id:fixture.userId}}})}})},'@/lib/payment/repository':repository};
 const quoteApi=loader(mocks)('src/app/api/orders/quote/route.ts');const createApi=loader(mocks)('src/app/api/orders/create/route.ts');
 const req=(path,body)=>new Request('https://example.com/api/orders/'+path,{method:'POST',headers:{origin:'https://example.com','content-type':'application/json'},body:JSON.stringify(body)});
 await db.exec('SET ROLE service_role');
 return {db,lines,calls,repository,
 async quote(input){const r=await quoteApi.POST(req('quote',{items:input,customer}));assert.equal(r.status,200);return r.json()},
 async create(input,quote,extra={}){return createApi.POST(req('create',{items:input,customer,...createLegalAcceptance(true),quoteHash:quote.hash,idempotencyKey:fixture.orderId,...extra}))},
 async close(){for(const [k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v}await db.close()}};
}
for(const [name,indexes]of [['single product',[0]],['two products added in reverse order',[1,0]],['three distinct products in mixed order',[2,0,1]]]) {
 test(`Canonical order: actual quote and create endpoints + SQL preserve ${name}`,async()=>{
 const h=await orderedOrderHarness();try{
 const input=indexes.map(i=>structuredClone(h.lines[i]));const untouched=structuredClone(input);const quote=await h.quote(input);
 const forward=await h.quote([...input].reverse());assert.equal(quote.hash,forward.hash);
 const r=await h.create(input,quote);assert.equal(r.status,200);
 assert.deepEqual(input,untouched);const sent=h.calls[0];
 assert.deepEqual(sent.p_items.map(i=>i.variantId),quote.summary.items.map(i=>i.variantId));
 for(const line of quote.summary.items){const original=input.find(i=>i.variantId===line.variantId);assert.equal(line.productId,original.productId);assert.equal(line.quantity,original.quantity);assert.deepEqual(line.measurements,original.measurements);}
 const legal=(await h.db.query('SELECT * FROM public.order_legal_records')).rows[0];
 assert.deepEqual(legal.order_summary,sent.p_legal.order_summary);
 const commercial=s=>{const {orderedAt,...rest}=s;return rest};assert.deepEqual(commercial(legal.order_summary),commercial(quote.summary));
 assert.equal(legal.contract_version,'v1.5');assert.equal(legal.pre_information_version,'v1.5');
 const crypto=require('node:crypto');assert.equal(legal.summary_hash,crypto.createHash('sha256').update(JSON.stringify(sent.p_legal.order_summary)).digest('hex'));
 assert.equal(legal.document_hash,prepareOrderLegalRecord(sent.p_order_id,createLegalAcceptance(true),quote.summary).document_hash);
 const rows=(await h.db.query('SELECT product_id,quantity,price_at_purchase FROM public.order_items')).rows;
 for(const line of quote.summary.items){const row=rows.find(i=>i.product_id===line.productId);assert.equal(row.quantity,line.quantity);assert.equal(Number(row.price_at_purchase),line.normalUnitPrice ?? line.unitPrice);}
 assert.ok((await h.db.query('SELECT stock_quantity FROM public.product_variants')).rows.every(v=>v.stock_quantity===10));
 // A reordered retry is the same request and does not create another order.
 assert.equal((await h.create([...input].reverse(),quote)).status,200);assert.equal(h.calls.length,1);
 }finally{await h.close()}
 });
}
test('Normal sale price is independently rechecked and atomically persisted by the payment RPC',async()=>{
 const h=await orderedOrderHarness();try{
  const input=[structuredClone(h.lines[0])];const quote=await h.quote(input);
  assert.equal(quote.summary.subtotal,100);assert.equal(quote.summary.discount,0);assert.equal(quote.summary.total,100);
  const legal=prepareOrderLegalRecord(fixture.orderId,createLegalAcceptance(true),quote.summary);
  const result=await h.db.query('SELECT public.nrs_create_payment_order($1::uuid,$2::uuid,NULL,$1::uuid,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7) AS result',
   [fixture.orderId,fixture.userId,'a'.repeat(64),JSON.stringify(input),JSON.stringify(customer),JSON.stringify(legal),'test-bank']);
  const order=result.rows[0].result;
  assert.equal(order.order.amountMinor,10000);
  const stored=(await h.db.query('SELECT o.total_amount,p.amount_minor,l.order_summary FROM public.orders o JOIN public.payment_orders p ON p.order_id=o.id JOIN public.order_legal_records l ON l.order_id=o.id WHERE o.id=$1::uuid',[fixture.orderId])).rows[0];
  assert.equal(Number(stored.total_amount),100);assert.equal(Number(stored.amount_minor),10000);
  assert.equal(stored.order_summary.discount,0);
  assert.equal(stored.order_summary.items[0].unitPrice,100);
  assert.equal((await h.db.query('SELECT stock_quantity FROM public.product_variants WHERE id=$1::uuid',[variantId])).rows[0].stock_quantity,9);
 }finally{await h.close()}
});
test('Canonical order: duplicate variant and UUID case collision reject instead of merging measurements',async()=>{
 const h=await orderedOrderHarness();try{
 const a=h.lines[2];const duplicate={...structuredClone(a),measurements:{...a.measurements,chest:110}};
 for(const variant of [a.variantId,a.variantId.toUpperCase()]){
 assert.throws(()=>parseCheckoutInput({items:[a,{...duplicate,variantId:variant}],customer}));
 await assert.rejects(()=>h.repository.createPaymentRepository(true).quote([a,{...duplicate,variantId:variant}],customer));
 }
 assert.equal((await h.db.query('SELECT count(*)::int n FROM public.orders')).rows[0].n,0);
 }finally{await h.close()}
});
test('Canonical order: stale price, altered measurements and forged legal summary are rejected atomically',async()=>{
 const h=await orderedOrderHarness();try{
 const input=[h.lines[1],h.lines[0]];const quote=await h.quote(input);
 const changed=structuredClone(input);changed[0].measurements.waist=85;
 assert.equal((await h.create(changed,quote)).status,409);
 assert.equal((await h.create(input,quote,{contractVersion:'v1.3',preInformationVersion:'v1.3'})).status,409);
 const forged=structuredClone(quote.summary);forged.items[0].unitPrice=1;
 assert.equal((await h.create(input,{...quote,hash:h.repository.quoteHash(forged)})).status,409);
 const sorted=parseCheckoutInput({items:input,customer}).items;
 const legal=prepareOrderLegalRecord(fixture.orderId,createLegalAcceptance(true),quote.summary);
 for(const edit of [l=>{l.order_summary.items[0].unitPrice=1},l=>{l.order_summary.items[0].measurements.chest=105},l=>{l.order_summary.buyer.address='forged address'}]){
 const altered=structuredClone(legal);edit(altered);
 await assert.rejects(()=>create(h.db,{items:sorted,legal:altered}),/quote changed|invalid summary/);
 }
 const duplicate=[sorted[0],{...sorted[0],measurements:{...sorted[0].measurements,chest:105}}];
 await assert.rejects(()=>create(h.db,{items:duplicate,legal}),/invalid acceptance\/items/);
 await h.db.query('UPDATE public.products SET price_amount=price_amount+1 WHERE id=$1',['pants']);
 assert.equal((await h.create(input,quote)).status,409);
 for(const table of ['orders','order_items','order_legal_records'])assert.equal((await h.db.query(`SELECT count(*)::int n FROM public.${table}`)).rows[0].n,0);
 assert.ok((await h.db.query('SELECT stock_quantity FROM public.product_variants')).rows.every(v=>v.stock_quantity===10));
 }finally{await h.close()}
});

test('A saved cart line for a product that is no longer sold, or a size without stock, is named instead of failing the whole quote generically',async()=>{
 const h=await orderedOrderHarness();try{
  const repository=h.repository.createPaymentRepository(true);
  await h.db.exec(`RESET ROLE; UPDATE public.product_variants SET stock_quantity=0 WHERE id='${variantId}'`);
  await assert.rejects(()=>repository.quote([{productId:'product',variantId,quantity:1}],customer),error=>error.code==='PRODUCT_UNAVAILABLE'&&error.productId==='product'&&/stokta yok/.test(error.message));
  await h.db.exec(`RESET ROLE; UPDATE public.product_variants SET stock_quantity=10 WHERE id='${variantId}'; UPDATE public.products SET status='archived' WHERE id='product'`);
  await assert.rejects(()=>repository.quote([{productId:'product',variantId,quantity:1}],customer),error=>error.code==='PRODUCT_UNAVAILABLE'&&error.productId==='product');
 }finally{await h.close()}
});

test('A saved cart line without a size identity asks for a size on that line',()=>{
 const {parseCheckoutInput}=loader()('src/lib/payment/request.ts');
 assert.throws(()=>parseCheckoutInput({items:[{productId:'old-dress',quantity:1}],customer}),error=>error.code==='VARIANT_UNAVAILABLE'&&error.productId==='old-dress');
 assert.throws(()=>parseCheckoutInput({items:[{productId:'old-dress',variantId:'size-m',quantity:1}],customer}),error=>error.code==='VARIANT_UNAVAILABLE'&&error.productId==='old-dress');
 assert.throws(()=>parseCheckoutInput({items:[{productId:'',variantId,quantity:1}],customer}),/doğrulanamadı/);
});
