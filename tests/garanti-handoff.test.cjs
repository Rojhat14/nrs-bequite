const test=require('node:test'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {loader}=require('./source-loader.cjs');
const {GarantiProvider}=loader()('src/lib/payment/garanti/adapter.ts');
const id='11111111-1111-4111-8111-111111111111',origin='https://shop.example';
const config={mode:'TEST',merchantId:'1000001',terminalId:'12345678',userId:'GARANTI',provisionUser:'PROVAUT',provisionPassword:'synthetic-password',
 queryUser:'PROVAUT',queryPassword:'synthetic-query',storeKey:'synthetic-store',handoffSecret:'a'.repeat(64),siteOrigin:origin,
 formUrl:'https://sanalposprovtest.garantibbva.com.tr/servlet/gt3dengine',queryUrl:'https://sanalposprovtest.garantibbva.com.tr/VPServlet',
 successUrl:origin+'/api/payment/garanti/success',errorUrl:origin+'/api/payment/garanti/failure',installment:'',capturedStatus:'CAPTURED',saleChargeType:'sales',failedStatuses:[]};
async function fixture(){
 const order={id,userId:'owner',guestHash:null,merchantReference:id,amountMinor:100,currency:'TRY',state:'pending',legal:{order_summary:{buyer:{email:'test@example.com'},items:[{name:'TEST ürün',size:'M',quantity:1,unitPrice:1}]}}};
 const provider=new GarantiProvider(config,async()=>order,async()=>{throw Error('No bank call in this test')});
 order.redirectUrl=(await provider.initiate({...order,state:'initiating'},id,{customerIp:'127.0.0.1'})).redirectUrl;
 let claims=0,user='owner',guestToken;
 const route=loader({
 '@/lib/payment/provider':{paymentAvailable:()=>true,getPaymentProvider:()=>provider},
 '@/lib/payment/garanti/adapter':{GarantiProvider},
 '@/lib/payment/garanti/order':{loadGarantiOrder:async()=>order,claimGarantiHandoff:async(_order,redirect)=>{
  assert.equal(order.redirectUrl,redirect);order.redirectUrl+='&used=1';claims++}},
 '@/lib/supabase/server':{createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:user?{id:user}:null}})}})},
 'next/headers':{cookies:async()=>({get:name=>name==='nrs-order-access'&&guestToken?{value:guestToken}:undefined})}
 })('src/app/api/payment/garanti/handoff/route.ts');
 return {route,order,provider,claims:()=>claims,user:v=>user=v,guest:v=>guestToken=v};
}
test('Native form handoff preserves POST Origin without leaking token in referrers, and keeps restrictive CSP',async()=>{
 const f=await fixture();const r=await f.route.GET(new Request(f.order.redirectUrl));
 assert.equal(r.status,200);assert.equal(r.headers.get('Referrer-Policy'),'strict-origin');
 assert.match(r.headers.get('Content-Security-Policy'),/form-action https:\/\/shop.example/);
 assert.match(r.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
 const handoff=await r.text();assert.match(handoff,/method="post"/);assert.match(handoff,/Güvenli ödemeye devam et/);assert.match(handoff,/Kart bilgileriniz Garanti BBVA’nın güvenli ödeme sayfasında girilir/);assert.match(handoff,/Sipariş özeti/);assert.equal(f.claims(),0);
 const post=await f.route.POST(new Request(f.order.redirectUrl,{method:'POST',headers:{Origin:origin}}));
 assert.equal(post.status,200);assert.equal(f.claims(),1);assert.equal(post.headers.get('Referrer-Policy'),'strict-origin');
 const body=await post.text();assert.match(body,/secure3dsecuritylevel/);assert.match(body,/3D_OOS_PAY/);
 for(const secret of [config.storeKey,config.provisionPassword,config.queryPassword])assert.equal(body.includes(secret),false);
 assert.doesNotMatch(body,/name="(?:cardnumber|cardcvv2)"/);
});
test('Live observation renders the validated Production bank form action without sending a bank request',async()=>{
 const f=await fixture();
 f.provider.config.mode='PROD';f.provider.config.liveObservationOnly=true;
 f.provider.config.formUrl='https://sanalposprov.garanti.com.tr/servlet/gt3dengine';
 const get=await f.route.GET(new Request(f.order.redirectUrl));assert.equal(get.status,200);
 assert.match(await get.text(),/gerçek tahsilat yapılabilir/);
 const post=await f.route.POST(new Request(f.order.redirectUrl,{method:'POST',headers:{Origin:origin}}));
 assert.equal(post.status,200);const html=await post.text();
 assert.match(html,/action="https:\/\/sanalposprov\.garanti\.com\.tr\/servlet\/gt3dengine"/);
 assert.match(html,/name="mode" value="PROD"/);assert.match(html,/name="txntype" value="sales"/);
 assert.match(html,/name="secure3dsecuritylevel" value="3D_OOS_PAY"/);
 assert.match(html,/f\.submit\(\)/);assert.match(html,/Garanti BBVA’ya aktarılıyor/);
 assert.equal(f.claims(),1);
});
test('Missing/null/foreign Origin still fail before token consumption',async()=>{
 for(const value of [null,'null','https://attacker.example']){
  const f=await fixture(),headers=value?{Origin:value}:{};
  assert.equal((await f.route.POST(new Request(f.order.redirectUrl,{method:'POST',headers}))).status,403);assert.equal(f.claims(),0);
 }
});
test('Handoff retains session, owner, signature, expiry and one-use checks',async()=>{
 for(const user of [null,'other-user']){const f=await fixture();f.user(user);
 assert.equal((await f.route.POST(new Request(f.order.redirectUrl,{method:'POST',headers:{Origin:origin}}))).status,409);assert.equal(f.claims(),0)}
 {const f=await fixture();assert.equal((await f.route.POST(new Request(f.order.redirectUrl+'changed',{method:'POST',headers:{Origin:origin}}))).status,409);assert.equal(f.claims(),0)}
 {const f=await fixture(),now=Date.now;Date.now=()=>now()+1000000;try{assert.equal((await f.route.POST(new Request(f.order.redirectUrl,{method:'POST',headers:{Origin:origin}}))).status,409)}finally{Date.now=now}assert.equal(f.claims(),0)}
 {const f=await fixture(),url=f.order.redirectUrl;assert.equal((await f.route.POST(new Request(url,{method:'POST',headers:{Origin:origin}}))).status,200);
 assert.equal((await f.route.POST(new Request(url,{method:'POST',headers:{Origin:origin}}))).status,409);assert.equal(f.claims(),1)}
});
test('Guest-owned orders use only the matching guest capability at handoff',async()=>{
 const token='a'.repeat(64),hash=createHash('sha256').update(token).digest('hex');
 {
  const f=await fixture();f.order.userId=null;f.order.guestHash=hash;f.user(null);f.guest(token);
  const get=await f.route.GET(new Request(f.order.redirectUrl));assert.equal(get.status,200);
  const post=await f.route.POST(new Request(f.order.redirectUrl,{method:'POST',headers:{Origin:origin}}));
  assert.equal(post.status,200);assert.equal(f.claims(),1);
 }
 for(const supplied of [undefined,'b'.repeat(64)]){
  const f=await fixture();f.order.userId=null;f.order.guestHash=hash;f.user(null);f.guest(supplied);
  assert.equal((await f.route.GET(new Request(f.order.redirectUrl))).status,409);
  assert.equal((await f.route.POST(new Request(f.order.redirectUrl,{method:'POST',headers:{Origin:origin}}))).status,409);
  assert.equal(f.claims(),0);
 }
 {
  const f=await fixture();f.order.userId=null;f.order.guestHash=null;f.user(null);f.guest(token);
  assert.equal((await f.route.GET(new Request(f.order.redirectUrl))).status,409);assert.equal(f.claims(),0);
 }
});
test('Only the authenticated owner can renew an unsubmitted TEST handoff; expired POSTs stay rejected',async()=>{
 const f=await fixture();f.provider.config.observationOnly=true;let renewed=0,actualOwner='owner';
 const route=loader({'next/server':{NextResponse:{redirect:(url,status)=>Response.redirect(url,status)}},
 '@/lib/payment/provider':{paymentAvailable:()=>true,getPaymentProvider:()=>f.provider},
 '@/lib/payment/garanti/adapter':{GarantiProvider},
 '@/lib/payment/garanti/order':{loadGarantiOrder:async()=>f.order,renewUnsubmittedGarantiHandoff:async()=>{renewed++}},
 '@/lib/supabase/server':{createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:{id:actualOwner}}})}})}
 })('src/app/api/payment/garanti/renew/route.ts');
 const request=(o=origin)=>new Request(origin+'/api/payment/garanti/renew',{method:'POST',headers:{Origin:o,'Content-Type':'application/x-www-form-urlencoded'},body:'orderId='+id});
 assert.equal((await route.POST(request('null'))).status,403);assert.equal(renewed,0);
 actualOwner='other';assert.equal((await route.POST(request())).status,409);assert.equal(renewed,0);
 actualOwner='owner';assert.equal((await route.POST(request())).status,303);assert.equal(renewed,1);
 f.order.redirectUrl+='&used=1';assert.equal((await route.POST(request())).status,409);assert.equal(renewed,1);
});
test('Atomic renewal cannot race a consumed or replaced handoff',async()=>{
 let stored=origin+'/api/payment/garanti/handoff?token=synthetic';const original=stored;
 const db={from(){const q={};return{update(v){q.next=v.redirect_url;return this},eq(k,v){q[k]=v;return this},async select(){
 if(q.redirect_url!==stored)return{data:[],error:null};stored=q.next;return{data:[{order_id:id}],error:null}}}}};
 const renew=loader({'@/lib/payment/repository':{paymentDatabase:()=>db}})('src/lib/payment/garanti/order.ts').renewUnsubmittedGarantiHandoff;
 const order={id,redirectUrl:original};
 const results=await Promise.allSettled([renew(order,origin+'/fresh1'),renew(order,origin+'/fresh2')]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 await assert.rejects(renew({...order,redirectUrl:original+'&used=1'},origin+'/fresh3'));
});
