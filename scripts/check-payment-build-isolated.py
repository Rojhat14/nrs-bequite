# Secret-free build verification with a synthetic empty LOCAL catalog.
# Never deploy this test artifact; this does not verify live Supabase.
import os,shutil,subprocess,threading,tempfile,time,socket,sys,signal
from urllib.request import urlopen,Request,build_opener,HTTPRedirectHandler
from urllib.error import HTTPError
from http.server import BaseHTTPRequestHandler,HTTPServer
from pathlib import Path
src=Path(__file__).resolve().parents[1]; dst=Path(tempfile.mkdtemp(prefix='nrs-security-build-'))
def ignore(folder,names):
 return [n for n in names if n.startswith('.env') or n in {'.git','.next','.next-dev','node_modules','.aws','.codex','.agents','.npmrc','.yarnrc.yml','.netrc','.vercel','.temp','tsconfig.tsbuildinfo','public'}]
if dst.exists():
 shutil.copytree(src,dst,ignore=ignore,dirs_exist_ok=True)
 (dst/'node_modules').symlink_to(src/'node_modules',target_is_directory=True)
 (dst/'public').symlink_to(src/'public',target_is_directory=True)
env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR','LANG'] if k in os.environ}
class EmptyCatalog(BaseHTTPRequestHandler):
 def do_GET(self):
  self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Range','*/0'); self.end_headers(); self.wfile.write(b'[]')
 def log_message(self,*args): pass
catalog=HTTPServer(('127.0.0.1',0),EmptyCatalog)
threading.Thread(target=catalog.serve_forever,daemon=True).start()
env.update({'NEXT_PUBLIC_SUPABASE_URL':f'http://127.0.0.1:{catalog.server_port}','NEXT_PUBLIC_SUPABASE_ANON_KEY':'isolated-build-dummy-not-a-secret','PAYMENT_ENABLED':'false','PAYMENT_DATABASE_VERIFIED':'false','NEXT_TELEMETRY_DISABLED':'1'})
log=dst/'verification-build.log'
with log.open('w') as out:
 result=subprocess.run(['npm','run','build'],cwd=dst,env=env,stdout=out,stderr=subprocess.STDOUT)
# Optional integration verification runs ONLY against this local test build.
# The synthetic catalog stays alive; neither auth nor live data is available.
if result.returncode == 0 and '--http' in sys.argv:
 with socket.socket() as probe:
  probe.bind(('127.0.0.1',0)); port=probe.getsockname()[1]
 runtime_log=(dst/'verification-runtime.log').open('w')
 server=subprocess.Popen(['npm','run','start','--','--hostname','127.0.0.1','--port',str(port)],cwd=dst,env=env,stdout=runtime_log,stderr=subprocess.STDOUT,start_new_session=True)
 base=f'http://127.0.0.1:{port}'
 try:
  for attempt in range(100):
   try:
    with urlopen(base+'/robots.txt',timeout=1): break
   except Exception: time.sleep(.15)
  routes=['mesafeli-satis-sozlesmesi','on-bilgilendirme-formu','iade-ve-degisim','iptal-kosullari','gizlilik-politikasi','kvkk','kullanim-kosullari','kargo-ve-teslimat']
  for route in routes:
   with urlopen(base+'/'+route,timeout=10) as response:
    assert response.status==200,route
  for path in ['/api/payment/create','/api/payment/callback','/api/payment/quote','/api/payment/return']:
   try: urlopen(Request(base+path,data=b'{}',headers={'Content-Type':'application/json'}),timeout=10)
   except HTTPError as error: assert error.code==503,(path,error.code)
   else: raise AssertionError('Disabled payment endpoint did not return 503: '+path)
  with urlopen(base+'/sitemap.xml',timeout=10) as response:
   xml=response.read().decode(); assert all('/'+route in xml for route in routes)
  class NoRedirect(HTTPRedirectHandler):
   def redirect_request(self,*args): return None
  for old,new in [('returns','iade-ve-degisim'),('shipping','kargo-ve-teslimat')]:
   try: build_opener(NoRedirect()).open(base+'/'+old,timeout=10)
   except HTTPError as error:
    assert error.code in [307,308] and error.headers['Location'].endswith('/'+new),(old,error.code)
   else: raise AssertionError('Legacy route did not redirect: '+old)
  for path in ['/checkout/success','/checkout/verify','/checkout/failure']:
   with urlopen(base+path+'?orderId=11111111-1111-4111-8111-111111111111&status=paid&success=true',timeout=10) as response:
    html=response.read().decode(); assert response.status==200 and 'Ödeme doğrulandı' not in html,path
  print('PASS 18 local production HTTP checks: legal routes, redirects, sitemap, disabled APIs, forged success claims')
  if '--browser' in sys.argv:
   browser_env={**env,'PAYMENT_TEST_URL':base}
   subprocess.run(['node','scripts/check-payment-ui.cjs'],cwd=dst,env=browser_env,check=True,timeout=45)
 finally:
  os.killpg(server.pid,signal.SIGTERM)
  try: server.wait(timeout=10)
  except subprocess.TimeoutExpired: os.killpg(server.pid,signal.SIGKILL); server.wait()
  runtime_log.close()
catalog.shutdown()
print('Isolated test-only build:',dst)
print('Build log:',log)
print('Isolated production build exit:',result.returncode)
raise SystemExit(result.returncode)
