-- LOCAL REVIEW ONLY: never apply automatically to production.
-- First customer-security stage: closes orders/items/profiles/wishlist together.
-- Run ONCE before payment/legal migrations and final reconciliation.
-- Reviewed legacy admin RPC is upgraded with an order-row lock; data is preserved.
-- Browser writes are unsupported: audited checkout writes via service-only RPC;
-- WhatsApp sends a request, admin status edits use the existing secured RPC.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
DO $$
DECLARE r record; t text; history text; already_applied boolean;
BEGIN
  IF to_regprocedure('public.nrs_is_active_admin()') IS NULL OR to_regprocedure('public.nrs_admin_update_order_status(uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Existing active-admin authorization is required';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_proc WHERE oid='public.nrs_is_active_admin()'::regprocedure AND prosecdef AND prorettype='boolean'::regtype) THEN
    RAISE EXCEPTION 'Review existing admin predicate before proceeding';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('orders','id','uuid'),('orders','user_id','uuid'),('order_items','order_id','uuid')) AS required(t,c,typ) LOOP
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name=r.t AND column_name=r.c AND udt_name=r.typ) THEN
      RAISE EXCEPTION 'Schema mismatch: %.%',r.t,r.c;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.orders'::regclass AND contype='p' AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.orders'::regclass AND attname='id')])
    OR NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.order_items'::regclass AND confrelid='public.orders'::regclass AND contype='f' AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.order_items'::regclass AND attname='order_id')]) THEN
    RAISE EXCEPTION 'Review order primary key / item foreign key';
  END IF;
  IF EXISTS (SELECT FROM pg_policy WHERE polrelid='public.orders'::regclass AND polname='nrs_customer_order_read') THEN
    RAISE EXCEPTION 'Already hardened: inspect migration history rather than rerunning';
  END IF;
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
    AND table_name='orders' AND column_name='user_id' AND is_nullable='YES')
    OR NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
    AND table_name='orders' AND column_name='user_id' AND is_nullable='NO') THEN
    RAISE EXCEPTION 'STOP: preserve existing orders.user_id NOT NULL; no ownership conversion authorized';
  END IF;
  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    EXECUTE 'SELECT string_agg(version::text,'','' ORDER BY version) FROM supabase_migrations.schema_migrations'
      INTO history;
    RAISE NOTICE 'Existing migration versions (not modified): %',coalesce(history,'<empty>');
    EXECUTE 'SELECT EXISTS (SELECT FROM supabase_migrations.schema_migrations WHERE version::text=''20261009120000'')' INTO already_applied;
    IF already_applied THEN
      RAISE EXCEPTION 'STOP: order-access migration already recorded; no replay or history repair authorized';
    END IF;
  ELSE
    RAISE NOTICE 'Migration history absent: no prior migration application inferred or replayed';
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication))
    OR EXISTS (SELECT FROM pg_auth_members m JOIN pg_roles role ON role.oid=m.member
      WHERE role.rolname IN ('anon','authenticated')) THEN
    RAISE EXCEPTION 'STOP: unexpected browser role capabilities/membership; no role changes authorized';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role' AND rolbypassrls)
    OR pg_has_role('service_role','anon','MEMBER')
    OR pg_has_role('service_role','authenticated','MEMBER')
    OR NOT has_schema_privilege('anon','public','USAGE')
    OR NOT has_schema_privilege('authenticated','public','USAGE')
    OR has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE') THEN
    RAISE EXCEPTION 'STOP: unexpected service_role or public-schema CREATE capability';
  END IF;
  FOR r IN SELECT c.relname,pg_get_userbyid(c.relowner) owner FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    AND c.relname IN ('orders','order_items','profiles','wishlist','admin_users') LOOP
    IF r.owner IN ('anon','authenticated','service_role') THEN
      RAISE EXCEPTION 'STOP: unexpected table owner on %',r.relname;
    END IF;
  END LOOP;
  -- Do not silently remove service_role capabilities inherited from PUBLIC.
  FOR r IN SELECT c.relname,a.privilege_type FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
    WHERE n.nspname='public' AND c.relname IN ('orders','order_items','profiles','wishlist') AND a.grantee=0 LOOP
    IF NOT EXISTS (SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
      WHERE c.oid=format('public.%I',r.relname)::regclass AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname='service_role')
      AND a.privilege_type=r.privilege_type) THEN
      RAISE EXCEPTION 'STOP: service_role may depend on PUBLIC %.% grant; no service grant change authorized',r.relname,r.privilege_type;
    END IF;
  END LOOP;
  FOR r IN SELECT c.relname,col.attname,a.privilege_type FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute col ON col.attrelid=c.oid AND col.attnum>0 AND NOT col.attisdropped
    CROSS JOIN LATERAL aclexplode(col.attacl) a WHERE n.nspname='public'
    AND c.relname IN ('orders','order_items','profiles','wishlist') AND a.grantee=0 LOOP
    IF NOT has_table_privilege('service_role','public.'||r.relname,r.privilege_type)
      AND NOT EXISTS (SELECT FROM pg_attribute col CROSS JOIN LATERAL aclexplode(col.attacl) a
        WHERE col.attrelid=format('public.%I',r.relname)::regclass AND col.attname=r.attname
        AND a.grantee=(SELECT oid FROM pg_roles WHERE rolname='service_role') AND a.privilege_type=r.privilege_type) THEN
      RAISE EXCEPTION 'STOP: service_role may depend on PUBLIC column %.% grant',r.relname,r.attname;
    END IF;
  END LOOP;
  -- Check the column before pg_get_serial_sequence: an absent id must hit
  -- the explicit schema guard rather than raising an incidental catalog error.
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
    AND table_name='wishlist' AND column_name='id') THEN
    RAISE EXCEPTION 'STOP: Expected existing wishlist.id';
  END IF;
  t:=pg_get_serial_sequence('public.wishlist','id');
  IF t IS NOT NULL AND EXISTS (SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE c.oid=t::regclass AND a.grantee=0) THEN
    RAISE EXCEPTION 'STOP: unreviewed PUBLIC wishlist sequence grant; preserve service access';
  END IF;
  IF to_regclass('public.admin_users') IS NULL THEN RAISE EXCEPTION 'STOP: admin registry absent'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.admin_users'::regclass) THEN
    RAISE EXCEPTION 'STOP: admin registry RLS disabled; no admin changes authorized';
  END IF;
  FOR r IN SELECT attname,attnum FROM pg_attribute WHERE attrelid='public.admin_users'::regclass AND attnum>0 AND NOT attisdropped LOOP
    IF has_column_privilege('anon','public.admin_users',r.attname,'INSERT')
      OR has_column_privilege('anon','public.admin_users',r.attname,'UPDATE')
      OR has_column_privilege('authenticated','public.admin_users',r.attname,'INSERT')
      OR has_column_privilege('authenticated','public.admin_users',r.attname,'UPDATE') THEN
      RAISE EXCEPTION 'STOP: unexpected admin registry write permission on %',r.attname;
    END IF;
  END LOOP;
  IF has_table_privilege('anon','public.admin_users','DELETE,TRUNCATE,TRIGGER')
    OR has_table_privilege('authenticated','public.admin_users','DELETE,TRUNCATE,TRIGGER') THEN
    RAISE EXCEPTION 'STOP: unexpected admin registry destructive permission';
  END IF;
  -- Reviewed exact bodies: supplied live definition and repository legacy source.
  -- Neither whitespace normalization nor a name-only exemption is permitted.
  IF NOT EXISTS (SELECT FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
    WHERE p.oid=to_regprocedure('public.nrs_admin_update_order_status(uuid,text)')
      AND p.prosecdef AND p.prokind='f' AND p.prorettype='void'::regtype
      AND l.lanname='plpgsql' AND p.proconfig=ARRAY['search_path=""']::text[]
      AND pg_get_userbyid(p.proowner) NOT IN ('anon','authenticated','service_role')
      AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') IN ('f720fc61d713e618135b9646a4d31588bf8e1f87a2895240f642d1a97cbc1d7d','c1ece8f8401ea641f9e6b716df1eb69db8ce4fb8b7975c7c49a87cb13095bf9c'))
    OR has_function_privilege('anon','public.nrs_admin_update_order_status(uuid,text)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.nrs_admin_update_order_status(uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'STOP: unreviewed legacy admin RPC definition/owner/ACL; preserve and review';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
    WHERE p.oid=to_regprocedure('public.nrs_is_active_admin()') AND p.prosecdef
      AND p.prokind='f' AND p.prorettype='boolean'::regtype AND l.lanname='sql'
      AND p.proconfig=ARRAY['search_path=""']::text[]
      AND pg_get_userbyid(p.proowner) NOT IN ('anon','authenticated','service_role')
      AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')='b13925b08fe9c02ca430c6f941888aa9aee3f97466a2a37bb5a28140ded5ba80')
    OR has_function_privilege('anon','public.nrs_is_active_admin()','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.nrs_is_active_admin()','EXECUTE') THEN
    RAISE EXCEPTION 'STOP: unreviewed active-admin predicate definition/owner/ACL';
  END IF;
  -- Permissive policies combine with OR; leaving any old broad policy defeats
  -- new owner checks. Record metadata in deployment logs before replacing them.
  FOR r IN SELECT tablename,policyname,cmd,roles,qual,with_check FROM pg_policies WHERE schemaname='public' AND tablename IN ('orders','order_items') LOOP
    RAISE NOTICE 'Replacing policy %.% command=% roles=% USING=% CHECK=%',r.tablename,r.policyname,r.cmd,r.roles,r.qual,r.with_check;
    EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,r.tablename);
  END LOOP;
END $$;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orders,public.order_items FROM PUBLIC,anon,authenticated;
-- Column grants are independent of table grants and must also be removed.
DO $$ DECLARE t text; columns text; BEGIN
  FOREACH t IN ARRAY ARRAY['orders','order_items'] LOOP
    SELECT string_agg(quote_ident(attname),',') INTO columns FROM pg_attribute WHERE attrelid=format('public.%I',t)::regclass AND attnum>0 AND NOT attisdropped;
    EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.%I FROM PUBLIC,anon,authenticated',columns,columns,columns,columns,t);
  END LOOP;
END $$;
GRANT SELECT ON public.orders,public.order_items TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.orders,public.order_items TO service_role;
CREATE POLICY nrs_customer_order_read ON public.orders FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_active_admin_order_read ON public.orders FOR SELECT TO authenticated USING ((SELECT public.nrs_is_active_admin()));
CREATE POLICY nrs_customer_order_item_read ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.user_id=(SELECT auth.uid())));
CREATE POLICY nrs_active_admin_order_item_read ON public.order_items FOR SELECT TO authenticated USING ((SELECT public.nrs_is_active_admin()));
-- Serialize admin status edits with payment finalization; otherwise an old
-- pending read can overwrite a paid result after waiting for a row lock.
CREATE OR REPLACE FUNCTION public.nrs_admin_update_order_status(p_order_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_status text;
BEGIN
  IF public.nrs_is_active_admin() IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('pending', 'payment_pending', 'processing', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported operational order status' USING ERRCODE = '22023';
  END IF;

  SELECT o.status INTO current_status
  FROM public.orders AS o
  WHERE o.id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found' USING ERRCODE = 'P0002';
  END IF;

  IF current_status IS NULL OR current_status NOT IN
    ('pending','payment_pending','paid','processing','shipped','delivered','cancelled','refunded') THEN
    RAISE EXCEPTION 'unknown current order status; manual review required' USING ERRCODE='22023';
  END IF;

  -- This legacy schema stores payment and fulfillment state in one column.
  -- Do not overwrite a payment result or advance an unpaid order to fulfillment.
  IF current_status IN ('paid', 'refunded') THEN
    RAISE EXCEPTION 'payment state cannot be replaced by an operational status' USING ERRCODE = '22023';
  END IF;
  IF current_status IN ('pending', 'payment_pending') AND p_status <> 'cancelled' THEN
    RAISE EXCEPTION 'unpaid order cannot advance to fulfillment' USING ERRCODE = '22023';
  END IF;
  IF current_status = 'processing' AND p_status NOT IN ('shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported fulfillment transition' USING ERRCODE = '22023';
  END IF;
  IF current_status = 'shipped' AND p_status NOT IN ('delivered', 'cancelled') THEN
    RAISE EXCEPTION 'unsupported fulfillment transition' USING ERRCODE = '22023';
  END IF;
  IF current_status NOT IN ('pending', 'payment_pending', 'processing', 'shipped') THEN
    RAISE EXCEPTION 'current order status is not editable in admin' USING ERRCODE = '22023';
  END IF;

  UPDATE public.orders
  SET status = p_status
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.nrs_admin_update_order_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nrs_admin_update_order_status(uuid, text) TO authenticated;


-- Close all four customer-table ACL/RLS gaps in this first transaction.
DO $$
DECLARE r record; t text; cols text;
BEGIN
  IF NOT EXISTS (SELECT FROM pg_proc WHERE oid=to_regprocedure('public.nrs_is_active_admin()')
    AND prosecdef AND prorettype='boolean'::regtype) THEN
    RAISE EXCEPTION 'Review existing active-admin predicate first';
  END IF;
  -- This early stage requires the newly locked, reviewed order RPC;
  -- payment prerequisites remain in the unchanged final customer migration.
  IF NOT EXISTS (SELECT FROM pg_proc WHERE oid=to_regprocedure('public.nrs_admin_update_order_status(uuid,text)')
    AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='c10311b6c4f4647b3e09934d9807c73808b598e1b49cc7520d108f5a13d98ac5') THEN
    RAISE EXCEPTION 'STOP: early customer reconciliation requires reviewed locked order RPC';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('profiles','id','uuid'),('wishlist','user_id','uuid'),
    ('wishlist','product_id','text'),('orders','id','uuid'),('orders','user_id','uuid'),
    ('order_items','order_id','uuid')) required(t,c,typ) LOOP
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
      AND table_name=r.t AND column_name=r.c AND udt_name=r.typ AND domain_name IS NULL) THEN
      RAISE EXCEPTION 'Customer schema mismatch: %.%',r.t,r.c;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
    AND table_name='wishlist' AND column_name='id') THEN
    RAISE EXCEPTION 'Expected existing wishlist.id';
  END IF;
  FOR r IN SELECT * FROM (VALUES ('first_name'),('last_name'),('phone'),('email')) required(c) LOOP
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
      AND table_name='profiles' AND column_name=r.c AND data_type IN ('text','character varying')
      AND domain_name IS NULL) THEN RAISE EXCEPTION 'Review profile field %',r.c; END IF;
  END LOOP;
  IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid='public.profiles'::regclass AND contype='p'
    AND conkey=ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.profiles'::regclass AND attname='id')]) THEN
    RAISE EXCEPTION 'Expected profiles.id primary key for existing signup upsert';
  END IF;
  -- Do not invent defaults, change IDs, or repair existing legacy rows.
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public'
    AND table_name IN ('profiles','wishlist') AND is_nullable='NO' AND column_default IS NULL
    AND is_identity='NO' AND is_generated='NEVER' AND NOT (
      (table_name='profiles' AND column_name IN ('id','first_name','last_name','phone','email')) OR
      (table_name='wishlist' AND column_name IN ('user_id','product_id')))) THEN
    RAISE EXCEPTION 'Required customer column without default: review existing insert compatibility';
  END IF;
  FOREACH t IN ARRAY ARRAY['profiles','wishlist','orders','order_items'] LOOP
    -- Permissive policies OR together: remove old public ALL/true policies too.
    FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      RAISE NOTICE 'Replacing policy %.%',t,r.policyname;
      EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_attribute
      WHERE attrelid=format('public.%I',t)::regclass AND attnum>0 AND NOT attisdropped;
    EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.%I FROM PUBLIC,anon,authenticated',cols,cols,cols,cols,t);
  END LOOP;
  -- Serial wishlist IDs, when present, need USAGE for the existing insert.
  -- No arbitrary sequence grant, no sequence UPDATE, no ID/schema conversion.
  t:=pg_get_serial_sequence('public.wishlist','id');
  IF t IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO authenticated',t);
  END IF;
END $$;
GRANT SELECT ON public.profiles,public.wishlist TO authenticated;
GRANT SELECT ON public.orders,public.order_items TO authenticated;
GRANT INSERT (id,first_name,last_name,phone,email) ON public.profiles TO authenticated;
GRANT UPDATE (first_name,last_name,phone) ON public.profiles TO authenticated;
GRANT INSERT (user_id,product_id) ON public.wishlist TO authenticated;
GRANT DELETE ON public.wishlist TO authenticated;
CREATE POLICY nrs_customer_profile_read ON public.profiles FOR SELECT TO authenticated
  USING (id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_profile_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_profile_update ON public.profiles FOR UPDATE TO authenticated
  USING (id=(SELECT auth.uid())) WITH CHECK (id=(SELECT auth.uid()));
CREATE POLICY nrs_active_admin_profile_read ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));
CREATE POLICY nrs_customer_wishlist_read ON public.wishlist FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_wishlist_insert ON public.wishlist FOR INSERT TO authenticated
  WITH CHECK (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_customer_wishlist_delete ON public.wishlist FOR DELETE TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_active_admin_wishlist_read ON public.wishlist FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));
CREATE POLICY nrs_customer_order_read ON public.orders FOR SELECT TO authenticated
  USING (user_id=(SELECT auth.uid()));
CREATE POLICY nrs_active_admin_order_read ON public.orders FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));
CREATE POLICY nrs_customer_order_item_read ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.user_id=(SELECT auth.uid())));
CREATE POLICY nrs_active_admin_order_item_read ON public.order_items FOR SELECT TO authenticated
  USING ((SELECT public.nrs_is_active_admin()));

-- Metadata-only final checks execute BEFORE commit. Failure rolls back changes.
DO $verify$
DECLARE t text; r record; allowed boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders','order_items','profiles','wishlist'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=format('public.%I',t)::regclass) THEN
      RAISE EXCEPTION 'STOP: RLS verification failed for %',t;
    END IF;
    IF has_table_privilege('anon','public.'||t,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_table_privilege('authenticated','public.'||t,'INSERT,UPDATE,TRUNCATE,REFERENCES,TRIGGER')
      OR NOT has_table_privilege('authenticated','public.'||t,'SELECT')
      OR (t<>'wishlist' AND has_table_privilege('authenticated','public.'||t,'DELETE'))
      OR (t='wishlist' AND NOT has_table_privilege('authenticated','public.'||t,'DELETE')) THEN
      RAISE EXCEPTION 'STOP: effective table ACL verification failed for %',t;
    END IF;
    FOR r IN SELECT a.attname,privilege.name FROM pg_attribute a
      CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) privilege(name)
      WHERE a.attrelid=format('public.%I',t)::regclass AND a.attnum>0 AND NOT a.attisdropped LOOP
      allowed:=r.name='SELECT' OR (r.name='INSERT' AND
        ((t='profiles' AND r.attname IN ('id','first_name','last_name','phone','email'))
         OR (t='wishlist' AND r.attname IN ('user_id','product_id'))))
        OR (r.name='UPDATE' AND t='profiles' AND r.attname IN ('first_name','last_name','phone'));
      IF has_column_privilege('anon','public.'||t,r.attname,r.name)
        OR has_column_privilege('authenticated','public.'||t,r.attname,r.name) IS DISTINCT FROM allowed THEN
        RAISE EXCEPTION 'STOP: effective column ACL verification failed for %.% %',t,r.attname,r.name;
      END IF;
    END LOOP;
  END LOOP;
  IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='orders'
    AND column_name='user_id' AND is_nullable='NO') THEN RAISE EXCEPTION 'STOP: ownership nullability changed'; END IF;
  t:=pg_get_serial_sequence('public.wishlist','id');
  IF t IS NOT NULL AND (NOT has_sequence_privilege('authenticated',t,'USAGE')
    OR has_sequence_privilege('authenticated',t,'SELECT,UPDATE') OR has_sequence_privilege('anon',t,'USAGE,SELECT,UPDATE')) THEN
    RAISE EXCEPTION 'STOP: wishlist sequence verification failed';
  END IF;
  RAISE NOTICE 'Verified ACL/RLS metadata; COMMIT must complete without error. No customer data or RPC bodies changed.';
END $verify$;
COMMIT;
