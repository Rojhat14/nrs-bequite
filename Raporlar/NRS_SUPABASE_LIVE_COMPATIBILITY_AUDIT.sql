-- NRS LIVE COMPATIBILITY AUDIT ONLY. No production execution by Codex.
-- Separate from NRS_SUPABASE_SECURITY_APPLY.sql; never concatenate with it.
-- Only PostgreSQL catalog metadata is read. No customer rows, counts or samples.
-- Run this whole file once in a project verified by its Dashboard project ref.
-- Missing objects are reported as STOP/REVIEW; never repaired or migrated.
-- Save ALL result sets privately. PASS rows are local checks, not live readiness.
-- Unknown constraint/default/trigger semantics always need administrator review.
-- ROLLBACK also on errors; do not continue fragments or invoke audited RPCs.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '5s';

-- A00: Context; database name alone does not identify a Supabase project.
SELECT 'A00_CONTEXT' AS audit_section, current_database() AS database_name,
       current_user AS execution_role, current_setting('server_version') AS server_version,
       current_setting('transaction_read_only') AS transaction_read_only,
       current_setting('transaction_isolation') AS transaction_isolation,
       'METADATA_ONLY; NO CUSTOMER ROW VERIFICATION; NOT READY' AS decision;

-- A01: Exact four legacy names. Absence is explicit, not a guessed definition.
WITH expected(table_name,policy_name) AS (VALUES
 ('orders','orders_insert_policy'),('orders','orders_access_policy'),
 ('order_items','order_items_access_policy'),('order_items','order_items_policy'))
SELECT 'A01_LEGACY_POLICIES' AS audit_section, e.table_name,e.policy_name,
 p.schemaname,p.permissive,p.roles,p.cmd,p.qual AS using_expression,p.with_check AS with_check_expression,
 CASE WHEN p.policyname IS NULL THEN 'ABSENT_REVIEW' ELSE 'PRESENT_REVIEW_DEFINITION' END AS status,
 CASE WHEN p.policyname IS NULL THEN NULL ELSE encode(sha256(convert_to(
 jsonb_build_object('table',p.tablename,'name',p.policyname,'permissive',p.permissive,
 'roles',p.roles,'command',p.cmd,'using',p.qual,'with_check',p.with_check)::text,'UTF8')),'hex') END AS definition_fingerprint
FROM expected e LEFT JOIN pg_policies p ON p.schemaname='public'
 AND p.tablename=e.table_name AND p.policyname=e.policy_name ORDER BY e.table_name,e.policy_name;

-- A02: All policies on the four replaced tables, including unknown names.
SELECT 'A02_ALL_REPLACED_POLICIES' AS audit_section,schemaname,tablename,policyname,
 permissive,roles,cmd,qual AS using_expression,with_check AS with_check_expression
FROM pg_policies WHERE schemaname='public' AND tablename IN ('orders','order_items','profiles','wishlist')
ORDER BY tablename,policyname;

-- A03: Presence, kind, owner and RLS; auxiliary RPC dependencies are included.
WITH expected(table_name) AS (VALUES ('orders'),
('order_items'),
('payment_orders'),
('payment_stock_reservations'),
('payment_events'),
('order_legal_records'),
('profiles'),
('wishlist'),
('admin_users'),
('products'),
('product_variants'))
SELECT 'A03_TABLES' AS audit_section,e.table_name,c.oid AS table_oid,c.relkind,
 pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity AS rls_enabled,c.relforcerowsecurity AS force_rls,
 CASE WHEN c.oid IS NULL THEN 'STOP_MISSING_TABLE'
 WHEN c.relkind NOT IN ('r','p') THEN 'STOP_NOT_TABLE'
 WHEN pg_get_userbyid(c.relowner) IN ('anon','authenticated','service_role') THEN 'STOP_UNEXPECTED_OWNER'
 ELSE 'PRESENT_REVIEW_RLS_OWNER' END AS status
FROM expected e LEFT JOIN pg_class c ON c.oid=to_regclass('public.'||e.table_name) ORDER BY e.table_name;

-- A04: All physical columns; catalog query is independent of information_schema visibility.
WITH expected(table_name) AS (VALUES ('orders'),
('order_items'),
('payment_orders'),
('payment_stock_reservations'),
('payment_events'),
('order_legal_records'),
('profiles'),
('wishlist'),
('admin_users'),
('products'),
('product_variants'))
SELECT 'A04_COLUMNS' AS audit_section,e.table_name,a.attnum AS ordinal_position,a.attname AS column_name,
 format_type(a.atttypid,a.atttypmod) AS formatted_type,n.nspname AS type_schema,t.typname AS underlying_type,
 t.typtype AS type_kind,a.attnotnull AS not_null,NOT a.attnotnull AS nullable,
 pg_get_expr(d.adbin,d.adrelid) AS column_default,
 CASE a.attidentity WHEN 'a' THEN 'ALWAYS' WHEN 'd' THEN 'BY DEFAULT' ELSE 'NO' END AS identity,
 CASE a.attgenerated WHEN 's' THEN 'STORED' WHEN 'v' THEN 'VIRTUAL' ELSE 'NO' END AS generated
FROM expected e JOIN pg_attribute a ON a.attrelid=to_regclass('public.'||e.table_name)
 AND a.attnum>0 AND NOT a.attisdropped JOIN pg_type t ON t.oid=a.atttypid
JOIN pg_namespace n ON n.oid=t.typnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
ORDER BY e.table_name,a.attnum;

-- A05: Current repository RPC/customer fields. Exact base types are expected;
-- varchar/enum/domain differences require review, not coercion or alteration.
WITH expected(table_name,column_name,type_name,require_not_null) AS (VALUES ('orders','id','uuid',true),
('orders','user_id','uuid',true),
('orders','total_amount','numeric',true),
('orders','status','text',false),
('orders','customer_name','text',false),
('orders','customer_email','text',false),
('orders','customer_phone','text',false),
('orders','shipping_address','text',false),
('orders','shipping_city','text',false),
('orders','shipping_district','text',false),
('orders','shipping_postal_code','text',false),
('order_items','order_id','uuid',true),
('order_items','product_id','text',true),
('order_items','quantity','int4',true),
('order_items','price_at_purchase','numeric',true),
('payment_orders','order_id','uuid',true),
('payment_orders','user_id','uuid',false),
('payment_orders','guest_hash','text',false),
('payment_orders','guest_expires_at','timestamptz',false),
('payment_orders','idempotency_key','uuid',true),
('payment_orders','request_hash','text',true),
('payment_orders','provider','text',true),
('payment_orders','merchant_reference','uuid',true),
('payment_orders','amount_minor','int8',true),
('payment_orders','currency','text',true),
('payment_orders','state','text',true),
('payment_orders','transaction_id','text',false),
('payment_orders','redirect_url','text',false),
('payment_orders','created_at','timestamptz',true),
('payment_orders','updated_at','timestamptz',true),
('payment_stock_reservations','order_id','uuid',true),
('payment_stock_reservations','variant_id','uuid',true),
('payment_stock_reservations','quantity','int4',true),
('payment_stock_reservations','released','bool',true),
('payment_events','provider','text',true),
('payment_events','event_id','text',true),
('payment_events','order_id','uuid',true),
('payment_events','transaction_id','text',true),
('payment_events','amount_minor','int8',true),
('payment_events','currency','text',true),
('payment_events','state','text',true),
('payment_events','three_ds','text',true),
('payment_events','created_at','timestamptz',true),
('payment_events','merchant_id','text',false),
('order_legal_records','order_id','uuid',true),
('order_legal_records','contract_accepted','bool',true),
('order_legal_records','contract_version','text',true),
('order_legal_records','pre_information_version','text',true),
('order_legal_records','accepted_at','timestamptz',true),
('order_legal_records','document_hash','text',true),
('order_legal_records','summary_hash','text',true),
('order_legal_records','order_summary','jsonb',true),
('products','id','text',true),
('products','name','text',false),
('products','description','text',false),
('products','price_amount','numeric',false),
('products','compare_at_price','numeric',false),
('products','currency','text',false),
('products','status','text',false),
('product_variants','id','uuid',true),
('product_variants','product_id','text',false),
('product_variants','size','text',false),
('product_variants','stock_quantity','int4',false),
('product_variants','is_active','bool',false),
('admin_users','user_id','uuid',true),
('admin_users','role','text',false),
('admin_users','is_active','bool',false),
('profiles','id','uuid',true),
('profiles','first_name','text',false),
('profiles','last_name','text',false),
('profiles','phone','text',false),
('profiles','email','text',false),
('wishlist','user_id','uuid',true),
('wishlist','product_id','text',true))
SELECT 'A05_REQUIRED_COLUMNS' AS audit_section,e.*,a.attname AS actual_column,t.typname AS actual_type,
 n.nspname AS type_schema,t.typtype AS type_kind,a.attnotnull AS actual_not_null,
 CASE WHEN a.attname IS NULL THEN 'STOP_MISSING_COLUMN'
 WHEN n.nspname<>'pg_catalog' OR t.typname<>e.type_name OR t.typtype<>'b' THEN 'STOP_TYPE_REVIEW'
 WHEN e.require_not_null AND NOT a.attnotnull THEN 'STOP_NOT_NULL_REQUIRED'
 ELSE 'PASS_COLUMN_METADATA' END AS status
FROM expected e LEFT JOIN pg_attribute a ON a.attrelid=to_regclass('public.'||e.table_name)
 AND a.attname=e.column_name AND a.attnum>0 AND NOT a.attisdropped
LEFT JOIN pg_type t ON t.oid=a.atttypid LEFT JOIN pg_namespace n ON n.oid=t.typnamespace
ORDER BY e.table_name,e.column_name;

-- A06: Additional required columns/defaults and generated columns can break inserts.
-- Defaults are displayed but NEVER evaluated; functions behind them require review.
WITH supplied(table_name,column_name) AS (VALUES ('orders','id'),
('orders','user_id'),
('orders','total_amount'),
('orders','status'),
('orders','customer_name'),
('orders','customer_email'),
('orders','customer_phone'),
('orders','shipping_address'),
('orders','shipping_city'),
('orders','shipping_district'),
('orders','shipping_postal_code'),
('order_items','order_id'),
('order_items','product_id'),
('order_items','quantity'),
('order_items','price_at_purchase'),
('payment_orders','order_id'),
('payment_orders','user_id'),
('payment_orders','guest_hash'),
('payment_orders','guest_expires_at'),
('payment_orders','idempotency_key'),
('payment_orders','request_hash'),
('payment_orders','provider'),
('payment_orders','merchant_reference'),
('payment_orders','amount_minor'),
('payment_orders','currency'),
('order_legal_records','order_id'),
('order_legal_records','contract_accepted'),
('order_legal_records','contract_version'),
('order_legal_records','pre_information_version'),
('order_legal_records','accepted_at'),
('order_legal_records','document_hash'),
('order_legal_records','summary_hash'),
('order_legal_records','order_summary'),
('payment_stock_reservations','order_id'),
('payment_stock_reservations','variant_id'),
('payment_stock_reservations','quantity'),
('payment_events','provider'),
('payment_events','event_id'),
('payment_events','order_id'),
('payment_events','transaction_id'),
('payment_events','amount_minor'),
('payment_events','currency'),
('payment_events','state'),
('payment_events','three_ds'),
('payment_events','merchant_id'),
('profiles','id'),
('profiles','first_name'),
('profiles','last_name'),
('profiles','phone'),
('profiles','email'),
('wishlist','user_id'),
('wishlist','product_id')),
 expected(table_name) AS (VALUES ('orders'),
('order_items'),
('payment_orders'),
('order_legal_records'),
('payment_stock_reservations'),
('payment_events'),
('profiles'),
('wishlist'))
SELECT 'A06_INSERT_COMPATIBILITY' AS audit_section,e.table_name,a.attname AS column_name,
 EXISTS(SELECT FROM supplied s WHERE s.table_name=e.table_name AND s.column_name=a.attname) AS supplied_by_current_flow,
 pg_get_expr(d.adbin,d.adrelid) AS default_expression,a.attidentity,a.attgenerated,
 CASE WHEN EXISTS(SELECT FROM supplied s WHERE s.table_name=e.table_name AND s.column_name=a.attname)
 AND (a.attgenerated<>'' OR a.attidentity='a') THEN 'STOP_SUPPLIED_GENERATED_OR_IDENTITY_ALWAYS'
 WHEN NOT EXISTS(SELECT FROM supplied s WHERE s.table_name=e.table_name AND s.column_name=a.attname)
 AND a.attnotnull AND d.oid IS NULL AND a.attidentity='' AND a.attgenerated='' THEN 'STOP_UNSUPPLIED_REQUIRED_COLUMN'
 WHEN d.oid IS NOT NULL THEN 'REVIEW_DEFAULT_EXPRESSION' ELSE 'PASS_INSERT_SHAPE' END AS status
FROM expected e JOIN pg_attribute a ON a.attrelid=to_regclass('public.'||e.table_name)
 AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
ORDER BY e.table_name,a.attnum;

-- A07: Every constraint; no CHECK expression is executed against customer rows.
WITH expected(table_name) AS (VALUES ('orders'),
('order_items'),
('payment_orders'),
('payment_stock_reservations'),
('payment_events'),
('order_legal_records'))
SELECT 'A07_CONSTRAINTS' AS audit_section,e.table_name,k.conname,k.contype,k.convalidated,k.condeferrable,k.condeferred,
 k.confrelid::regclass::text AS referenced_table,k.confupdtype,k.confdeltype,
 pg_get_constraintdef(k.oid,true) AS definition,
 CASE WHEN NOT k.convalidated THEN 'STOP_UNVALIDATED_CONSTRAINT'
 WHEN k.contype='c' THEN 'REVIEW_CHECK_SEMANTICS_WITHOUT_ROW_EVALUATION' ELSE 'REVIEW_DEFINITION' END AS status
FROM expected e JOIN pg_constraint k ON k.conrelid=to_regclass('public.'||e.table_name)
ORDER BY e.table_name,k.conname;

-- A08: Named-independent key/FK checks; action/deferral still need A07 review.
WITH expected(table_name,kind,column_names,reference_table,reference_columns) AS (VALUES ('orders','p','id',NULL,NULL),
('profiles','p','id',NULL,NULL),
('payment_orders','p','order_id',NULL,NULL),
('payment_orders','u','idempotency_key',NULL,NULL),
('payment_orders','u','merchant_reference',NULL,NULL),
('payment_stock_reservations','p','order_id,variant_id',NULL,NULL),
('payment_events','p','provider,event_id',NULL,NULL),
('order_legal_records','p','order_id',NULL,NULL),
('orders','f','user_id','auth.users','id'),
('order_items','f','order_id','public.orders','id'),
('payment_orders','f','order_id','public.orders','id'),
('payment_orders','f','user_id','auth.users','id'),
('payment_stock_reservations','f','order_id','public.payment_orders','order_id'),
('payment_stock_reservations','f','variant_id','public.product_variants','id'),
('payment_events','f','order_id','public.payment_orders','order_id'),
('order_legal_records','f','order_id','public.orders','id')),
 actual AS (SELECT k.*,
 (SELECT string_agg(a.attname,',' ORDER BY x.ordinality) FROM unnest(k.conkey) WITH ORDINALITY x(num,ordinality)
 JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=x.num) AS column_names,
 (SELECT string_agg(a.attname,',' ORDER BY x.ordinality) FROM unnest(k.confkey) WITH ORDINALITY x(num,ordinality)
 JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=x.num) AS reference_columns FROM pg_constraint k)
SELECT 'A08_REQUIRED_KEYS' AS audit_section,e.*,a.conname,a.convalidated,
 CASE WHEN a.oid IS NULL THEN 'STOP_MISSING_KEY_OR_FK'
 WHEN NOT a.convalidated THEN 'STOP_UNVALIDATED_KEY_OR_FK' ELSE 'PASS_KEY_SHAPE_REVIEW_ACTIONS' END AS status
FROM expected e LEFT JOIN actual a ON a.conrelid=to_regclass('public.'||e.table_name)
 AND a.contype::text=e.kind AND a.column_names=e.column_names
 AND (e.kind<>'f' OR (a.confrelid=to_regclass(e.reference_table) AND a.reference_columns=e.reference_columns))
ORDER BY e.table_name,e.kind,e.column_names;

-- A09: Full index definitions, including partial predicates and validity.
WITH expected(table_name) AS (VALUES ('orders'),
('order_items'),
('payment_orders'),
('payment_stock_reservations'),
('payment_events'),
('order_legal_records'))
SELECT 'A09_INDEXES' AS audit_section,e.table_name,i.indexrelid::regclass::text AS index_name,
 i.indisprimary,i.indisunique,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid) AS definition,
 pg_get_expr(i.indpred,i.indrelid) AS predicate,
 CASE WHEN NOT i.indisvalid OR NOT i.indisready THEN 'STOP_INVALID_INDEX' ELSE 'REVIEW_INDEX_DEFINITION' END AS status
FROM expected e JOIN pg_index i ON i.indrelid=to_regclass('public.'||e.table_name)
ORDER BY e.table_name,index_name;

-- A10: Required provider/transaction replay index (predicate semantics are manual).
SELECT 'A10_TRANSACTION_UNIQUENESS' AS audit_section,
 CASE WHEN EXISTS(SELECT FROM pg_index i WHERE i.indrelid=to_regclass('public.payment_orders')
 AND i.indisunique AND i.indisvalid AND i.indisready AND i.indpred IS NOT NULL
 AND (SELECT string_agg(a.attname,',' ORDER BY x.ordinality) FROM unnest(i.indkey) WITH ORDINALITY x(num,ordinality)
 JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=x.num WHERE x.ordinality<=i.indnkeyatts)='provider,transaction_id')
 THEN 'PRESENT_REVIEW_PARTIAL_PREDICATE' ELSE 'STOP_MISSING_TRANSACTION_UNIQUENESS' END AS status;

-- A11: User and internal triggers, enablement and trigger function security.
WITH expected(table_name) AS (VALUES ('orders'),
('order_items'),
('payment_orders'),
('payment_stock_reservations'),
('payment_events'),
('order_legal_records'))
SELECT 'A11_TRIGGERS' AS audit_section,e.table_name,t.tgname,t.tgisinternal,t.tgenabled,
 pg_get_triggerdef(t.oid,true) AS definition,p.oid::regprocedure::text AS function_signature,
 p.prosecdef,pg_get_userbyid(p.proowner) AS function_owner,p.proconfig,
 encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') AS trigger_body_hash,
 'REVIEW_TRIGGER_EFFECTS_NO_EXECUTION' AS status
FROM expected e JOIN pg_trigger t ON t.tgrelid=to_regclass('public.'||e.table_name)
JOIN pg_proc p ON p.oid=t.tgfoid ORDER BY e.table_name,t.tgname;

-- Presence alone cannot prove an immutable trigger body; A11 requires review.
SELECT 'A12_LEGAL_IMMUTABILITY' AS audit_section,
 CASE WHEN EXISTS(SELECT FROM pg_trigger t WHERE t.tgrelid=to_regclass('public.order_legal_records')
 AND t.tgname='nrs_order_legal_records_immutable' AND NOT t.tgisinternal AND t.tgenabled IN ('O','A')
 -- Exact ROW + BEFORE + DELETE + UPDATE, without extra events, UPDATE OF or WHEN.
 AND t.tgtype::integer=27 AND cardinality(t.tgattr::smallint[])=0 AND t.tgqual IS NULL
 AND t.tgfoid=to_regprocedure('public.nrs_prevent_legal_record_update()'))
 THEN 'PRESENT_REVIEW_FUNCTION_AND_TRIGGER' ELSE 'STOP_MISSING_OR_DISABLED_IMMUTABILITY_TRIGGER' END AS status;

-- A13: Exact eight repository signatures and UTF-8 body fingerprints.
-- This SELECT never invokes any RPC. Missing roles produce NULL permission fields.
WITH expected(signature,expected_hash,expected_language,expected_result_type,expected_set,service_only) AS (VALUES ('public.nrs_admin_payment_summary(uuid)','a8a0fb47cb13dc18e7448ce511d89e87d1f175ab81db760b4533878606c00d67','plpgsql','jsonb',false,false),
('public.nrs_admin_update_order_status(uuid,text)','fa5a7e69a3c5860d76298d71a22cff5ff870dff98029354ca25284539e4b4131','plpgsql','void',false,false),
('public.nrs_admin_user_summary(uuid)','1ccc32a083b238f9dc836113de6e3f23360f26f4238babbb5a9437ada41c99ed','plpgsql','record',true,false),
('public.nrs_create_payment_order(uuid,uuid,text,uuid,text,jsonb,jsonb,jsonb,text)','fa25aa6573d64acf295c600c711fb2f504c64765d40e8d1558d7585a91995359','plpgsql','jsonb',false,true),
('public.nrs_finalize_payment(jsonb,text)','92480c6bfb0cf214f00418c791307d70dc6f76de53d2192f862db995746313a7','plpgsql','void',false,true),
('public.nrs_is_active_admin()','b13925b08fe9c02ca430c6f941888aa9aee3f97466a2a37bb5a28140ded5ba80','sql','bool',false,false),
('public.nrs_read_payment_order(uuid,uuid,text)','f0e801d74fbabac50dacaac901d980ec8d3f5e859cef84bb53442fd25c177dc8','sql','jsonb',false,true),
('public.nrs_store_payment_redirect(uuid,text)','f724dc0fc8dbf8d63d2fb91a0fcb8d74d8977e04bac20d21a48508acb29ea2ca','plpgsql','void',false,true)),
 roles AS (SELECT (SELECT oid FROM pg_roles WHERE rolname='anon') AS anon_oid,
 (SELECT oid FROM pg_roles WHERE rolname='authenticated') AS auth_oid,
 (SELECT oid FROM pg_roles WHERE rolname='service_role') AS service_oid)
SELECT 'A13_EXPECTED_RPC' AS audit_section,e.*,p.oid::regprocedure::text AS actual_signature,
 pg_get_function_arguments(p.oid) AS full_arguments,pg_get_function_result(p.oid) AS result,
 p.prokind,p.prosecdef,pg_get_userbyid(p.proowner) AS owner,l.lanname AS language,p.proconfig,
 (SELECT value FROM unnest(p.proconfig) value WHERE value LIKE 'search_path=%') AS search_path,
 encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') AS actual_body_hash,
 CASE WHEN r.anon_oid IS NOT NULL AND p.oid IS NOT NULL THEN has_function_privilege(r.anon_oid,p.oid,'EXECUTE') END AS anon_execute,
 CASE WHEN r.auth_oid IS NOT NULL AND p.oid IS NOT NULL THEN has_function_privilege(r.auth_oid,p.oid,'EXECUTE') END AS authenticated_execute,
 CASE WHEN r.service_oid IS NOT NULL AND p.oid IS NOT NULL THEN has_function_privilege(r.service_oid,p.oid,'EXECUTE') END AS service_execute,
 p.proacl AS raw_acl,
 CASE WHEN p.oid IS NULL THEN 'STOP_MISSING_RPC'
 WHEN r.anon_oid IS NULL OR r.auth_oid IS NULL OR r.service_oid IS NULL THEN 'STOP_MISSING_ROLE'
 WHEN p.prokind<>'f' OR NOT p.prosecdef OR l.lanname<>e.expected_language
 OR p.prorettype<>to_regtype(e.expected_result_type) OR p.proretset<>e.expected_set
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
 OR encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>e.expected_hash
 OR pg_get_userbyid(p.proowner) IN ('anon','authenticated','service_role') THEN 'STOP_RPC_DEFINITION_DRIFT'
 WHEN has_function_privilege(r.anon_oid,p.oid,'EXECUTE')
 OR (e.service_only AND (has_function_privilege(r.auth_oid,p.oid,'EXECUTE') OR NOT has_function_privilege(r.service_oid,p.oid,'EXECUTE')))
 OR (NOT e.service_only AND NOT has_function_privilege(r.auth_oid,p.oid,'EXECUTE')) THEN 'STOP_RPC_EXECUTE_DRIFT'
 ELSE 'PASS_RPC_METADATA_REVIEW_OWNER_DEPENDENCIES' END AS status
FROM expected e LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature)
LEFT JOIN pg_language l ON l.oid=p.prolang CROSS JOIN roles r ORDER BY e.signature;

-- A14: Public overloads and nonpublic browser-accessible definers cannot be hidden by A13.
SELECT 'A14_RPC_SURFACE' AS audit_section,n.nspname,p.oid::regprocedure::text AS signature,
 pg_get_function_arguments(p.oid) AS full_arguments,pg_get_function_result(p.oid) AS result,
 p.prokind,p.prosecdef,pg_get_userbyid(p.proowner) AS owner,p.proconfig,p.proacl,
 r.rolname AS browser_role,has_schema_privilege(r.oid,n.oid,'USAGE') AS schema_usage,
 has_function_privilege(r.oid,p.oid,'EXECUTE') AS execute,
 'REVIEW_UNEXPECTED_RPC_OVERLOAD_OR_DEFINER' AS status
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
LEFT JOIN pg_roles r ON r.rolname IN ('anon','authenticated')
WHERE n.nspname='public' OR (p.prosecdef AND n.nspname NOT IN ('pg_catalog','information_schema')
 AND has_schema_privilege(r.oid,n.oid,'USAGE') AND has_function_privilege(r.oid,p.oid,'EXECUTE'))
ORDER BY n.nspname,signature,r.rolname;

-- A15: Role existence/capabilities, memberships and public schema permissions.
WITH expected(role_name) AS (VALUES ('anon'),('authenticated'),('service_role'))
SELECT 'A15_ROLES' AS audit_section,e.role_name,r.oid,r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,
 CASE WHEN r.oid IS NOT NULL THEN has_schema_privilege(r.oid,(SELECT oid FROM pg_namespace WHERE nspname='public'),'USAGE') END AS public_usage,
 CASE WHEN r.oid IS NOT NULL THEN has_schema_privilege(r.oid,(SELECT oid FROM pg_namespace WHERE nspname='public'),'CREATE') END AS public_create,
 CASE WHEN r.oid IS NULL THEN 'STOP_MISSING_ROLE'
 WHEN e.role_name='service_role' AND NOT r.rolbypassrls THEN 'STOP_SERVICE_NOT_BYPASSRLS'
 WHEN e.role_name<>'service_role' AND (r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication)
 THEN 'STOP_BROWSER_ROLE_CAPABILITY' ELSE 'REVIEW_ROLE_AND_MEMBERSHIP' END AS status
FROM expected e LEFT JOIN pg_roles r ON r.rolname=e.role_name ORDER BY e.role_name;
SELECT 'A16_ROLE_MEMBERSHIPS' AS audit_section,member.rolname AS member,parent.rolname AS parent,m.admin_option
FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member JOIN pg_roles parent ON parent.oid=m.roleid
WHERE member.rolname IN ('anon','authenticated','service_role') ORDER BY member.rolname,parent.rolname;

-- A17/A18: Effective and explicit ACL baseline. Save for later authorized comparison.
WITH expected(table_name) AS (VALUES ('orders'),
('order_items'),
('payment_orders'),
('payment_stock_reservations'),
('payment_events'),
('order_legal_records'),
('profiles'),
('wishlist'),
('admin_users')), roles(role_name) AS (VALUES ('anon'),('authenticated'),('service_role'))
SELECT 'A17_EFFECTIVE_TABLE_ACL' AS audit_section,e.table_name,r.role_name,v.privilege,
 CASE WHEN c.oid IS NOT NULL AND pr.oid IS NOT NULL THEN has_table_privilege(pr.oid,c.oid,v.privilege) END AS effective,
 c.relacl AS raw_acl
FROM expected e CROSS JOIN roles r CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) v(privilege)
LEFT JOIN pg_class c ON c.oid=to_regclass('public.'||e.table_name) LEFT JOIN pg_roles pr ON pr.rolname=r.role_name
ORDER BY e.table_name,r.role_name,v.privilege;
WITH expected(table_name) AS (VALUES ('orders'),
('order_items'),
('payment_orders'),
('payment_stock_reservations'),
('payment_events'),
('order_legal_records'),
('profiles'),
('wishlist'),
('admin_users'))
SELECT 'A18_EXPLICIT_TABLE_ACL' AS audit_section,e.table_name,
 CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
 pg_get_userbyid(a.grantor) AS grantor,a.privilege_type,a.is_grantable
FROM expected e JOIN pg_class c ON c.oid=to_regclass('public.'||e.table_name)
CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
ORDER BY e.table_name,grantee,a.privilege_type;
WITH expected(table_name) AS (VALUES ('orders'),
('order_items'),
('payment_orders'),
('payment_stock_reservations'),
('payment_events'),
('order_legal_records'),
('profiles'),
('wishlist'),
('admin_users'))
SELECT 'A19_COLUMN_ACL' AS audit_section,e.table_name,col.attname AS column_name,r.rolname,v.privilege,
 has_column_privilege(r.oid,c.oid,col.attnum,v.privilege) AS effective,col.attacl AS raw_column_acl
FROM expected e JOIN pg_class c ON c.oid=to_regclass('public.'||e.table_name)
JOIN pg_attribute col ON col.attrelid=c.oid AND col.attnum>0 AND NOT col.attisdropped
CROSS JOIN pg_roles r CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('REFERENCES')) v(privilege)
WHERE r.rolname IN ('anon','authenticated','service_role') ORDER BY e.table_name,col.attnum,r.rolname,v.privilege;

-- A20: Removing PUBLIC grants must not remove service_role's effective capability.
WITH touched(table_name) AS (VALUES ('orders'),('order_items'),('profiles'),('wishlist'))
SELECT 'A20_PUBLIC_SERVICE_DEPENDENCY' AS audit_section,t.table_name,a.privilege_type,
 CASE WHEN s.oid IS NULL THEN 'STOP_MISSING_SERVICE_ROLE'
 WHEN EXISTS(SELECT FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) direct
 WHERE direct.grantee=s.oid AND direct.privilege_type=a.privilege_type)
 THEN 'PASS_DIRECT_SERVICE_GRANT' ELSE 'STOP_SERVICE_MAY_DEPEND_ON_PUBLIC' END AS status
FROM touched t JOIN pg_class c ON c.oid=to_regclass('public.'||t.table_name)
CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a
LEFT JOIN pg_roles s ON s.rolname='service_role' WHERE a.grantee=0
ORDER BY t.table_name,a.privilege_type;
WITH touched(table_name) AS (VALUES ('orders'),('order_items'),('profiles'),('wishlist'))
SELECT 'A21_PUBLIC_COLUMN_SERVICE_DEPENDENCY' AS audit_section,t.table_name,col.attname,a.privilege_type,
 CASE WHEN s.oid IS NULL THEN 'STOP_MISSING_SERVICE_ROLE'
 WHEN EXISTS(SELECT FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) direct
 WHERE direct.grantee=s.oid AND direct.privilege_type=a.privilege_type)
 OR EXISTS(SELECT FROM aclexplode(col.attacl) direct WHERE direct.grantee=s.oid AND direct.privilege_type=a.privilege_type)
 THEN 'PASS_DIRECT_SERVICE_GRANT' ELSE 'STOP_SERVICE_MAY_DEPEND_ON_PUBLIC_COLUMN' END AS status
FROM touched t JOIN pg_class c ON c.oid=to_regclass('public.'||t.table_name)
JOIN pg_attribute col ON col.attrelid=c.oid AND col.attnum>0 AND NOT col.attisdropped
CROSS JOIN LATERAL aclexplode(col.attacl) a LEFT JOIN pg_roles s ON s.rolname='service_role'
WHERE a.grantee=0 ORDER BY t.table_name,col.attnum,a.privilege_type;
SELECT 'A22_SERVICE_ROLE_INHERITANCE' AS audit_section,parent.rolname AS browser_parent,
 CASE WHEN s.oid IS NULL THEN 'STOP_MISSING_SERVICE_ROLE'
 WHEN parent.oid IS NULL THEN 'STOP_MISSING_BROWSER_ROLE'
 WHEN pg_has_role(s.oid,parent.oid,'MEMBER') THEN 'STOP_SERVICE_BROWSER_ROLE_DEPENDENCY'
 ELSE 'PASS_NO_BROWSER_ROLE_DEPENDENCY' END AS status
FROM (VALUES ('anon'),('authenticated')) expected(role_name)
LEFT JOIN pg_roles parent ON parent.rolname=expected.role_name LEFT JOIN pg_roles s ON s.rolname='service_role';

-- A23: Owned serial/identity sequences: metadata and ACL only; never last_value/nextval.
WITH expected(table_name) AS (VALUES ('orders'),
('order_items'),
('payment_orders'),
('payment_stock_reservations'),
('payment_events'),
('order_legal_records'),
('profiles'),
('wishlist'),
('admin_users'))
SELECT 'A23_SEQUENCES' AS audit_section,e.table_name,col.attname AS owned_column,
 seq.oid::regclass::text AS sequence_name,seq.relacl,r.rolname,
 has_sequence_privilege(r.oid,seq.oid,'USAGE') AS usage,
 has_sequence_privilege(r.oid,seq.oid,'SELECT') AS select_permission,
 has_sequence_privilege(r.oid,seq.oid,'UPDATE') AS update_permission,
 CASE WHEN e.table_name='wishlist' AND col.attname='id' AND EXISTS(
 SELECT FROM aclexplode(coalesce(seq.relacl,acldefault('S',seq.relowner))) a WHERE a.grantee=0)
 THEN 'STOP_PUBLIC_WISHLIST_SEQUENCE_GRANT' ELSE 'REVIEW_SEQUENCE_ACL_AND_DEFAULT' END AS status
FROM expected e JOIN pg_class tab ON tab.oid=to_regclass('public.'||e.table_name)
JOIN pg_depend d ON d.refclassid='pg_class'::regclass AND d.refobjid=tab.oid AND d.refobjsubid>0
 AND d.classid='pg_class'::regclass AND d.deptype IN ('a','i')
JOIN pg_class seq ON seq.oid=d.objid AND seq.relkind='S'
JOIN pg_attribute col ON col.attrelid=tab.oid AND col.attnum=d.refobjsubid
CROSS JOIN pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role')
ORDER BY e.table_name,col.attname,r.rolname;

-- A23: An empty sequence inventory must not hide a missing wishlist.id/sequence.
-- UUID defaults require no sequence; serial/identity IDs require their owned sequence.
WITH column_metadata AS (
 SELECT tab.oid AS table_oid,a.attnum,a.attname,a.atttypid,a.attidentity,a.attgenerated,
 d.oid AS default_oid,pg_get_expr(d.adbin,d.adrelid) AS default_expression
 FROM (SELECT to_regclass('public.wishlist') AS oid) tab
 LEFT JOIN pg_attribute a ON a.attrelid=tab.oid AND a.attname='id' AND a.attnum>0 AND NOT a.attisdropped
 LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
), resolved AS (
 SELECT c.*,owned.oid::regclass::text AS sequence_name
 FROM column_metadata c LEFT JOIN LATERAL (
  SELECT seq.oid FROM pg_depend dep JOIN pg_class seq ON seq.oid=dep.objid AND seq.relkind='S'
  WHERE dep.classid='pg_class'::regclass AND dep.refclassid='pg_class'::regclass
   AND dep.refobjid=c.table_oid AND dep.refobjsubid=c.attnum AND dep.deptype IN ('a','i')
  ORDER BY seq.oid LIMIT 1
 ) owned ON true
)
SELECT 'A23_WISHLIST_ID_SEQUENCE' AS audit_section,c.attname AS column_name,
 format_type(c.atttypid,NULL) AS id_type,c.attidentity,c.attgenerated,c.default_expression,c.sequence_name,
 CASE WHEN s.oid IS NOT NULL AND role.oid IS NOT NULL THEN has_sequence_privilege(role.oid,s.oid,'USAGE') END AS authenticated_usage,
 CASE WHEN s.oid IS NOT NULL AND role.oid IS NOT NULL THEN has_sequence_privilege(role.oid,s.oid,'SELECT') END AS authenticated_select,
 CASE WHEN s.oid IS NOT NULL AND role.oid IS NOT NULL THEN has_sequence_privilege(role.oid,s.oid,'UPDATE') END AS authenticated_update,
 CASE WHEN c.table_oid IS NULL THEN 'STOP_MISSING_WISHLIST_TABLE'
 WHEN c.attname IS NULL THEN 'STOP_MISSING_WISHLIST_ID'
 WHEN c.attgenerated<>'' THEN 'REVIEW_GENERATED_WISHLIST_ID'
 WHEN s.oid IS NULL AND EXISTS(SELECT FROM pg_depend dep JOIN pg_class seq ON seq.oid=dep.refobjid AND seq.relkind='S'
   WHERE dep.classid='pg_attrdef'::regclass AND dep.objid=c.default_oid AND dep.refclassid='pg_class'::regclass)
 THEN 'STOP_UNOWNED_WISHLIST_ID_SEQUENCE'
 WHEN s.oid IS NULL AND c.atttypid='uuid'::regtype AND c.default_oid IS NOT NULL
 THEN 'REVIEW_UUID_ID_DEFAULT_NO_SEQUENCE_REQUIRED'
 WHEN s.oid IS NULL THEN 'STOP_MISSING_WISHLIST_ID_SEQUENCE_OR_DEFAULT'
 WHEN c.attidentity='' AND NOT EXISTS(SELECT FROM pg_depend dep
   WHERE dep.classid='pg_attrdef'::regclass AND dep.objid=c.default_oid
   AND dep.refclassid='pg_class'::regclass AND dep.refobjid=s.oid)
 THEN 'STOP_WISHLIST_SEQUENCE_DEFAULT_MISMATCH'
 WHEN role.oid IS NULL THEN 'STOP_MISSING_AUTHENTICATED_ROLE'
 WHEN NOT has_sequence_privilege(role.oid,s.oid,'USAGE') THEN 'STOP_MISSING_AUTHENTICATED_SEQUENCE_USAGE'
 WHEN EXISTS(SELECT FROM aclexplode(coalesce(s.relacl,acldefault('S',s.relowner))) grant_entry WHERE grant_entry.grantee=0)
 THEN 'STOP_PUBLIC_WISHLIST_SEQUENCE_GRANT'
 ELSE 'PASS_WISHLIST_SEQUENCE_METADATA_REVIEW_DEFAULT' END AS status
FROM resolved c LEFT JOIN pg_class s ON s.oid=to_regclass(c.sequence_name)
LEFT JOIN pg_roles role ON role.rolname='authenticated';

-- A24: Mandatory ownership condition, safe even with absent orders/user_id.
SELECT 'A24_OWNERSHIP_NOT_NULL' AS audit_section,
 CASE WHEN EXISTS(SELECT FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid
 WHERE a.attrelid=to_regclass('public.orders') AND a.attname='user_id' AND a.attnum>0
 AND NOT a.attisdropped AND a.attnotnull AND a.atttypid='uuid'::regtype AND t.typtype='b')
 THEN 'PASS_ORDERS_USER_ID_UUID_NOT_NULL' ELSE 'STOP_OWNERSHIP_COLUMN_MISSING_NULLABLE_OR_WRONG_TYPE' END AS status;

-- A25: A read-only metadata audit cannot prove production row equality or migration history.
SELECT 'A25_DECISION_BOUNDARY' AS audit_section,
 'READ_ONLY_METADATA_ONLY; NO CUSTOMER ROWS OR SEQUENCE VALUES READ; NO AUTOMATIC REPAIR' AS preservation_scope,
 'SERVICE_ACL_BASELINE_CAPTURED; REVIEW A17-A23 BEFORE ANY FUTURE AUTHORIZED CHANGE' AS service_role_preservation,
 'NOT_READY: LIVE OUTPUTS AND POLICY/DEFAULT/CHECK/INDEX/TRIGGER/OWNER REVIEW REQUIRED' AS decision;
ROLLBACK;
