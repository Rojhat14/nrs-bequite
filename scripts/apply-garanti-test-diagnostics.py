"""Install only the isolated TEST diagnostic table; no payment/order mutations."""
import json, subprocess, sys, tempfile
from pathlib import Path
REF = 'dzuxhwtbuojnhibzfxqy'
CLI = '/Users/rojhatmaman/.npm/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-darwin-arm64/bin/supabase'
ROOT = Path(__file__).resolve().parents[1]
base = [CLI, 'db', 'query', '--linked', '--project-ref', REF, '--workdir', '/private/tmp/nrs-garanti-control', '--output', 'json']
def query(arguments):
    r = subprocess.run(base + arguments, capture_output=True, text=True, timeout=90)
    if r.returncode:
        print('TEST diagnostics setup: BLOCKED; details withheld'); sys.exit(1)
    try: return json.loads(r.stdout)['rows']
    except Exception:
        print('TEST diagnostics setup response: BLOCKED'); sys.exit(1)
before = query(["SELECT (SELECT count(*) FROM public.orders) orders,(SELECT count(*) FROM public.payment_events) payment_events,(SELECT sum(stock_quantity) FROM public.product_variants) stock,to_regclass('public.garanti_test_return_diagnostics') IS NOT NULL AS installed"])[0]
if not before['installed']:
    sql = "SET app.nrs_test_project_ref='" + REF + "';\n" + (ROOT / 'supabase/test-setup' / (REF + '-garanti-diagnostics.sql')).read_text()
    with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', dir='/private/tmp') as f:
        f.write(sql); f.flush(); query(['--file', f.name])
sql = "SET app.nrs_test_project_ref='" + REF + "';\n" + (ROOT / 'supabase/test-setup' / (REF + '-garanti-diagnostics-evidence.sql')).read_text()
with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', dir='/private/tmp') as f:
    f.write(sql); f.flush(); query(['--file', f.name])
sql = "SET app.nrs_test_project_ref='" + REF + "';\n" + (ROOT / 'supabase/test-setup' / (REF + '-garanti-diagnostics-duplicates.sql')).read_text()
with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', dir='/private/tmp') as f:
    f.write(sql); f.flush(); query(['--file', f.name])
sql = "SET app.nrs_test_project_ref='" + REF + "';\n" + (ROOT / 'supabase/test-setup' / (REF + '-garanti-diagnostics-signature.sql')).read_text()
with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', dir='/private/tmp') as f:
    f.write(sql); f.flush(); query(['--file', f.name])
after = query(["SELECT (SELECT count(*) FROM public.orders) orders,(SELECT count(*) FROM public.payment_events) payment_events,(SELECT sum(stock_quantity) FROM public.product_variants) stock,(SELECT relrowsecurity FROM pg_class WHERE oid='public.garanti_test_return_diagnostics'::regclass) rls,has_table_privilege('anon','public.garanti_test_return_diagnostics','SELECT') anon_read,has_table_privilege('authenticated','public.garanti_test_return_diagnostics','INSERT') browser_write,has_table_privilege('service_role','public.garanti_test_return_diagnostics','INSERT') server_write"])[0]
ok = all(before[k] == after[k] for k in ['orders', 'payment_events', 'stock']) and after['rls'] and not after['anon_read'] and not after['browser_write'] and after['server_write']
print(json.dumps({'projectRef': REF, 'check': 'PASS' if ok else 'BLOCKED', 'existingOrderDataUnchanged': all(before[k] == after[k] for k in ['orders', 'payment_events', 'stock']), 'rls': after['rls'], 'anonRead': after['anon_read'], 'browserWrite': after['browser_write'], 'serverInsert': after['server_write']}))
raise SystemExit(0 if ok else 1)
