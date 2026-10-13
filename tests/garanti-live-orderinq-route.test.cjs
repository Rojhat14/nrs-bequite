const test=require('node:test'),assert=require('node:assert/strict');
const {loader}=require('./source-loader.cjs');
const allowedUser='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const orderId='fcccca17-ae6b-4940-9586-8679db7ee303';
const origin='https://nrsbequiteluminous.com';
function fixture({user=allowedUser,owner=allowedUser,live=true,requestedOrderId=orderId}={}){
 let inquiries=0,loads=0;
 class GarantiProvider { constructor(){this.config={liveObservationOnly:live}} async readOnlyOrderInquiry(order,userId){inquiries++;assert.equal(order.id,requestedOrderId);assert.equal(order.userId,userId);return{order_id:order.id,http:200,transaction_code:'92',transaction_reason_code:'0651',database_changed:false,sale_started:false,finalize_called:false}} }
 const order={id:requestedOrderId,userId:owner,state:'pending',redirectUrl:origin+'/api/payment/garanti/handoff?token=signed&used=1'};
 const route=loader({
  'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},
  '@/lib/supabase/server':{createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:user?{id:user}:null}})}})},
  '@/lib/payment/provider':{getPaymentProvider:()=>new GarantiProvider()},
  '@/lib/payment/garanti/adapter':{GarantiProvider},
  '@/lib/payment/garanti/config':{controlledLiveAccountAllowed:id=>id===allowedUser},
  '@/lib/payment/garanti/order':{loadGarantiOrder:async id=>{loads++;assert.equal(id,requestedOrderId);return order}},
 })('src/app/api/account/payments/garanti/orderinq/route.ts');
 const request=(body={orderId:requestedOrderId},o=origin)=>route.POST(new Request(origin+'/api/account/payments/garanti/orderinq',{method:'POST',headers:{Origin:o,'Content-Type':'application/json'},body:JSON.stringify(body)}));
 return{request,counts:()=>({inquiries,loads})};
}
test('private Production orderinq is one-account, owner-only, fixed-order and read-only',async()=>{
 const f=fixture();const response=await f.request({orderId});const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.transaction_reason_code,'0651');
 assert.deepEqual(f.counts(),{inquiries:1,loads:1});
 assert.equal(body.database_changed,false);assert.equal(body.sale_started,false);assert.equal(body.finalize_called,false);
 assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('x-robots-tag'),/noindex/);
});
test('new account-owned live observation order is individually allowlisted without widening query access',async()=>{
 const target='0a682ace-0eaa-43d7-bc4b-7efab1f7ee5f';
 const f=fixture({requestedOrderId:target});const response=await f.request({orderId:target});const body=await response.json();
 assert.equal(response.status,200);assert.equal(body.order_id,target);assert.equal(body.database_changed,false);
 assert.equal(body.sale_started,false);assert.equal(body.finalize_called,false);assert.deepEqual(f.counts(),{inquiries:1,loads:1});
 const foreign=fixture({requestedOrderId:target,owner:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'});
 assert.equal((await foreign.request({orderId:target})).status,404);assert.deepEqual(foreign.counts(),{inquiries:0,loads:1});
 const other=fixture();assert.equal((await other.request({orderId:'5a7ec29a-10bb-4bf2-bf5d-884cf521d7ed'})).status,404);assert.deepEqual(other.counts(),{inquiries:0,loads:0});
});
test('anonymous, foreign-account, cross-origin and non-allowlisted requests never reach orderinq',async()=>{
 const anonymous=fixture({user:null});assert.equal((await anonymous.request({orderId})).status,404);assert.equal(anonymous.counts().inquiries,0);
 const foreign=fixture({user:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'});assert.equal((await foreign.request({orderId})).status,404);assert.equal(foreign.counts().inquiries,0);
 const wrongOrigin=fixture();assert.equal((await wrongOrigin.request({orderId},'https://attacker.example')).status,403);assert.equal(wrongOrigin.counts().inquiries,0);
 const otherOrder=fixture();assert.equal((await otherOrder.request({orderId:'5a7ec29a-10bb-4bf2-bf5d-884cf521d7ed'})).status,404);assert.equal(otherOrder.counts().loads,0);
 const foreignOrder=fixture({owner:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'});assert.equal((await foreignOrder.request({orderId})).status,404);assert.equal(foreignOrder.counts().inquiries,0);
});
test('only the configured live observation provider can query, and request body is exact',async()=>{
 const inactive=fixture({live:false});assert.equal((await inactive.request({orderId})).status,503);assert.equal(inactive.counts().inquiries,0);
 const extra=fixture();assert.equal((await extra.request({orderId,amount:300})).status,400);assert.equal(extra.counts().inquiries,0);
});
