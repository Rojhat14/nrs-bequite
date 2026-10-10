const {historicalRecord}=require('./payment-security-fixture.cjs');
// Real PostgreSQL engine, representative fixture schema. This is NOT proof of
// production Supabase schema/policies; live audit/migration remains required.
const { PGlite } = require('@electric-sql/pglite');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loader } = require('./source-loader.cjs');
const load = loader();
const { prepareOrderLegalRecord } = load('src/lib/legal/payment-preflight.ts');
const { createLegalAcceptance } = load('src/lib/legal/acceptance.ts');
const orderId='11111111-1111-4111-8111-111111111111', userId='22222222-2222-4222-8222-222222222222', otherId='33333333-3333-4333-8333-333333333333';
const variantId='44444444-4444-4444-8444-444444444444';
const db = new PGlite();
const summary={ items:[{productId:'product',name:'Test Ürün',description:'Pamuk',size:'M',quantity:1,unitPrice:100}],
 buyer:{name:'Test Alıcı',email:'test@example.com',phone:'905551234567',address:'Beytepe, Çankaya, Ankara'},subtotal:120,discount:20,shipping:20,total:120,currency:'TRY',paymentMethod:'Online kartla ödeme',deliveryTerms:'Teyit edilmiş süre',orderedAt:new Date().toISOString()};
const customer={firstName:'Test',lastName:'Alıcı',email:'test@example.com',phone:'905551234567',address:'Beytepe',city:'Ankara',district:'Çankaya',postalCode:''};
const items=[{productId:'product',variantId,quantity:1}];
const create = async (id=orderId, key=orderId, owner=userId, guest=null, snapshot=summary) => db.query('select public.nrs_create_payment_order($1::uuid,$2::uuid,$3,$4::uuid,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9) as result',
 [id,owner,guest,key,'a'.repeat(64),JSON.stringify(items),JSON.stringify(customer),JSON.stringify(historicalRecord(id,snapshot)),'test-bank']);
const callback=(changes={})=>({eventId:'event',merchantId:'test',merchantReference:orderId,transactionId:'transaction',amountMinor:12000,currency:'TRY',status:'paid',threeDS:'authenticated',...changes});
const finalize=async changes=>db.query('select public.nrs_finalize_payment($1::jsonb,$2)',[JSON.stringify(callback(changes)),'test-bank']);
async function asCustomer(id, sql, params=[]) {
 await db.exec('SET ROLE authenticated');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
 try { return await db.query(sql,params) } finally { await db.exec('RESET ROLE') }
}
test.before(async()=>{
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
 CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key);
 INSERT INTO auth.users VALUES('${userId}'),('${otherId}');
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 GRANT USAGE ON SCHEMA auth TO authenticated;
 CREATE TABLE public.admin_users(user_id uuid primary key references auth.users(id),role text,is_active boolean);
 INSERT INTO public.admin_users VALUES('${otherId}','admin',false);
 CREATE OR REPLACE FUNCTION public.nrs_is_active_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users AS au
    WHERE au.user_id = (SELECT auth.uid())
      AND au.role = 'admin'
      AND au.is_active = true
  );
$$;

 REVOKE ALL ON FUNCTION public.nrs_is_active_admin() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.nrs_is_active_admin() TO authenticated;

 REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
 ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
 CREATE TABLE public.profiles(id uuid PRIMARY KEY,first_name text,last_name text,phone text,email text);
 CREATE TABLE public.wishlist(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,product_id text NOT NULL);
 CREATE TABLE public.orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,total_amount numeric NOT NULL,status text NOT NULL CHECK(status IN('pending','payment_pending','paid','processing','shipped','delivered','cancelled','refunded')),customer_name text,customer_email text,customer_phone text,shipping_address text,shipping_city text,shipping_district text,shipping_postal_code text,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid NOT NULL references public.orders(id),product_id text NOT NULL,quantity integer NOT NULL,price_at_purchase numeric NOT NULL);
 CREATE TABLE public.products(id text primary key,name text NOT NULL,description text,price_amount numeric NOT NULL,compare_at_price numeric,currency text NOT NULL,status text NOT NULL,in_stock boolean NOT NULL);
 CREATE TABLE public.product_variants(id uuid PRIMARY KEY,product_id text REFERENCES public.products(id),size text,stock_quantity integer NOT NULL CHECK(stock_quantity>=0),is_active boolean NOT NULL);
 INSERT INTO public.products VALUES('product','Test Ürün','Pamuk',100,120,'TRY','active',true);
 INSERT INTO public.product_variants VALUES('${variantId}','product','M',1,true);
 ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
 GRANT SELECT ON public.orders TO authenticated;
 CREATE POLICY owner_read ON public.orders FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.nrs_is_active_admin());`);
 // Reproduce reported exposure, including column ACLs, before hardening.
 await db.exec(`ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
 GRANT ALL ON public.orders,public.order_items TO anon,authenticated;
 GRANT SELECT(product_id),UPDATE(quantity) ON public.order_items TO anon;
 CREATE POLICY order_items_access_policy ON public.order_items FOR ALL TO public USING(true) WITH CHECK(true);
 CREATE POLICY order_items_policy ON public.order_items FOR ALL TO public USING(true) WITH CHECK(true);
 CREATE POLICY public_order_insert ON public.orders FOR INSERT TO public WITH CHECK(true);`);
 const adminSource=fs.readFileSync('supabase/migrations/20260928130000_admin_panel_access.sql','utf8');
 await db.exec(adminSource.slice(adminSource.indexOf('CREATE OR REPLACE FUNCTION public.nrs_admin_update_order_status'),adminSource.indexOf('-- Aggregate customer totals')));
 await db.exec(fs.readFileSync('supabase/migrations/20261009120000_order_access_hardening.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261008120000_order_legal_records.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261008130000_payment_order_transactions.sql','utf8'));

 await db.exec(fs.readFileSync('supabase/migrations/20261009130000_payment_transaction_hardening.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261009140000_final_security_review_fixes.sql','utf8'));
});
test.after(async()=>{ await db.close() });
test('Local PostgreSQL: atomic creation saves one order, items, legal snapshot and stock reservation',async()=>{
 const result=await create(); assert.equal(result.rows[0].result.created,true);
 for(const table of ['orders','order_items','order_legal_records','payment_orders','payment_stock_reservations']) assert.equal((await db.query(`select count(*)::integer as n from public.${table}`)).rows[0].n,1);
 assert.equal((await db.query('select stock_quantity from public.product_variants')).rows[0].stock_quantity,0);
});
test('Local PostgreSQL: duplicate creation does not create another order or decrement stock twice',async()=>{
 const result=await create(); assert.equal(result.rows[0].result.created,false);
 assert.equal((await db.query('select count(*)::integer as n from public.orders')).rows[0].n,1);
 await assert.rejects(create(orderId,orderId,otherId),/ownership/);
});
test('Local PostgreSQL: second buyer cannot consume reserved last stock; transaction leaves no partial order',async()=>{
 await assert.rejects(create(otherId,otherId,otherId),/stock unavailable/);
 assert.equal((await db.query('select count(*)::integer as n from public.orders')).rows[0].n,1);
});
test('Local PostgreSQL: owner can read, other customer cannot, admin can read legal record',async()=>{
 assert.equal((await asCustomer(userId,'select * from public.order_legal_records')).rows.length,1);
 assert.equal((await asCustomer(otherId,'select * from public.order_legal_records')).rows.length,0);
 await db.exec('update public.admin_users set is_active=true');
 assert.equal((await asCustomer(otherId,'select * from public.order_legal_records')).rows.length,1);
 await db.exec('update public.admin_users set is_active=false');
});
test('Local PostgreSQL: customer cannot insert, update, delete or execute payment transaction RPC',async()=>{
 for(const sql of ["update public.order_legal_records set contract_version='forged'",'delete from public.order_legal_records',`insert into public.order_legal_records select * from public.order_legal_records`,`select public.nrs_finalize_payment('{}'::jsonb,'fake')`]) await assert.rejects(asCustomer(userId,sql),/permission denied/);
});
test('Local PostgreSQL: accepted legal record is immutable even for privileged updates/deletes',async()=>{
 await assert.rejects(db.exec("update public.order_legal_records set contract_version='forged'"),/cannot be updated/);
 await assert.rejects(db.exec('delete from public.order_legal_records'),/cannot be updated/);
 await assert.rejects(db.exec('delete from public.orders'),/foreign key/);
});
test('Local PostgreSQL: orphan and duplicate legal records are prohibited by FK/primary key',async()=>{
 await assert.rejects(db.query('insert into public.order_legal_records select $1::uuid,contract_accepted,contract_version,pre_information_version,accepted_at,document_hash,summary_hash,order_summary from public.order_legal_records',[otherId]),/foreign key/);
 await assert.rejects(db.exec('insert into public.order_legal_records select * from public.order_legal_records'),/duplicate key/);
});
test('Local PostgreSQL: amount/currency mismatch does not mark order paid',async()=>{
 await assert.rejects(finalize({amountMinor:1}),/mismatch/);
 await assert.rejects(finalize({currency:'USD'}),/mismatch/);
 assert.equal((await db.query('select state from public.payment_orders')).rows[0].state,'initiating');
});
test('Local PostgreSQL: verified payment and duplicate callback mark paid once, with no second stock decrement',async()=>{
 await finalize(); await finalize(); await finalize({eventId:'event-again'});
 assert.equal((await db.query('select status from public.orders')).rows[0].status,'paid');
 assert.equal((await db.query('select stock_quantity from public.product_variants')).rows[0].stock_quantity,0);
 await assert.rejects(finalize({eventId:'event-conflict',status:'failed'}),/terminal state conflict/);
});
test('Local PostgreSQL: order ID alone and wrong customer/guest capability grant no document access',async()=>{
 assert.equal((await db.query('select public.nrs_read_payment_order($1::uuid,$2::uuid,$3) as result',[orderId,otherId,null])).rows[0].result,null);
 assert.equal((await db.query('select public.nrs_read_payment_order($1::uuid,$2::uuid,$3) as result',[orderId,null,'b'.repeat(64)])).rows[0].result,null);
 assert.equal((await db.query('select public.nrs_read_payment_order($1::uuid,$2::uuid,$3) as result',[orderId,userId,null])).rows[0].result.id,orderId);
});
test('Local PostgreSQL: failed legal insert rolls back the preceding order insert',async()=>{
 await db.exec('update public.product_variants set stock_quantity=1');
 const record=historicalRecord(otherId,summary);
 record.document_hash='invalid';
 await assert.rejects(db.query('select public.nrs_create_payment_order($1::uuid,$2::uuid,$3,$4::uuid,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)',[otherId,otherId,null,otherId,'a'.repeat(64),JSON.stringify(items),JSON.stringify(customer),JSON.stringify(record),'test-bank']),/check constraint/);
 assert.equal((await db.query('select count(*)::integer as n from public.orders')).rows[0].n,1);
 assert.equal((await db.query('select stock_quantity from public.product_variants')).rows[0].stock_quantity,1);
});
test('Local PostgreSQL: guest access needs matching capability and expiry; failed payment returns stock once',async()=>{
 await assert.rejects(create(otherId,otherId,null,'b'.repeat(64)),/Authenticated checkout required/);
 await create(otherId,otherId,otherId);
 // Synthetic legacy capability fixture only; new guest order creation is off.
 await db.exec(`update public.payment_orders set user_id=null,guest_hash='${'b'.repeat(64)}',guest_expires_at=now()+interval '1 day' where order_id='${otherId}'`);
 const read=async hash=>(await db.query('select public.nrs_read_payment_order($1::uuid,$2::uuid,$3) as result',[otherId,null,hash])).rows[0].result;
 assert.equal(await read('c'.repeat(64)),null);
 assert.equal((await read('b'.repeat(64))).id,otherId);
 await db.exec(`update public.payment_orders set guest_expires_at=now()-interval '1 day' where order_id='${otherId}'`);
 assert.equal(await read('b'.repeat(64)),null);
 const result=callback({eventId:'failed-event',merchantReference:otherId,transactionId:'failed-transaction',status:'failed',threeDS:'failed'});
 await db.query('select public.nrs_finalize_payment($1::jsonb,$2)',[JSON.stringify(result),'test-bank']);
 await db.query('select public.nrs_finalize_payment($1::jsonb,$2)',[JSON.stringify(result),'test-bank']);
 assert.equal((await db.query('select stock_quantity from public.product_variants')).rows[0].stock_quantity,1);
 assert.equal((await db.query('select state from public.payment_orders where order_id=$1::uuid',[otherId])).rows[0].state,'failed');
});

test('Local PostgreSQL: anonymous table AND column ACLs deny all order/item operations',async()=>{
 await db.exec('SET ROLE anon');
 try {
  for(const sql of ['select * from public.orders','select product_id from public.order_items',"insert into public.order_items(order_id,product_id,quantity,price_at_purchase) values(null,'product',1,1)",'update public.order_items set quantity=9','delete from public.order_items','delete from public.orders','update public.orders set total_amount=1',"insert into public.orders(user_id,total_amount) values(null,1)"]) await assert.rejects(db.exec(sql),/permission denied/);
 } finally { await db.exec('RESET ROLE'); }
});
test('Local PostgreSQL: own history works, another buyer is isolated, only active admin can read details',async()=>{
 assert.equal((await asCustomer(userId,'select * from public.orders')).rows.length,1);
 assert.equal((await asCustomer(userId,'select * from public.order_items')).rows.length,1);
 assert.equal((await asCustomer(otherId,'select * from public.orders where id=$1::uuid',[orderId])).rows.length,0);
 assert.equal((await asCustomer(otherId,'select * from public.order_items where order_id=$1::uuid',[orderId])).rows.length,0);
 await db.exec('update public.admin_users set is_active=true');
 assert.equal((await asCustomer(otherId,'select * from public.order_items where order_id=$1::uuid',[orderId])).rows.length,1);
 await db.exec('update public.admin_users set is_active=false');
 for(const sql of ['update public.orders set total_amount=1','delete from public.order_items',"insert into public.orders(user_id,total_amount) values(auth.uid(),1)"]) await assert.rejects(asCustomer(userId,sql),/permission denied/);
});
test('Local PostgreSQL: missing/null/failed 3DS and incomplete verification are rejected, even on replay',async()=>{
 for(const changes of [{threeDS:null},{threeDS:undefined},{threeDS:'failed'},{amountMinor:null},{currency:null},{transactionId:null},{merchantId:null},{eventId:null},{status:null}]) await assert.rejects(finalize(changes),/unverified payment/);
 for(const changes of [{merchantId:'different'},{transactionId:'different'},{status:'pending'},{threeDS:'not_required'}]) await assert.rejects(finalize(changes),/event replay mismatch/);
 assert.equal((await db.query('select status from public.orders where id=$1::uuid',[orderId])).rows[0].status,'paid');
});
test('Local PostgreSQL: schema preflight rejects rerun instead of masking divergence',async()=>{
 await assert.rejects(db.exec(fs.readFileSync('supabase/migrations/20261009120000_order_access_hardening.sql','utf8')),/Already hardened/);
 await db.exec('ROLLBACK');
 await assert.rejects(db.exec(fs.readFileSync('supabase/migrations/20261009130000_payment_transaction_hardening.sql','utf8')),/Already hardened/);
 await db.exec('ROLLBACK');
});

test('Local PostgreSQL: admin status RPC retains active-admin check and cannot overwrite paid',async()=>{
 await assert.rejects(asCustomer(otherId,"select public.nrs_admin_update_order_status($1::uuid,'cancelled')",[orderId]),/not authorized/);
 await db.exec('update public.admin_users set is_active=true');
 await assert.rejects(asCustomer(otherId,"select public.nrs_admin_update_order_status($1::uuid,'cancelled')",[orderId]),/payment state cannot/);
 // Existing failed/cancelled order stays terminal; operational changes do not fake payment.
 await assert.rejects(asCustomer(otherId,"select public.nrs_admin_update_order_status($1::uuid,'paid')",[orderId]),/unsupported/);
 await db.exec('update public.admin_users set is_active=false');
});
test('Local PostgreSQL: malformed summary, quantities, variant ownership and duplicate lines leave no records',async()=>{
 const id='55555555-5555-4555-8555-555555555555';
 await db.exec('update public.product_variants set stock_quantity=5; update public.products set in_stock=false');
 const base=historicalRecord(id,summary);
 const attempt=async(input,legal=base)=>db.query('select public.nrs_create_payment_order($1::uuid,$2::uuid,$3,$4::uuid,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)',[id,userId,null,id,'a'.repeat(64),JSON.stringify(input),JSON.stringify(customer),JSON.stringify(legal),'test-bank']);
 for(const input of [[{...items[0],quantity:null}],[{...items[0],productId:'other-product'}],[{...items[0],variantId:id}],[items[0],items[0]]]) await assert.rejects(attempt(input));
 for(const changes of [{currency:null},{total:null},{shipping:null},{discount:null},{total:1},{items:[{...summary.items[0],unitPrice:1}]}]) await assert.rejects(attempt(items,{...base,order_summary:{...summary,...changes}}));
 assert.equal((await db.query('select count(*)::integer as n from public.orders where id=$1::uuid',[id])).rows[0].n,0);
 assert.equal((await db.query('select stock_quantity from public.product_variants')).rows[0].stock_quantity,5);
 // Catalog and checkout both use active variant stock, not stale legacy flag.
 await attempt(items);
 assert.equal((await db.query('select stock_quantity from public.product_variants')).rows[0].stock_quantity,4);
});

test('Local PostgreSQL: incompatible ownership/status schema aborts migration preflight',async()=>{
 await db.exec('BEGIN; ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL');
 await assert.rejects(db.exec(fs.readFileSync('supabase/migrations/20261009130000_payment_transaction_hardening.sql','utf8')),/expected orders.user_id NOT NULL/);
 await db.exec('ROLLBACK');
 await db.exec("BEGIN; ALTER TABLE public.orders DROP CONSTRAINT orders_status_check; ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK(status IN('pending','payment_pending','cancelled')) NOT VALID");
 await assert.rejects(db.exec(fs.readFileSync('supabase/migrations/20261009130000_payment_transaction_hardening.sql','utf8')),/Status paid incompatible/);
 await db.exec('ROLLBACK');
});

test('Local PostgreSQL: service role retains atomic RPC access; transaction IDs cannot settle two orders',async()=>{
 await db.exec('SET ROLE service_role');
 try { assert.equal((await create()).rows[0].result.created,false); }
 finally { await db.exec('RESET ROLE'); }
 const id='55555555-5555-4555-8555-555555555555';
 await assert.rejects(finalize({eventId:'duplicate-transaction',merchantReference:id}),/duplicate key/);
 assert.equal((await db.query('select state from public.payment_orders where order_id=$1::uuid',[id])).rows[0].state,'initiating');
 assert.equal((await db.query("select count(*)::integer as n from public.payment_events where event_id='duplicate-transaction'")).rows[0].n,0);
 await assert.rejects(db.query('select public.nrs_finalize_payment($1::jsonb,$2)',[JSON.stringify(callback()),'other-provider']),/mismatch/);
});

test('Local PostgreSQL: losing the browser key cannot create a second unresolved payment for the same owner',async()=>{
 const id='66666666-6666-4666-8666-666666666666';
 await assert.rejects(create(id,id,userId),/Unresolved payment exists/);
 assert.equal((await db.query('select count(*)::integer as n from public.orders where id=$1::uuid',[id])).rows[0].n,0);
 assert.equal((await db.query('select stock_quantity from public.product_variants')).rows[0].stock_quantity,4);
});

test('Local PostgreSQL: browser roles cannot bypass service-only payment RPCs or read payment tokens/events',async()=>{
 for(const role of ['anon','authenticated']) {
  await db.exec('SET ROLE '+role);
  try {
   for(const sql of ["select public.nrs_create_payment_order(null,null,null,null,null,null,null,null,null)","select public.nrs_store_payment_redirect(null,null)","select public.nrs_read_payment_order(null,null,null)","select public.nrs_finalize_payment(null,null)",'select * from public.payment_orders','select * from public.payment_events','select * from public.payment_stock_reservations']) await assert.rejects(db.exec(sql),/permission denied/);
  } finally { await db.exec('RESET ROLE'); }
 }
});

test('Local PostgreSQL: verified payment remains paid through admin preparation/delivery and later callbacks',async()=>{
 await assert.rejects(asCustomer(userId,'select public.nrs_admin_payment_summary($1::uuid)',[orderId]),/not authorized/);
 await db.exec('update public.admin_users set is_active=true');
 const metadata=(await asCustomer(otherId,'select public.nrs_admin_payment_summary($1::uuid) as payment',[orderId])).rows[0].payment;
 assert.equal(metadata.state,'paid'); assert.equal(metadata.transactionId,'transaction');
 assert.equal(metadata.redirect_url,undefined); assert.equal(metadata.guest_hash,undefined);
 await asCustomer(otherId,"select public.nrs_admin_update_order_status($1::uuid,'processing')",[orderId]);
 await assert.rejects(asCustomer(otherId,"select public.nrs_admin_update_order_status($1::uuid,'cancelled')",[orderId]),/refund workflow/);
 await asCustomer(otherId,"select public.nrs_admin_update_order_status($1::uuid,'shipped')",[orderId]);
 await asCustomer(otherId,"select public.nrs_admin_update_order_status($1::uuid,'delivered')",[orderId]);
 await finalize({eventId:'paid-after-delivery'});
 assert.equal((await db.query('select status from public.orders where id=$1::uuid',[orderId])).rows[0].status,'delivered');
 assert.equal((await db.query('select state from public.payment_orders where order_id=$1::uuid',[orderId])).rows[0].state,'paid');
 await db.exec('update public.admin_users set is_active=false');
 await db.exec('SET ROLE anon');
 try { await assert.rejects(db.query('select public.nrs_admin_payment_summary($1::uuid)',[orderId]),/permission denied/); }
 finally { await db.exec('RESET ROLE'); }
});
