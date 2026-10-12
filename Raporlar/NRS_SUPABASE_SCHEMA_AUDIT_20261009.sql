-- ONLY METADATA. No customer/order/product rows are read or written.
-- Run in the SQL Editor of the VERIFIED NRS project before the migration chain
-- and once after its last step. This file does not apply migrations.
-- Save the results privately for schema comparison. Do not share credentials.
BEGIN TRANSACTION READ ONLY;

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
COMMIT;

-- Only if the first result confirms this relation exists, run SEPARATELY:
-- SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
-- SQL Editor execution is not evidence that CLI migration history was recorded.
-- Do not manually alter history or re-run an already applied migration blindly.
