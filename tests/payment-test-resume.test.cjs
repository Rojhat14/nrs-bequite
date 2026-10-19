const test=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {loader}=require('./source-loader.cjs');
const id='11111111-1111-4111-8111-111111111111',origin='https://nrs-bequite-garanti-test.vercel.app';
const input={contractAccepted:true,contractVersion:'v1.5',preInformationVersion:'v1.5',idempotencyKey:'22222222-2222-4222-8222-222222222222',quoteHash:'a'.repeat(64),
 items:[{productId:'test',variantId:id,quantity:1,measurements:{}}],customer:{firstName:'Test',lastName:'Buyer',email:'test@example.com',phone:'905551234567',address:'Test',city:'Ankara',district:'Test',postalCode:'06000'}};
const digest=createHash('sha256').update(JSON.stringify({items:input.items,customer:input.customer,quoteHash:input.quoteHash,contractVersion:input.contractVersion,preInformationVersion:input.preInformationVersion})).digest('hex');
function fixture(observation=true, sameKey=false){
 let order={id,userId:'owner',merchantReference:id,state:'pending',redirectUrl:origin+'/api/payment/garanti/handoff?token=old',amountMinor:100,currency:'TRY',legal:{}};
 let writes=0,creates=0,signs=0;
 class GarantiProvider{constructor(){this.name='garanti-oos';this.settlementDisabled=true;this.testObservationOnly=true;this.config={observationOnly:true,siteOrigin:origin};this.allowedRedirectOrigins=[origin]}
 handoff(token){if(token!=='old')throw new Error('expired');return{id}}
 async initiate(o){signs++;assert.equal(o.state,'initiating');return {redirectUrl:origin+'/api/payment/garanti/handoff?token=fresh'}}}
 const db={from(){return{select(){return this},eq(){return this},in(){return this},async maybeSingle(){return{data:sameKey?{order_id:id,user_id:order.userId,guest_hash:null,request_hash:digest,merchant_reference:id,amount_minor:100,currency:'TRY',state:order.state,provider:'garanti-oos'}:null,error:null}},async limit(){return{data:[{order_id:id,user_id:'owner',guest_hash:null,request_hash:digest,merchant_reference:id,amount_minor:100,currency:'TRY',state:order.state,provider:'garanti-oos'}],error:null}}}}};
 const load=loader({'@supabase/supabase-js':{createClient:()=>db},'./config':{requirePaymentDeployment(){}},'./garanti/config':{garantiObservationOnly:()=>observation,garantiLiveObservationOnly:()=>false,garantiLiveSingleFinalizeArmed:()=>false},'./garanti/adapter':{GarantiProvider},
 './garanti/order':{loadGarantiOrder:async()=>order,renewUnsubmittedGarantiHandoff:async(o,next)=>{assert.equal(o.userId,'owner');writes++;order={...order,redirectUrl:next}}}});
 process.env.PAYMENT_DATABASE_VERIFIED='true';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic';process.env.PAYMENT_PROVIDER='garanti-oos';
 const repo=load('src/lib/payment/repository.ts').createPaymentRepository();repo.createAtomic=async()=>{creates++;throw new Error('Must not create duplicate')};repo.quote=async()=>{throw new Error('Must not reserve again')};
 return{repo,provider:new GarantiProvider(),load,setOrder(o){order={...order,...o}},counts:()=>({writes,creates,signs})};
}
test('Same browser key reuses its current unsubmitted TEST handoff without rotating or reserving again',async()=>{
 const f=fixture(true,true);const result=await f.load('src/lib/payment/service.ts').initiatePayment(input,'owner',null,f.repo,f.provider,{customerIp:'192.168.0.1'});
 assert.equal(result.orderId,id);assert.match(result.redirectUrl,/token=old$/);assert.deepEqual(f.counts(),{writes:0,creates:0,signs:0});
});
test('A distinct TEST key never silently reuses another pending order',async()=>{
 for(const changed of [{...input,quoteHash:'b'.repeat(64)},{...input,customer:{...input.customer,address:'Changed'}},{...input,items:[{...input.items[0],quantity:2}]}]){
 const f=fixture();assert.equal(await f.repo.findExisting(changed,'owner',null),null);
 assert.deepEqual(f.counts(),{writes:0,creates:0,signs:0});}
});
test('Live observation never calls the TEST-only pending order resume path',async()=>{
 const service=loader()('src/lib/payment/service.ts');let resumes=0;
 const existing={id,merchantReference:id,state:'pending',amountMinor:100,currency:'TRY'};
 const repository={findExisting:async()=>existing,getRedirect:async()=>({redirectUrl:origin+'/api/payment/garanti/handoff?token=existing'}),resumeUnsubmittedTest:async()=>{resumes++;throw Error('TEST-only RPC must not run')}};
 const provider={name:'garanti-oos',merchantId:'live-terminal',settlementDisabled:true,testObservationOnly:false,
  initiationMaxAmountMinor:5000,allowedRedirectOrigins:[origin]};
 const result=await service.initiatePayment(input,'owner',null,repository,provider,{customerIp:'127.0.0.1'});
 assert.equal(result.orderId,id);assert.equal(resumes,0);
});
test('Submitted, wrong-owner and in-flight TEST handoffs cannot be renewed',async()=>{
 for(const change of [{redirectUrl:origin+'/api/payment/garanti/handoff?token=old&used=1'},{userId:'other'},{state:'initiating'}]){
 const f=fixture();f.setOrder(change);await assert.rejects(f.repo.resumeUnsubmittedTest(id,'owner',f.provider,{customerIp:'192.168.0.1'}));assert.deepEqual(f.counts(),{writes:0,creates:0,signs:0});}
});
test('Expired unsubmitted same-key handoff returns its owned order for explicit renewal',async()=>{
 const f=fixture(true,true);f.setOrder({redirectUrl:origin+'/api/payment/garanti/handoff?token=expired'});
 await assert.rejects(f.repo.resumeUnsubmittedTest(id,'owner',f.provider,{customerIp:'192.168.0.1'}),e=>e.code==='UNRESOLVED_PAYMENT'&&e.resumeOrderId===id);
 assert.deepEqual(f.counts(),{writes:0,creates:0,signs:0});
});
test('Cross-key resume is unavailable outside exact isolated observation mode',async()=>{
 const f=fixture(false);assert.equal(await f.repo.findExisting(input,'owner',null),null);await assert.rejects(f.repo.resumeUnsubmittedTest(id,'owner',f.provider));assert.deepEqual(f.counts(),{writes:0,creates:0,signs:0});
});
test('Safe errors retain RPC SQLSTATE without exposing arbitrary error fields',async()=>{
 const {PaymentStartError,startStage}=loader()('src/lib/payment/start-error.ts');
 const e=new PaymentStartError('UNRESOLVED_PAYMENT','create_rpc','internal', 'P0001');assert.equal(e.databaseCode,'P0001');
 assert.equal(new PaymentStartError('START_FAILED','create_rpc','internal','secret/credential').databaseCode,undefined);
 await assert.rejects(startStage('create_rpc',async()=>{throw e}),x=>x===e);
});
test('Checkout reports/logs only allowlisted stage and code, and links an owned unresolved test order',async()=>{
 const load=loader({'@/lib/payment/provider':{paymentAvailable:()=>true,paymentAvailableForUser:()=>true,getPaymentProvider:()=>({})},
 '@/lib/supabase/server':{createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'owner'}}})}})},
 '@/lib/payment/repository':{createPaymentRepository:()=>({})},
 '@/lib/payment/service':{initiatePayment:async()=>{throw new (load('src/lib/payment/start-error.ts').PaymentStartError)('UNRESOLVED_PAYMENT','create_rpc','NEVER_EXPOSE_RAW_CREDENTIAL', 'P0001',id)}}});
 const warn=console.warn,logs=[];console.warn=x=>logs.push(x);process.env.PAYMENT_ENABLED='true';
 try{const r=await load('src/app/api/payment/create/route.ts').POST(new Request(origin+'/api/payment/create',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'}));
 const data=await r.json();assert.equal(r.status,409);assert.equal(data.code,'UNRESOLVED_PAYMENT');assert.equal(data.stage,'create_rpc');assert.equal(data.databaseCode,'P0001');
 assert.equal(data.resumeUrl,`/checkout/verify?orderId=${id}`);
 assert.equal(JSON.stringify({data,logs}).includes('NEVER_EXPOSE_RAW_CREDENTIAL'),false);assert.equal(logs.length,1);
 }finally{console.warn=warn}
});

test('Same-key changed content is still rejected before any new attempt',async()=>{
 const f=fixture(true,true);await assert.rejects(f.repo.findExisting({...input,quoteHash:'b'.repeat(64)},'owner',null));assert.deepEqual(f.counts(),{writes:0,creates:0,signs:0});
});

test('Only exact observation mode routes creation to the test-only RPC',async()=>{
 for(const observation of [true,false]){let rpcName;const db={rpc:async(name)=>{rpcName=name;return{data:{order:{id},created:true},error:null}}};
 const load=loader({'@supabase/supabase-js':{createClient:()=>db},'./config':{requirePaymentDeployment(){}},'./garanti/config':{garantiObservationOnly:()=>observation,garantiLiveObservationOnly:()=>false,garantiLiveSingleFinalizeArmed:()=>false},'@/lib/legal/payment-preflight':{prepareOrderLegalRecord:()=>({})}});
 process.env.PAYMENT_DATABASE_VERIFIED='true';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic';process.env.PAYMENT_PROVIDER='garanti-oos';
 const result=await load('src/lib/payment/repository.ts').createPaymentRepository().createAtomic(input,'owner',null,{summary:{},hash:input.quoteHash});
 assert.equal(rpcName,observation?'nrs_create_garanti_test_observation_order':'nrs_create_payment_order');assert.equal(result.created,true);
 }
});
test('Claimed single-finalize TEST account can create a distinct observation-only order',async()=>{
 const calls=[],nextId='33333333-3333-4333-8333-333333333333';const db={
  async rpc(name,args){calls.push(['rpc',name,args]);return{data:{created:true,order:{id:nextId,state:'initiating'}},error:null}}
 };
 const load=loader({'@supabase/supabase-js':{createClient:()=>db},'./config':{requirePaymentDeployment(){}},
  './garanti/config':{garantiObservationOnly:()=>true,garantiLiveObservationOnly:()=>false,garantiLiveSingleFinalizeArmed:()=>false},'@/lib/legal/payment-preflight':{prepareOrderLegalRecord:()=>({})}});
 Object.assign(process.env,{PAYMENT_DATABASE_VERIFIED:'true',SUPABASE_SERVICE_ROLE_KEY:'synthetic',NEXT_PUBLIC_SUPABASE_URL:'https://dzuxhwtbuojnhibzfxqy.supabase.co',PAYMENT_PROVIDER:'garanti-oos'});
 const repo=load('src/lib/payment/repository.ts').createPaymentRepository();
 const result=await repo.createAtomic(input,'owner',null,{summary:{},hash:input.quoteHash});
 assert.equal(result.order.id,nextId);assert.equal(calls.length,1);assert.equal(calls[0][1],'nrs_create_garanti_test_observation_order');
 assert.equal(calls[0][2].p_user_id,'owner');assert.notEqual(calls[0][2].p_order_id,id);assert.equal(calls[0][2].p_key,input.idempotencyKey);
});
