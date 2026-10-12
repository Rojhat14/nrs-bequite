const fs=require('node:fs'),path=require('node:path');
const targetRef='dzuxhwtbuojnhibzfxqy';
const read=name=>fs.readFileSync(path.join(__dirname,'../supabase/migrations',name),'utf8');
const withoutTransaction=sql=>sql.replace(/^BEGIN;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,'');
const base=`
-- TEST ONLY: dzuxhwtbuojnhibzfxqy. Never apply to NRS Production.
-- Run once against an empty application schema; no orders/auth users are seeded.
BEGIN;
SET LOCAL nrs.test_project_ref = '${targetRef}';
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF current_setting('nrs.test_project_ref',true) IS DISTINCT FROM '${targetRef}' THEN RAISE EXCEPTION 'Wrong test project'; END IF;
 IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN('r','p')) THEN RAISE EXCEPTION 'Test bootstrap requires empty public schema; existing/live database refused'; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role' AND rolbypassrls)
  OR to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL THEN RAISE EXCEPTION 'Supabase role/auth prerequisites missing'; END IF;
END $$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
`;
const customers=`
CREATE TABLE public.profiles(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 first_name text,last_name text,phone text,email text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.wishlist(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,product_id));
CREATE TABLE public.orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id),
 total_amount numeric NOT NULL CHECK(total_amount>0),status text DEFAULT 'pending' NOT NULL
 CHECK(status IN('pending','payment_pending','paid','processing','shipped','delivered','cancelled','refunded')),
 customer_name text,customer_email text,customer_phone text,shipping_address text,shipping_city text,
 shipping_district text,shipping_postal_code text,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.order_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES public.orders(id),
 product_id text NOT NULL REFERENCES public.products(id),quantity integer NOT NULL CHECK(quantity>0),price_at_purchase numeric NOT NULL CHECK(price_at_purchase>0));
CREATE TABLE public.collections(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL,slug text NOT NULL UNIQUE,
 description text,image_url text,is_active boolean NOT NULL DEFAULT true,sort_order integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.product_collections(product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
 collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,PRIMARY KEY(product_id,collection_id));
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles,public.wishlist,public.orders,public.order_items,public.collections,public.product_collections FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.categories,public.products,public.product_variants,public.product_images,
 public.collections,public.product_collections,public.profiles,public.wishlist,public.orders,public.order_items TO service_role;
GRANT SELECT ON public.admin_users TO service_role;
`;
const names=['20260928130000_admin_panel_access.sql','20260928150000_collections_product_collections.sql',
 '20261009120000_order_access_hardening.sql','20261008120000_order_legal_records.sql',
 '20261008130000_payment_order_transactions.sql','20261009130000_payment_transaction_hardening.sql',
 '20261009140000_final_security_review_fixes.sql','20261009150000_customer_access_hardening.sql',
 '20261010130000_manual_order_details.sql'];
const seeds=`
SET LOCAL search_path=public,pg_catalog;
INSERT INTO public.categories(id,name,slug,description) VALUES
 ('90000000-0000-4000-8000-000000000001','Garanti TEST','garanti-test','Yalnızca izole banka testleri için sentetik ürünler');
INSERT INTO public.products(id,name,slug,category_id,description,price_amount,currency,status,in_stock) VALUES
 ('garanti-test-accessory','Garanti TEST Aksesuar','garanti-test-aksesuar','90000000-0000-4000-8000-000000000001','Sentetik test ürünü; gerçek satış değildir.',1.00,'TRY','active',true),
 ('garanti-test-dress','Garanti TEST Elbise','garanti-test-elbise','90000000-0000-4000-8000-000000000001','Sentetik ölçülü test ürünü; gerçek satış değildir.',2.00,'TRY','active',true);
INSERT INTO public.product_variants(id,product_id,size,stock_quantity,is_active) VALUES
 ('90000000-0000-4000-8000-000000000011','garanti-test-accessory',NULL,20,true),
 ('90000000-0000-4000-8000-000000000012','garanti-test-dress','M',20,true);
-- Assert minimum permissions explicitly: automatic table exposure is not used.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['categories','products','product_images','product_variants','collections','product_collections',
  'profiles','wishlist','orders','order_items','admin_users','order_legal_records','payment_orders','payment_events','payment_stock_reservations'] LOOP
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.'||t)) THEN RAISE EXCEPTION 'RLS absent: %',t; END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY['orders','order_items','profiles','wishlist','admin_users','order_legal_records','payment_orders','payment_events','payment_stock_reservations'] LOOP
  IF has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'Anonymous private-table grant: %',t; END IF;
 END LOOP;
 IF has_function_privilege('anon','public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)','EXECUTE')
  OR has_function_privilege('authenticated','public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)','EXECUTE')
  OR has_function_privilege('authenticated','public.nrs_finalize_payment(jsonb,text)','EXECUTE') THEN RAISE EXCEPTION 'Browser payment RPC grant'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
`;
function build(){return base+read('20260928000000_admin_users.sql')+read('20260928120000_product_database_foundation.sql')+customers+
 names.map(n=>'\n-- Reuse reviewed migration: '+n+'\n'+withoutTransaction(read(n))).join('\n')+seeds}
if(require.main===module){const out=path.join(__dirname,'../supabase/test-setup/dzuxhwtbuojnhibzfxqy-bootstrap.sql');fs.writeFileSync(out,build());console.log('Test bootstrap generated; target '+targetRef)}
module.exports={build,targetRef};
