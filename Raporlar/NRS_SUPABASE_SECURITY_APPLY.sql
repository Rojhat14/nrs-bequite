-- NRS manual Dashboard operation ONLY: moiynemxthkmgpgnfajd.
-- Not applied by Codex. Confirm Dashboard project ref and backup before Run.
-- One file / one manual Run: read-only inventory, guarded ACL/RLS, final checks.
-- Never run old migrations to satisfy a STOP. Review the reported discrepancy.
-- No customer DML, schema/NOT NULL conversion, RPC replacement, history write,
-- service_role grant change, admin provisioning, payment activation or network.
-- If execution stops, do not continue fragments; ROLLBACK an open transaction.
-- ONLY METADATA. No customer/order/product rows are read or written.
-- Run only in the verified project as a standalone guarded operation.
-- This file does not apply or replay migrations.
-- Save the results privately for schema comparison. Do not share credentials.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';

SELECT current_database() AS database_name, current_user AS database_role,
       to_regclass('supabase_migrations.schema_migrations') AS migration_history;
-- current_database() alone does NOT identify the Supabase project. Also compare
-- Dashboard project ref with the configured site's Supabase URL project ref.

SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname;

SELECT table_schema, table_name, column_name, data_type, udt_schema, udt_name,
       domain_schema, domain_name,
       is_nullable, column_default, is_identity, is_generated, ordinal_position
FROM information_schema.columns
WHERE (table_schema='public' AND table_name IN
  ('orders','order_items','profiles','wishlist','favorites','products','product_variants',
   'admin_users','order_legal_records','payment_orders','payment_stock_reservations','payment_events'))
   OR (table_schema='auth' AND table_name='users' AND column_name='id')
ORDER BY table_schema,table_name,ordinal_position;

SELECT n.nspname AS schema_name, c.relname AS table_name, con.conname,
       con.contype AS constraint_type, pg_get_constraintdef(con.oid,true) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
 ('orders','order_items','profiles','wishlist','favorites','products','product_variants',
  'admin_users','order_legal_records','payment_orders','payment_stock_reservations','payment_events')
ORDER BY c.relname,con.conname;

SELECT n.nspname AS enum_schema, t.typname AS enum_type,e.enumlabel,e.enumsortorder
FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace
WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder;

SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' AND tablename IN
 ('orders','order_items','profiles','wishlist','favorites','products','product_variants',
  'admin_users','order_legal_records','payment_orders','payment_stock_reservations','payment_events')
ORDER BY tablename,policyname;

SELECT table_schema,table_name,grantee,privilege_type,is_grantable
FROM information_schema.table_privileges WHERE table_schema='public' AND table_name IN
 ('orders','order_items','profiles','wishlist','favorites','products','product_variants',
  'admin_users','order_legal_records','payment_orders','payment_stock_reservations','payment_events')
ORDER BY table_name,grantee,privilege_type;

SELECT n.nspname AS schema_name,p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,p.proconfig,p.proacl,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('nrs_is_active_admin','nrs_prevent_legal_record_update','nrs_create_payment_order',
  'nrs_store_payment_redirect','nrs_finalize_payment','nrs_read_payment_order')
   OR (n.nspname='public' AND p.proname IN
   ('nrs_admin_update_order_status','nrs_admin_user_summary','nrs_admin_payment_summary','nrs_duplicate_product'))
ORDER BY p.proname;

SELECT c.relname AS table_name,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid,true) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal AND c.relname IN
 ('orders','order_items','profiles','wishlist','favorites','products','product_variants','order_legal_records')
ORDER BY c.relname,t.tgname;

SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename IN
 ('orders','order_items','order_legal_records','payment_orders','payment_stock_reservations','payment_events')
ORDER BY tablename,indexname;

SELECT pg_get_userbyid(d.defaclrole) AS owner, n.nspname AS schema_name,
       d.defaclobjtype, d.defaclacl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
WHERE n.nspname='public' OR d.defaclnamespace=0;

SELECT rolname,rolsuper,rolbypassrls FROM pg_roles
WHERE rolname IN ('anon','authenticated','service_role');

-- Table ACLs do not show independent column grants or inherited role access.
SELECT table_name,column_name,grantee,privilege_type,is_grantable
FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name IN ('profiles','wishlist','orders','order_items')
ORDER BY table_name,column_name,grantee,privilege_type;

SELECT role.rolname,c.relname,privilege.name,
       has_table_privilege(role.oid,c.oid,privilege.name) AS effective_access
FROM pg_roles role CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) privilege(name)
WHERE role.rolname IN ('anon','authenticated','service_role') AND n.nspname='public'
  AND c.relkind IN ('r','p') AND c.relname IN ('profiles','wishlist','orders','order_items','admin_users',
    'categories','products','product_images','product_variants','collections','product_collections',
    'order_legal_records','payment_orders','payment_stock_reservations','payment_events')
ORDER BY c.relname,role.rolname,privilege.name;

SELECT member.rolname AS member,parent.rolname AS inherited_role,m.admin_option
FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member
JOIN pg_roles parent ON parent.oid=m.roleid
WHERE member.rolname IN ('anon','authenticated','service_role');

-- Include unknown/overloaded RPCs too; definitions require a separate secure
-- administrator review. An unlisted definer RPC could bypass the four RLS sets.
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,p.proacl,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       has_function_privilege('service_role',p.oid,'EXECUTE') AS service_role_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prokind='f' ORDER BY p.proname,arguments;

SELECT role.rolname,c.relname,a.attname,privilege.name,
       has_column_privilege(role.oid,c.oid,a.attnum,privilege.name) AS effective_access
FROM pg_roles role CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) privilege(name)
WHERE role.rolname IN ('anon','authenticated','service_role') AND n.nspname='public'
  AND c.relkind IN ('r','p') AND c.relname IN ('profiles','wishlist','orders','order_items')
ORDER BY c.relname,role.rolname,a.attnum,privilege.name;

-- Only sequences owned by wishlist.id, including identity/serial dependencies.
SELECT n.nspname AS sequence_schema,s.relname AS sequence_name,s.relacl,
       role.rolname,has_sequence_privilege(role.oid,s.oid,'USAGE') AS usage,
       has_sequence_privilege(role.oid,s.oid,'UPDATE') AS sequence_update
FROM pg_class s JOIN pg_namespace n ON n.oid=s.relnamespace
JOIN pg_depend d ON d.classid='pg_class'::regclass AND d.objid=s.oid
JOIN pg_class t ON t.oid=d.refobjid JOIN pg_namespace tn ON tn.oid=t.relnamespace
JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid
CROSS JOIN pg_roles role
WHERE s.relkind='S' AND d.deptype IN ('a','i') AND tn.nspname='public'
  AND t.relname='wishlist' AND a.attname='id'
  AND role.rolname IN ('anon','authenticated','service_role')
ORDER BY n.nspname,s.relname,role.rolname;

DO $history$ DECLARE versions text; BEGIN
 IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
  EXECUTE 'SELECT string_agg(version::text,'','' ORDER BY version) FROM supabase_migrations.schema_migrations' INTO versions;
  RAISE NOTICE 'Migration history: %',coalesce(versions,'<empty>');
 ELSE RAISE NOTICE 'Migration history unavailable; no old migration replayed'; END IF;
END $history$;


-- Only if the first result confirms this relation exists, run SEPARATELY:
-- SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
-- SQL Editor execution is not evidence that CLI migration history was recorded.
-- Do not manually alter history or re-run an already applied migration blindly.


-- All checks below precede ACL/RLS changes. No historical migration is replayed.
DO $guard$
DECLARE r record; expected record; history text; t text;
BEGIN
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
  -- Exact current repository body fingerprints, not a name-only allowlist.
  -- Exact UTF-8 body bytes, including whitespace in literals and comments.
  FOR r IN SELECT p.*,n.nspname,l.lanname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_language l ON l.oid=p.prolang WHERE (p.prosecdef AND n.nspname NOT IN ('pg_catalog','information_schema')
    AND (n.nspname='public' OR (has_schema_privilege('anon',n.oid,'USAGE') AND has_function_privilege('anon',p.oid,'EXECUTE'))
      OR (has_schema_privilege('authenticated',n.oid,'USAGE') AND has_function_privilege('authenticated',p.oid,'EXECUTE'))))
    OR p.oid IN (SELECT to_regprocedure(signature)::oid FROM (VALUES
('public.nrs_admin_payment_summary(uuid)','a8a0fb47cb13dc18e7448ce511d89e87d1f175ab81db760b4533878606c00d67','plpgsql'),
('public.nrs_admin_update_order_status(uuid,text)','fa5a7e69a3c5860d76298d71a22cff5ff870dff98029354ca25284539e4b4131','plpgsql'),
('public.nrs_admin_user_summary(uuid)','1ccc32a083b238f9dc836113de6e3f23360f26f4238babbb5a9437ada41c99ed','plpgsql'),
('public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)','c01f16f3c1b64e49ee92821e9369cfd332d87b3cac8e6f176aca02263ae40ef3','plpgsql'),
('public.nrs_finalize_payment(jsonb,text)','92480c6bfb0cf214f00418c791307d70dc6f76de53d2192f862db995746313a7','plpgsql'),
('public.nrs_is_active_admin()','b13925b08fe9c02ca430c6f941888aa9aee3f97466a2a37bb5a28140ded5ba80','sql'),
('public.nrs_read_payment_order(uuid,uuid,text)','f0e801d74fbabac50dacaac901d980ec8d3f5e859cef84bb53442fd25c177dc8','sql'),
('public.nrs_store_payment_redirect(uuid,text)','f724dc0fc8dbf8d63d2fb91a0fcb8d74d8977e04bac20d21a48508acb29ea2ca','plpgsql')
      ) known(signature,body_hash,language)) LOOP
    SELECT * INTO expected FROM (VALUES
('public.nrs_admin_payment_summary(uuid)','a8a0fb47cb13dc18e7448ce511d89e87d1f175ab81db760b4533878606c00d67','plpgsql'),
('public.nrs_admin_update_order_status(uuid,text)','fa5a7e69a3c5860d76298d71a22cff5ff870dff98029354ca25284539e4b4131','plpgsql'),
('public.nrs_admin_user_summary(uuid)','1ccc32a083b238f9dc836113de6e3f23360f26f4238babbb5a9437ada41c99ed','plpgsql'),
('public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)','c01f16f3c1b64e49ee92821e9369cfd332d87b3cac8e6f176aca02263ae40ef3','plpgsql'),
('public.nrs_finalize_payment(jsonb,text)','92480c6bfb0cf214f00418c791307d70dc6f76de53d2192f862db995746313a7','plpgsql'),
('public.nrs_is_active_admin()','b13925b08fe9c02ca430c6f941888aa9aee3f97466a2a37bb5a28140ded5ba80','sql'),
('public.nrs_read_payment_order(uuid,uuid,text)','f0e801d74fbabac50dacaac901d980ec8d3f5e859cef84bb53442fd25c177dc8','sql'),
('public.nrs_store_payment_redirect(uuid,text)','f724dc0fc8dbf8d63d2fb91a0fcb8d74d8977e04bac20d21a48508acb29ea2ca','plpgsql')
    ) known(signature,body_hash,language) WHERE to_regprocedure(signature)=r.oid;
    IF NOT FOUND OR expected.body_hash IS DISTINCT FROM
      encode(sha256(convert_to(r.prosrc,'UTF8')),'hex')
      OR r.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
      OR r.lanname IS DISTINCT FROM expected.language OR r.prokind<>'f' OR NOT r.prosecdef
      OR pg_get_userbyid(r.proowner) IN ('anon','authenticated','service_role') THEN
      RAISE EXCEPTION 'STOP: unknown/changed SECURITY DEFINER %.%; preserve function and review',r.nspname,r.proname;
    END IF;
    IF r.proname IN ('nrs_create_payment_order','nrs_store_payment_redirect','nrs_finalize_payment','nrs_read_payment_order') THEN
      IF has_function_privilege('anon',r.oid,'EXECUTE') OR has_function_privilege('authenticated',r.oid,'EXECUTE')
        OR NOT has_function_privilege('service_role',r.oid,'EXECUTE') THEN
        RAISE EXCEPTION 'STOP: unexpected service-only payment RPC permissions on %',r.proname;
      END IF;
    ELSIF has_function_privilege('anon',r.oid,'EXECUTE') OR NOT has_function_privilege('authenticated',r.oid,'EXECUTE') THEN
      RAISE EXCEPTION 'STOP: unexpected admin RPC permissions on %',r.proname;
    END IF;
  END LOOP;
  -- Partial payment schema/history is not repaired by this ACL-only operation.
  IF to_regclass('public.payment_orders') IS NOT NULL THEN
    FOREACH t IN ARRAY ARRAY['nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)',
      'nrs_store_payment_redirect(uuid,text)','nrs_finalize_payment(jsonb,text)','nrs_read_payment_order(uuid,uuid,text)',
      'nrs_admin_update_order_status(uuid,text)'] LOOP
      IF to_regprocedure('public.'||t) IS NULL THEN RAISE EXCEPTION 'STOP: partial payment schema missing %',t; END IF;
    END LOOP;
  END IF;
  FOR r IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('orders','order_items','profiles','wishlist') LOOP
    IF NOT EXISTS (SELECT FROM (VALUES
('order_items','nrs_active_admin_order_item_read'),
('order_items','nrs_admin_panel_order_items_read'),
('order_items','nrs_customer_order_item_read'),
('order_items','order_items_access_policy'),
('order_items','order_items_policy'),
('orders','nrs_active_admin_order_read'),
('orders','nrs_admin_panel_orders_read'),
('orders','nrs_customer_order_read'),
('orders','orders_access_policy'),
('orders','orders_insert_policy'),
('profiles','nrs_active_admin_profile_read'),
('profiles','nrs_admin_panel_profiles_read'),
('profiles','nrs_customer_profile_insert'),
('profiles','nrs_customer_profile_read'),
('profiles','nrs_customer_profile_update'),
('wishlist','nrs_active_admin_wishlist_read'),
('wishlist','nrs_admin_panel_wishlist_read'),
('wishlist','nrs_customer_wishlist_delete'),
('wishlist','nrs_customer_wishlist_insert'),
('wishlist','nrs_customer_wishlist_read')
      ) known(table_name,policy_name) WHERE known.table_name=r.tablename AND known.policy_name=r.policyname) THEN
      RAISE EXCEPTION 'STOP: unreviewed policy %.%; preserve and review',r.tablename,r.policyname;
    END IF;
  END LOOP;
END $guard$;

DO $$
DECLARE r record; t text; cols text;
BEGIN
  IF NOT EXISTS (SELECT FROM pg_proc WHERE oid=to_regprocedure('public.nrs_is_active_admin()')
    AND prosecdef AND prorettype='boolean'::regtype) THEN
    RAISE EXCEPTION 'Review existing active-admin predicate first';
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
