const test=require('node:test'),assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const {loader}=require('./source-loader.cjs');
const load=loader();
const {GarantiProvider,GarantiPending}=load('src/lib/payment/garanti/adapter.ts');
const {garantiConfig}=load('src/lib/payment/garanti/config.ts');
const id='11111111-1111-4111-8111-111111111111', owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const origin='https://nrsbequiteluminous.com',db='https://moiynemxthkmgpgnfajd.supabase.co';
const env={GARANTI_MODE:'PROD',VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:db,GARANTI_SITE_ORIGIN:origin,
 GARANTI_SUCCESS_URL:origin+'/api/payment/garanti/success',GARANTI_ERROR_URL:origin+'/api/payment/garanti/failure',
 GARANTI_HANDOFF_SECRET:'a'.repeat(64),GARANTI_LIVE_CONTROLLED_ONLY:'true',GARANTI_LIVE_OBSERVATION_ONLY:'true',
 GARANTI_LIVE_ALLOWED_USER_ID:owner,GARANTI_LIVE_MAX_AMOUNT_MINOR:'1000',GARANTI_LIVE_MERCHANT_ID:'1000001',
 GARANTI_LIVE_TERMINAL_ID:'12345678',GARANTI_LIVE_USER_ID:'GARANTI',GARANTI_LIVE_PROVISION_USER:'PROVAUT',
 GARANTI_LIVE_PROVISION_PASSWORD:'synthetic-provision',GARANTI_LIVE_QUERY_USER:'PROVAUT',
 GARANTI_LIVE_QUERY_AGENT_USER_ID:'PROVAUT',GARANTI_LIVE_QUERY_PASSWORD:'synthetic-query',GARANTI_LIVE_STORE_KEY:'synthetic-store',
 GARANTI_LIVE_FORM_URL:'https://sanalposprov.garanti.com.tr/servlet/gt3dengine',
 GARANTI_LIVE_QUERY_URL:'https://sanalposprov.garanti.com.tr/VPServlet',GARANTI_CAPTURED_STATUS:'',
 GARANTI_CAPTURED_RESULT_CODE:'',GARANTI_SALE_CHARGE_TYPE:'',GARANTI_FINAL_FAILED_STATUSES:''};
const order={id,merchantReference:id,amountMinor:300,currency:'TRY',state:'pending',userId:owner,
 legal:{order_summary:{buyer:{email:'synthetic@example.com'}}},redirectUrl:null};
function response({status='DECLINED',code='05',reason='00',authAmount='0',outer='00',outerReason='00',historyCode='00',historyReason='00',historyRows='',isHistory=false,noRecord=false,noRecordPlaceholder=false,noRecordAmount='0'}={}){
 const inner=isHistory?`<OrderHistInqResult><OrderTxnList>${historyRows}</OrderTxnList></OrderHistInqResult>`:noRecordPlaceholder?`<OrderInqResult><AuthAmount>${noRecordAmount}</AuthAmount></OrderInqResult>`:noRecord?'':`<OrderInqResult><Status>${status}</Status><ChargeType>S</ChargeType><Code>${code}</Code><ReasonCode>${reason}</ReasonCode><AuthAmount>${authAmount}</AuthAmount><AuthCode>123456</AuthCode><RetrefNum>987654</RetrefNum><InstallmentCnt>0</InstallmentCnt></OrderInqResult>`;
 return `<GVPSResponse><Mode>PROD</Mode><Terminal><ProvUserID>PROVAUT</ProvUserID><UserID>PROVAUT</UserID><ID>12345678</ID><MerchantID>1000001</MerchantID></Terminal><Order><OrderID>${id}</OrderID>${inner}</Order><Transaction><Response><Code>${isHistory?historyCode:outer}</Code><ReasonCode>${isHistory?historyReason:outerReason}</ReasonCode></Response></Transaction></GVPSResponse>`;
}
async function run({mapping='DECLINED|05|00',confirm='true',queryOptions={},historyRows='',historyCode,historyReason,paymentProof={payment_event_count:0,signed_callback_evidence_count:0,live_finalize_evidence_count:0}}={}){
 const config=garantiConfig({...env,GARANTI_LIVE_FAILED_RESULT_MAPPINGS:mapping,GARANTI_LIVE_FAILED_RESULTS_CONFIRMED:confirm});
 let calls=0;const provider=new GarantiProvider(config,async()=>order,async(_url,options)=>{
  calls++;const xml=Buffer.from(options.body).toString('latin1');
  const isHistory=xml.includes('<Type>orderhistoryinq</Type>');
  const body=isHistory?response({historyRows,isHistory:true,historyCode:historyCode??(queryOptions.noRecord?'92':'00'),historyReason:historyReason??(queryOptions.noRecord?'0108':'00')}):response(queryOptions.noRecord?{outer:'92',outerReason:'0110',...queryOptions}:queryOptions);
  return new Response(body,{status:200,headers:{'content-type':'text/xml;charset=utf-8'}});
 });
 const handoffUrl=new URL((await provider.initiate({...order,state:'initiating'},id,{customerIp:'127.0.0.1'})).redirectUrl);
 order.redirectUrl=handoffUrl.toString()+'&used=1';
 let payment=null,error=null;
 try{payment=await provider.reconcileOwnedPendingOrder(id,owner,paymentProof)}catch(e){error=e}
 return{provider,calls,payment,error,evidence:provider.takeLiveReconciliationEvidence()};
}

test('Production failure mappings require explicit confirmed exact Status/Code/ReasonCode tuples',()=>{
 assert.throws(()=>garantiConfig({...env,GARANTI_LIVE_FAILED_RESULT_MAPPINGS:'DECLINED|05|00'}),/Confirm bank query failure mappings/);
 assert.throws(()=>garantiConfig({...env,GARANTI_LIVE_FAILED_RESULT_MAPPINGS:'APPROVED|00|00',GARANTI_LIVE_FAILED_RESULTS_CONFIRMED:'true'}),/Confirm bank query failure mappings/);
 assert.throws(()=>garantiConfig({...env,GARANTI_LIVE_FAILED_RESULT_MAPPINGS:'DECLINED|05|00,DECLINED|05|00',GARANTI_LIVE_FAILED_RESULTS_CONFIRMED:'true'}),/Confirm bank query status meanings/);
});

test('Paired 92/0110 and 92/0108 empty history is no-record pending even with a zero-only result shell',async()=>{
 const old={...process.env};Object.assign(process.env,{GARANTI_MODE:'PROD',VERCEL_ENV:'production',GARANTI_LIVE_CONTROLLED_ONLY:'true',GARANTI_LIVE_ALLOWED_USER_ID:owner,NEXT_PUBLIC_SUPABASE_URL:db});
 try{
  const result=await run({mapping:'',queryOptions:{noRecord:true,noRecordPlaceholder:true}});
  assert.equal(result.calls,2);assert.ok(result.error instanceof GarantiPending);assert.equal(result.payment,null);
  assert.equal(result.evidence.decision,'pending');assert.equal(result.evidence.reason,'GARANTI_BANK_RECORD_NOT_FOUND');
  assert.equal(result.evidence.status,null);assert.equal(result.evidence.auth_amount_state,'zero');
  assert.equal(result.evidence.order_result_present,true);
  assert.equal(result.evidence.history_transaction_reason_code,'0108');assert.equal(result.evidence.history_result_state,'empty');
  assert.equal(result.evidence.payment_event_count,0);assert.equal(result.evidence.signed_callback_evidence_count,0);
 }finally{for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old)}
});
test('The existing signed handoff expiry is the only close clock; active or unsubmitted handoffs are not expired',async()=>{
 const result=await run({mapping:'',queryOptions:{noRecord:true}});
 const active=await result.provider.expiredSubmittedHandoff(id,owner);
 assert.equal(active.expired,false);
 const payload=Buffer.from(JSON.stringify({id,ip:'127.0.0.1',exp:1})).toString('base64url');
 const signature=createHmac('sha256','a'.repeat(64)).update(payload).digest('hex');
 const original=order.redirectUrl;
 try {
  order.redirectUrl=`${origin}/api/payment/garanti/handoff?token=${payload}.${signature}&used=1`;
  const expired=await result.provider.expiredSubmittedHandoff(id,owner);
  assert.deepEqual(expired,{expiresAt:1,expired:true});
  order.redirectUrl=order.redirectUrl.replace('&used=1','');
  assert.equal(await result.provider.expiredSubmittedHandoff(id,owner),null);
 } finally { order.redirectUrl=original }
});

test('No-record pair remains pending when payment proof exists or either bank identity/result conflicts',async()=>{
 const old={...process.env};Object.assign(process.env,{GARANTI_MODE:'PROD',VERCEL_ENV:'production',GARANTI_LIVE_CONTROLLED_ONLY:'true',GARANTI_LIVE_ALLOWED_USER_ID:owner,NEXT_PUBLIC_SUPABASE_URL:db});
 try{
  const proof=await run({mapping:'',queryOptions:{noRecord:true},paymentProof:{payment_event_count:1,signed_callback_evidence_count:0,live_finalize_evidence_count:0}});
  const historyMismatch=await run({mapping:'',queryOptions:{noRecord:true},historyReason:'00'});
  const contradictoryAmount=await run({mapping:'',queryOptions:{noRecord:true,noRecordPlaceholder:true,noRecordAmount:'300'}});
  for(const result of [proof,historyMismatch,contradictoryAmount]){assert.equal(result.calls,2);assert.ok(result.error instanceof GarantiPending);assert.equal(result.payment,null)}
  assert.equal(proof.evidence.reason,'GARANTI_BANK_RECORD_NOT_FOUND_CONFLICTING_PAYMENT_EVIDENCE');
  assert.equal(historyMismatch.evidence.reason,'GARANTI_BANK_RECORD_NOT_FOUND_PAIR_UNCONFIRMED');
  assert.equal(contradictoryAmount.evidence.reason,'GARANTI_BANK_RECORD_NOT_FOUND_PAIR_UNCONFIRMED');
 }finally{for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old)}
});

test('Only an exact mapped failure with zero authorized amount and complete empty history finalizes as failed',async()=>{
 const old={...process.env};Object.assign(process.env,{GARANTI_MODE:'PROD',VERCEL_ENV:'production',GARANTI_LIVE_CONTROLLED_ONLY:'true',
  GARANTI_LIVE_ALLOWED_USER_ID:owner,NEXT_PUBLIC_SUPABASE_URL:db});
 try{
  const result=await run();
  assert.equal(result.calls,2);assert.equal(result.payment.status,'failed');assert.equal(result.evidence.decision,'verified_failure');
  assert.equal(result.evidence.auth_amount_state,'zero');assert.equal(result.evidence.history_http,200);
  assert.equal(result.evidence.history_result_state,'empty');assert.equal(result.evidence.history_identity_match,true);
 }finally{for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old)}
});

test('Unmapped, mismatched, nonzero, outer-error and history-record responses remain pending',async()=>{
 const old={...process.env};Object.assign(process.env,{GARANTI_MODE:'PROD',VERCEL_ENV:'production',GARANTI_LIVE_CONTROLLED_ONLY:'true',
  GARANTI_LIVE_ALLOWED_USER_ID:owner,NEXT_PUBLIC_SUPABASE_URL:db});
 try{
  const cases=[
   await run({mapping:''}),
   await run({queryOptions:{code:'12'}}),
   await run({queryOptions:{authAmount:'300'}}),
   await run({queryOptions:{outer:'0110'}}),
   await run({historyRows:'<OrderTxn><Type>S</Type><Status>DECLINED</Status><AuthAmount>0</AuthAmount></OrderTxn>'}),
  ];
  for(const result of cases){assert.equal(result.payment,null);assert.ok(result.error instanceof GarantiPending);assert.equal(result.evidence.decision,'pending')}
  assert.equal(cases[0].calls,1);assert.equal(cases[1].evidence.reason,'GARANTI_ORDERINQ_FAILURE_MAPPING_MISMATCH');
  assert.equal(cases[2].evidence.reason,'GARANTI_ORDERINQ_FAILURE_AMOUNT_CONFLICT');
  assert.equal(cases[3].evidence.reason,'GARANTI_ORDERINQ_RESPONSE_ERROR');
  assert.equal(cases[4].evidence.reason,'GARANTI_ORDERHISTORYINQ_INCOMPLETE_OR_RECORDS_PRESENT');
 }finally{for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old)}
});

test('Orderinq success alone never becomes paid through the failure reconciliation path',async()=>{
 const old={...process.env};Object.assign(process.env,{GARANTI_MODE:'PROD',VERCEL_ENV:'production',GARANTI_LIVE_CONTROLLED_ONLY:'true',
  GARANTI_LIVE_ALLOWED_USER_ID:owner,NEXT_PUBLIC_SUPABASE_URL:db});
 try{
  const result=await run({mapping:'',queryOptions:{status:'APPROVED',code:'00',reason:'00',authAmount:'300'}});
  assert.equal(result.payment,null);assert.ok(result.error instanceof GarantiPending);
  assert.equal(result.evidence.reason,'GARANTI_SIGNED_SUCCESS_RETURN_REQUIRED');
 }finally{for(const key of Object.keys(process.env))if(!(key in old))delete process.env[key];Object.assign(process.env,old)}
});
