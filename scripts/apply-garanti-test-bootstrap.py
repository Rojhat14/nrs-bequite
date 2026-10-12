"""Apply only the named empty test project; never uses an ambient linked ref."""
import json,subprocess,sys
from pathlib import Path
TEST_REF='dzuxhwtbuojnhibzfxqy'
CLI='/Users/rojhatmaman/.npm/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-darwin-arm64/bin/supabase'
ROOT=Path(__file__).resolve().parents[1]
WORK=Path('/private/tmp/nrs-garanti-control')
WORK.mkdir(exist_ok=True);(WORK/'supabase').mkdir(exist_ok=True)
base=[CLI,'db','query','--linked','--project-ref',TEST_REF,'--workdir',str(WORK),'--output','json']
def query(args):
 r=subprocess.run(base+args,capture_output=True,text=True,timeout=120)
 if r.returncode: print('Test SQL operation: BLOCKED (details withheld)');sys.exit(1)
 try:return json.loads(r.stdout).get('rows',[])
 except Exception:print('Test SQL response: BLOCKED');sys.exit(1)
rows=query(["SELECT count(*)::int AS tables FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN('r','p')"])
if len(rows)!=1 or rows[0]['tables']!=0:print('BLOCKED: test schema is not empty; no SQL applied');sys.exit(1)
file=ROOT/'supabase/test-setup'/f'{TEST_REF}-bootstrap.sql'
if "empty public schema" not in file.read_text():raise RuntimeError('Missing bootstrap guard')
query(['--file',str(file)])
rows=query(["SELECT (SELECT count(*)::int FROM public.products) AS test_products,(SELECT count(*)::int FROM public.orders) AS orders,(SELECT count(*)::int FROM public.payment_events) AS payment_events,(SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity) AS tables_without_rls,has_function_privilege('anon','public.nrs_finalize_payment(jsonb,text)','EXECUTE') AS anon_finalize,has_function_privilege('service_role','public.nrs_finalize_payment(jsonb,text)','EXECUTE') AS server_finalize"])
print(json.dumps({'projectRef':TEST_REF,'result':rows}))
