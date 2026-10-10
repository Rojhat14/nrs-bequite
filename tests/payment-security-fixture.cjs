// Synthetic local fixture only; never connects to Supabase or customer data.
const fs=require('node:fs');
const {loader}=require('./source-loader.cjs');
const load=loader();
const {prepareOrderLegalRecord}=load('src/lib/legal/payment-preflight.ts');
const {createLegalAcceptance}=load('src/lib/legal/acceptance.ts');
const orderId='11111111-1111-4111-8111-111111111111', userId='22222222-2222-4222-8222-222222222222', otherId='33333333-3333-4333-8333-333333333333';
const variantId='44444444-4444-4444-8444-444444444444';
const summary={ items:[{productId:'product',name:'Test Ürün',description:'Pamuk',size:'M',quantity:1,unitPrice:100}],
 buyer:{name:'Test Alıcı',email:'test@example.com',phone:'905551234567',address:'Beytepe, Çankaya, Ankara'},subtotal:120,discount:20,shipping:20,total:120,currency:'TRY',paymentMethod:'Online kartla ödeme',deliveryTerms:'Teyit edilmiş süre',orderedAt:new Date().toISOString()};
const customer={firstName:'Test',lastName:'Alıcı',email:'test@example.com',phone:'905551234567',address:'Beytepe',city:'Ankara',district:'Çankaya',postalCode:''};
const items=[{productId:'product',variantId,quantity:1}];

const correction='supabase/migrations/20261009140000_final_security_review_fixes.sql';
const read=p=>fs.readFileSync(p,'utf8');
async function setup(db, applyFix=true, hooks={}) {
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
 CREATE TABLE public.orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,total_amount numeric NOT NULL,status text DEFAULT 'pending' CHECK(status IN('pending','payment_pending','paid','processing','shipped','delivered','cancelled','refunded')),customer_name text,customer_email text,customer_phone text,shipping_address text,shipping_city text,shipping_district text,shipping_postal_code text,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid NOT NULL references public.orders(id),product_id text NOT NULL,quantity integer NOT NULL,price_at_purchase numeric NOT NULL);
 CREATE TABLE public.products(id text primary key,name text NOT NULL,description text,price_amount numeric NOT NULL,compare_at_price numeric,currency text NOT NULL,status text NOT NULL,in_stock boolean NOT NULL);
 CREATE TABLE public.product_variants(id uuid PRIMARY KEY,product_id text REFERENCES public.products(id),size text,stock_quantity integer NOT NULL CHECK(stock_quantity>=0),is_active boolean NOT NULL);
 INSERT INTO public.products VALUES('product','Test Ürün','Pamuk',100,120,'TRY','active',true);
 INSERT INTO public.product_variants VALUES('${variantId}','product','M',1,true);
 ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
 GRANT SELECT ON public.orders TO authenticated;
 CREATE POLICY owner_read ON public.orders FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.nrs_is_active_admin());`);
 const admin=read('supabase/migrations/20260928130000_admin_panel_access.sql');
 await db.exec(admin.slice(admin.indexOf('CREATE OR REPLACE FUNCTION public.nrs_admin_update_order_status'),admin.indexOf('-- Aggregate customer totals')));
 if(hooks.beforeOrder) await hooks.beforeOrder(db);
 await db.exec(read('supabase/migrations/20261009120000_order_access_hardening.sql'));
 if(hooks.afterOrder) await hooks.afterOrder(db);
 for(const f of ['20261008120000_order_legal_records.sql','20261008130000_payment_order_transactions.sql','20261009130000_payment_transaction_hardening.sql']) await db.exec(read('supabase/migrations/'+f));
 if(applyFix) await db.exec(read(correction));
 await db.exec('update public.admin_users set is_active=true');
}
function historicalRecord(id,snapshot) {
 const record=prepareOrderLegalRecord(id,createLegalAcceptance(true),snapshot);
 const archive=load('src/lib/legal/documents.ts').LEGAL_DOCUMENT_ARCHIVE['v1.1'];
 record.contract_version='v1.1'; record.pre_information_version='v1.1';
 record.document_hash=require('node:crypto').createHash('sha256').update(JSON.stringify({seller:archive.seller,contract:archive.documents['mesafeli-satis-sozlesmesi'],preInformation:archive.documents['on-bilgilendirme-formu']})).digest('hex');
 return record;
}
async function create(db) {
 return db.query('select public.nrs_create_payment_order($1::uuid,$2::uuid,null,$1::uuid,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7)',
 [orderId,userId,'a'.repeat(64),JSON.stringify(items),JSON.stringify(customer),JSON.stringify(historicalRecord(orderId,summary)),'test-bank']);
}
const callback=(changes={})=>({eventId:'event',merchantId:'test',merchantReference:orderId,transactionId:'transaction',amountMinor:12000,currency:'TRY',status:'paid',threeDS:'authenticated',...changes});
const finalize=(db,changes={})=>db.query('select public.nrs_finalize_payment($1::jsonb,$2)',[JSON.stringify(callback(changes)),'test-bank']);
async function admin(db,status='cancelled') {
 await db.exec('SET ROLE authenticated');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[otherId]);
 try { return await db.query('select public.nrs_admin_update_order_status($1::uuid,$2)',[orderId,status]); }
 finally { await db.exec('RESET ROLE'); }
}
async function state(db) {
 return (await db.query('select o.status,p.state,v.stock_quantity,(select count(*)::int from public.payment_events) events,(select count(*)::int from public.payment_stock_reservations where released) released from public.orders o left join public.payment_orders p on p.order_id=o.id cross join public.product_variants v where o.id=$1::uuid',[orderId])).rows[0];
}
module.exports={historicalRecord,setup,create,callback,finalize,admin,state,read,correction,orderId,userId,otherId};
