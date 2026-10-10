"""Local source assembly only; no environment files, DB or network access."""
from pathlib import Path
import hashlib
import re

root = Path(__file__).resolve().parents[1]
functions = {}
policies = set()
for path in sorted((root / 'supabase/migrations').glob('*.sql')):
    source = path.read_text(encoding='utf-8')
    for match in re.finditer(r'CREATE(?: OR REPLACE)? FUNCTION public\.(\w+)\((.*?)\)(.*?)AS \$\$(.*?)\$\$;', source, re.S):
        name, args, declaration, body = match.groups()
        if 'SECURITY DEFINER' not in declaration:
            continue
        signature = 'public.' + name + '(' + ','.join(arg.strip().split()[-1] for arg in args.split(',') if arg.strip()) + ')'
        # Hash exact catalog body bytes: collapsing whitespace can change literals
        # or the extent of SQL line comments while retaining the same hash.
        functions[signature] = (hashlib.sha256(body.encode('utf-8')).hexdigest(), 'sql' if re.search(r'LANGUAGE\s+sql\b', declaration, re.I) else 'plpgsql')
    for match in re.finditer(r'CREATE POLICY (\w+)\s+ON public\.(orders|order_items|profiles|wishlist)\b', source):
        policies.add((match[2], match[1]))
policies.update({('orders', 'orders_insert_policy'), ('orders', 'orders_access_policy'),
                 ('order_items', 'order_items_access_policy'), ('order_items', 'order_items_policy')})
manifest = ',\n'.join("('%s','%s','%s')" % (sig, values[0], values[1]) for sig, values in sorted(functions.items()))
policy_manifest = ',\n'.join("('%s','%s')" % value for value in sorted(policies))
audit = (root / 'Raporlar/NRS_SUPABASE_SCHEMA_AUDIT_20261009.sql').read_text(encoding='utf-8')
base = (root / 'supabase/migrations/20261009150000_customer_access_hardening.sql').read_text(encoding='utf-8')
start = base.index('  IF to_regprocedure(\'public.nrs_admin_update_order_status')
end = base.index('  FOR r IN', start)
base = base[:start] + base[end:]
base = base[base.index('BEGIN;'):base.rindex('COMMIT;')]
guard = r'''
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
__MANIFEST__
      ) known(signature,body_hash,language)) LOOP
    SELECT * INTO expected FROM (VALUES
__MANIFEST__
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
__POLICIES__
      ) known(table_name,policy_name) WHERE known.table_name=r.tablename AND known.policy_name=r.policyname) THEN
      RAISE EXCEPTION 'STOP: unreviewed policy %.%; preserve and review',r.tablename,r.policyname;
    END IF;
  END LOOP;
END $guard$;
'''.replace('__MANIFEST__', manifest).replace('__POLICIES__', policy_manifest)
verification = r'''
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
'''
header = '''-- NRS manual Dashboard operation ONLY: moiynemxthkmgpgnfajd.
-- Not applied by Codex. Confirm Dashboard project ref and backup before Run.
-- One file / one manual Run: read-only inventory, guarded ACL/RLS, final checks.
-- Never run old migrations to satisfy a STOP. Review the reported discrepancy.
-- No customer DML, schema/NOT NULL conversion, RPC replacement, history write,
-- service_role grant change, admin provisioning, payment activation or network.
-- If execution stops, do not continue fragments; ROLLBACK an open transaction.
'''
# Audit and history are observed before applying any metadata mutation.
history_read = '''\nDO $history$ DECLARE versions text; BEGIN
 IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
  EXECUTE 'SELECT string_agg(version::text,'','' ORDER BY version) FROM supabase_migrations.schema_migrations' INTO versions;
  RAISE NOTICE 'Migration history: %',coalesce(versions,'<empty>');
 ELSE RAISE NOTICE 'Migration history unavailable; no old migration replayed'; END IF;
END $history$;\n'''
audit = audit.replace('BEGIN TRANSACTION READ ONLY;', 'BEGIN;\nSET LOCAL search_path = pg_catalog;\nSET LOCAL lock_timeout = \'5s\';')
audit = audit.replace('COMMIT;', history_read)
# Keep obsolete migration-chain guidance out of the manual operation.
audit = audit.replace('-- Run in the SQL Editor of the VERIFIED NRS project before the migration chain\n-- and once after its last step. This file does not apply migrations.', '-- Run only in the verified project as a standalone guarded operation.\n-- This file does not apply or replay migrations.')
result = header + audit + '\n' + base.replace('BEGIN;', guard, 1) + verification
(root / 'Raporlar/NRS_SUPABASE_SECURITY_APPLY.sql').write_text(result, encoding='utf-8')
print('Prepared metadata-only SQL with', len(functions), 'reviewed definer signatures; no remote access.')
