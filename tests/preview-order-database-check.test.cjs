const test=require('node:test');
const assert=require('node:assert/strict');
const {loader}=require('./source-loader.cjs');
const path='src/app/api/preview/order-database-check/route.ts';
const target='https://moiynemxthkmgpgnfajd.supabase.co';
async function check(env, fetcher, verify) {
 const saved=Object.fromEntries(['VERCEL_ENV','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ORDER_DATABASE_VERIFIED','PAYMENT_DATABASE_VERIFIED','PAYMENT_ENABLED'].map(k=>[k,process.env[k]]));
 const originalFetch=global.fetch;
 Object.assign(process.env,{VERCEL_ENV:'preview',NEXT_PUBLIC_SUPABASE_URL:target,SUPABASE_SERVICE_ROLE_KEY:'synthetic-preview-secret',ORDER_DATABASE_VERIFIED:'false',PAYMENT_DATABASE_VERIFIED:'false',PAYMENT_ENABLED:'false',...env});
 const calls=[];global.fetch=async(url,options)=>{calls.push({url:String(url),options});return fetcher(url,options)};
 try {
  const route=loader()(path);const response=await route.GET();const body=await response.json();
  assert.match(response.headers.get('cache-control'),/no-store/);
  assert.ok(!JSON.stringify(body).includes('synthetic-preview-secret'));
  for(const k of ['ORDER_DATABASE_VERIFIED','PAYMENT_DATABASE_VERIFIED','PAYMENT_ENABLED'])assert.equal(process.env[k],'false');
  await verify({body,response,calls});
 }finally {global.fetch=originalFetch;for(const [k,v]of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v}}
}
test('Preview probe blocks production, development and missing environment before any request',async()=>{
 for(const VERCEL_ENV of ['production','development',''])await check({VERCEL_ENV},()=>{throw Error('Must not connect')},({body,response,calls})=>{assert.deepEqual(body,{status:'BLOCKED',category:'PREVIEW_ONLY'});assert.equal(response.status,404);assert.equal(calls.length,0)});
});
test('Preview probe rejects missing key and unexpected project URL without forwarding secrets',async()=>{
 for(const env of [{SUPABASE_SERVICE_ROLE_KEY:''},{NEXT_PUBLIC_SUPABASE_URL:''},{NEXT_PUBLIC_SUPABASE_URL:'https://other.supabase.co'},{NEXT_PUBLIC_SUPABASE_URL:target+'.evil.invalid'},{NEXT_PUBLIC_SUPABASE_URL:target+'/rest/v1'},{NEXT_PUBLIC_SUPABASE_URL:target+'?redirect=evil'},{NEXT_PUBLIC_SUPABASE_URL:'https://user:password@moiynemxthkmgpgnfajd.supabase.co'}])await check(env,()=>{throw Error('Must not connect')},({body,calls})=>{assert.equal(body.status,'BLOCKED');assert.equal(calls.length,0)});
});
test('Preview probe uses only authenticated HEAD limit=0 REST requests and returns no records',async()=>{
 await check({},()=>new Response(null,{status:200}),({body,calls})=>{
  assert.deepEqual(body,{status:'PASS'});assert.equal(calls.length,7);
  for(const {url,options}of calls){const parsed=new URL(url);assert.equal(parsed.origin,target);assert.ok(parsed.pathname.startsWith('/rest/v1/'));assert.ok(!parsed.pathname.includes('/rpc/'));assert.equal(parsed.searchParams.get('limit'),'0');assert.equal(options.method,'HEAD');assert.equal(options.body,undefined);assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.ok(options.signal);assert.equal(new Headers(options.headers).get('apikey'),'synthetic-preview-secret')}
  const products=calls.find(c=>c.url.includes('/products?'));const selected=new URL(products.url).searchParams.get('select');assert.ok(selected.includes('categories(name,slug)'));assert.ok(selected.includes('product_images(*)'));
  assert.ok(new URL(calls.find(c=>c.url.includes('/orders?')).url).searchParams.get('select').includes('manual_request_hash'));
 });
});
test('Preview probe returns short safe categories for auth, schema and network errors',async()=>{
 for(const [status,category]of [[401,'AUTHORIZATION'],[403,'AUTHORIZATION'],[400,'SCHEMA_ACCESS'],[404,'SCHEMA_ACCESS'],[500,'CONNECTION']])await check({},()=>new Response(null,{status}),({body,calls})=>{assert.deepEqual(body,{status:'BLOCKED',category});assert.equal(calls.length,1)});
 await check({},()=>{throw Error('synthetic-preview-secret private failure')},({body})=>assert.deepEqual(body,{status:'BLOCKED',category:'CONNECTION'}));
});
test('Preview probe fails closed on malformed URL and later schema failure',async()=>{
 await check({NEXT_PUBLIC_SUPABASE_URL:'not a url'},()=>{throw Error('Must not connect')},({body,calls})=>{assert.deepEqual(body,{status:'BLOCKED',category:'PROJECT_MISMATCH'});assert.equal(calls.length,0)});
 let n=0;await check({},()=>new Response(null,{status:++n===4?400:200}),({body,calls})=>{assert.deepEqual(body,{status:'BLOCKED',category:'SCHEMA_ACCESS'});assert.equal(calls.length,4)});
});
