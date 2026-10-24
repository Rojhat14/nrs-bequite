const test=require('node:test'), assert=require('node:assert/strict'),crypto=require('node:crypto');
const {loader}=require('./source-loader.cjs');
const load=loader();
const {GarantiProvider,GarantiPending}=load('src/lib/payment/garanti/adapter.ts');
const {garantiConfig,controlledLiveAccountAllowed,controlledLiveAmountAllowed,garantiLiveSingleFinalizeArmed}=load('src/lib/payment/garanti/config.ts');
const {isLiveObservationProduct,LIVE_OBSERVATION_PRODUCT_ID,LIVE_CONTROLLED_CATALOG_PRODUCT_ID,isLiveSingleFinalizeCheckout}=load('src/lib/payment/garanti/live-observation-product.ts');
const protocol=load('src/lib/payment/garanti/protocol.ts');
const id='11111111-1111-4111-8111-111111111111';
// Synthetic credentials and bank responses only; no customer/bank access data.
const env={GARANTI_MODE:'TEST',GARANTI_OOS_VERIFIED:'true',GARANTI_SITE_ORIGIN:'https://shop.example',
 GARANTI_SUCCESS_URL:'https://shop.example/api/payment/garanti/success',GARANTI_ERROR_URL:'https://shop.example/api/payment/garanti/failure',
 GARANTI_HANDOFF_SECRET:'a'.repeat(64),GARANTI_SINGLE_INSTALLMENT:'',GARANTI_CAPTURED_STATUS:'CAPTURED',GARANTI_CAPTURED_RESULT_CODE:'00',GARANTI_SALE_CHARGE_TYPE:'sales',
 GARANTI_FINAL_FAILED_STATUSES:'CANCELLED,DECLINED',GARANTI_TEST_DATABASE_ISOLATED:'true',GARANTI_TEST_SUPABASE_URL:'https://test-db.example',NEXT_PUBLIC_SUPABASE_URL:'https://test-db.example',
 GARANTI_TEST_MERCHANT_ID:'1000001',GARANTI_TEST_TERMINAL_ID:'12345678',GARANTI_TEST_USER_ID:'PROVAUT',GARANTI_TEST_PROVISION_USER:'PROVAUT',
 GARANTI_TEST_PROVISION_PASSWORD:'synthetic-password',GARANTI_TEST_QUERY_USER:'PROVAUT',GARANTI_TEST_QUERY_PASSWORD:'synthetic-query-password',
 GARANTI_TEST_STORE_KEY:'synthetic-store-key',GARANTI_TEST_FORM_URL:'https://sanalposprovtest.garantibbva.com.tr/servlet/gt3dengine',
 GARANTI_TEST_QUERY_URL:'https://sanalposprovtest.garantibbva.com.tr/VPServlet'};
const c=garantiConfig(env);
const order={id,merchantReference:id,amountMinor:12345,currency:'TRY',state:'initiating',legal:{order_summary:{buyer:{email:'synthetic@example.com'}}}};
function response(overrides={}) {
 const o={status:'CAPTURED',charge:'sales',amount:'12345',code:'00',responseCode:'00',resultCode:'00',resultReasonCode:'00',merchant:'1000001',terminal:'12345678',mode:'TEST',reference:id,...overrides};
 const mode=o.omitMode?'':`<Mode>${o.mode}</Mode>`,date=o.omitAuthDate?'':`<AuthDate>${o.authDate??'20261012'}</AuthDate>`;
 return new Response(`<GVPSResponse>${mode}<Terminal><ID>${o.terminal}</ID><MerchantID>${o.merchant}</MerchantID></Terminal><Order><OrderID>${o.reference}</OrderID><OrderInqResult><Status>${o.status}</Status><ChargeType>${o.charge}</ChargeType><Code>${o.resultCode}</Code><ReasonCode>${o.resultReasonCode}</ReasonCode><AuthAmount>${o.amount}</AuthAmount>${date}<AuthCode>123456</AuthCode><RetrefNum>987654</RetrefNum><InstallmentCnt>0</InstallmentCnt></OrderInqResult></Order><Transaction><Response><Code>${o.responseCode}</Code><ReasonCode>${o.code}</ReasonCode></Response></Transaction></GVPSResponse>`,{headers:{'content-type':'text/xml;charset=utf-8'}})
}
function signedReturn(changes={},config=c) {
 const f={...protocol.bankFields(config,order,'127.0.0.1'),clientid:config.terminalId,oid:id,authcode:'123456',procreturncode:'00',response:'Approved',mdstatus:'1',cavv:'synthetic',eci:'05',md:'synthetic',rnd:'synthetic',...changes};
 f.hashparams='clientid:oid:authcode:procreturncode:response:mdstatus:cavv:eci:md:rnd:';
 f.hash=crypto.createHash('sha1').update(Buffer.from(f.hashparams.split(':').filter(Boolean).map(n=>f[n]).join('')+config.storeKey,'latin1')).digest('base64');
 return new URLSearchParams(f).toString();
}
const headers=new Headers({'content-type':'application/x-www-form-urlencoded;charset=utf-8'});
test('Garanti configuration separates endpoints, credentials and explicit mode; activation fails closed',()=>{
 for(const changes of [{GARANTI_MODE:''},{VERCEL_ENV:'production'},{GARANTI_OOS_VERIFIED:''},{GARANTI_HANDOFF_SECRET:''},
 {GARANTI_CAPTURED_STATUS:''},{GARANTI_TEST_FORM_URL:'https://evil.example/servlet/gt3dengine'},
 {GARANTI_TEST_QUERY_URL:'https://sanalposprov.garanti.com.tr/VPServlet'},{GARANTI_TEST_TERMINAL_ID:'00012345'},
 {GARANTI_MODE:'PROD',GARANTI_LIVE_APPROVED:'true'}]) assert.throws(()=>garantiConfig({...env,...changes}));
});
test('Missing installment env uses the documented empty one-shot value in both form and request hash',()=>{
 const withoutInstallment={...env};delete withoutInstallment.GARANTI_SINGLE_INSTALLMENT;
 const config=garantiConfig(withoutInstallment);
 assert.equal(config.installment,'');
 const fields=protocol.bankFields(config,order,'127.0.0.1');
 assert.equal(fields.txninstallmentcount,'');
 assert.equal(fields.secure3dhash,protocol.initiationHash(config,order));
 for(const value of ['1','2','  ','00']) assert.throws(()=>garantiConfig({...withoutInstallment,GARANTI_SINGLE_INSTALLMENT:value}));
});
test('Controlled live eligibility is tied to one Production auth UUID and a positive small kuruş ceiling',()=>{
 const allowed='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const live={GARANTI_MODE:'PROD',VERCEL_ENV:'production',GARANTI_LIVE_CONTROLLED_ONLY:'true',GARANTI_LIVE_ALLOWED_USER_ID:allowed,GARANTI_LIVE_MAX_AMOUNT_MINOR:'5000'};
 assert.equal(controlledLiveAccountAllowed(allowed,live),true);
 assert.equal(controlledLiveAccountAllowed(allowed.toUpperCase(),live),true);
 for(const changes of [{GARANTI_LIVE_CONTROLLED_ONLY:'false'},{VERCEL_ENV:'preview'},{GARANTI_MODE:'TEST'},
  {GARANTI_LIVE_ALLOWED_USER_ID:'not-a-uuid'}]) assert.equal(controlledLiveAccountAllowed(allowed,{...live,...changes}),false);
 assert.equal(controlledLiveAccountAllowed('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',live),false);
 assert.equal(controlledLiveAccountAllowed(null,live),false);
 assert.equal(controlledLiveAmountAllowed(5000,live),true);
 assert.equal(controlledLiveAmountAllowed(5001,live),false);
 for(const changes of [{GARANTI_LIVE_MAX_AMOUNT_MINOR:''},{GARANTI_LIVE_MAX_AMOUNT_MINOR:'0'},
  {GARANTI_LIVE_MAX_AMOUNT_MINOR:'50001'},{GARANTI_LIVE_MAX_AMOUNT_MINOR:'1.5'},
  {GARANTI_LIVE_MAX_AMOUNT_MINOR:'5e3'}])
  assert.equal(controlledLiveAmountAllowed(1,{...live,...changes}),false);
});
test('Production one-order finalization arm is exact-account, exact-3-TRY and observation-only scoped',()=>{
 const allowed='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const armed={GARANTI_MODE:'PROD',VERCEL_ENV:'production',GARANTI_LIVE_CONTROLLED_ONLY:'true',GARANTI_LIVE_OBSERVATION_ONLY:'true',
  GARANTI_LIVE_ALLOWED_USER_ID:allowed,GARANTI_LIVE_MAX_AMOUNT_MINOR:'1000',NEXT_PUBLIC_SUPABASE_URL:'https://moiynemxthkmgpgnfajd.supabase.co',GARANTI_LIVE_SINGLE_FINALIZE_ARMED:'true'};
 assert.equal(garantiLiveSingleFinalizeArmed(allowed,300,armed),true);
 assert.equal(garantiLiveSingleFinalizeArmed(allowed,1000,armed),false);
 assert.equal(garantiLiveSingleFinalizeArmed('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',300,armed),false);
 for(const changes of [{GARANTI_LIVE_SINGLE_FINALIZE_ARMED:'false'},{GARANTI_LIVE_OBSERVATION_ONLY:'false'},
  {GARANTI_LIVE_MAX_AMOUNT_MINOR:'200'},{VERCEL_ENV:'preview'},{NEXT_PUBLIC_SUPABASE_URL:'https://test-db.example'}])
  assert.equal(garantiLiveSingleFinalizeArmed(allowed,300,{...armed,...changes}),false);
});
test('Live observation product is fixed to the hidden 3 TRY catalog row',()=>{
 const valid={id:LIVE_OBSERVATION_PRODUCT_ID,name:'controlled observation',description:null,price_amount:'3.00',currency:'TRY',status:'active',in_stock:true,payment_test_only:true};
 assert.equal(isLiveObservationProduct(valid),true);
 for(const changes of [{id:'other'},{price_amount:'3.01'},{currency:'USD'},{payment_test_only:false},{status:'draft'},{in_stock:false}])
  assert.equal(isLiveObservationProduct({...valid,...changes}),false);
 assert.equal(isLiveObservationProduct(null),false);
});
test('single-finalize checkout accepts only the private trial or exact public deneme SKU at 3 TRY',()=>{
 for(const productId of [LIVE_OBSERVATION_PRODUCT_ID,LIVE_CONTROLLED_CATALOG_PRODUCT_ID])
  assert.equal(isLiveSingleFinalizeCheckout([{productId,quantity:1}],300),true);
 for(const invalid of [
  {items:[{productId:'other',quantity:1}],amount:300},
  {items:[{productId:LIVE_CONTROLLED_CATALOG_PRODUCT_ID,quantity:2}],amount:300},
  {items:[{productId:LIVE_CONTROLLED_CATALOG_PRODUCT_ID,quantity:1},{productId:LIVE_OBSERVATION_PRODUCT_ID,quantity:1}],amount:300},
  {items:[{productId:LIVE_CONTROLLED_CATALOG_PRODUCT_ID,quantity:1}],amount:299},
 ]) assert.equal(isLiveSingleFinalizeCheckout(invalid.items,invalid.amount),false);
});
test('Common-payment and orderinq agent UserID values are independently configured',()=>{
 const common=protocol.bankFields(c,order,'127.0.0.1');
 assert.equal(common.terminaluserid,'PROVAUT');assert.equal(common.terminalprovuserid,'PROVAUT');
 const xml=protocol.queryXml({...c,queryAgentUserId:'QUERY_AGENT'},order,'127.0.0.1');
 assert.match(xml,/<ProvUserID>PROVAUT<\/ProvUserID>/);assert.match(xml,/<UserID>QUERY_AGENT<\/UserID>/);
 assert.equal(c.queryAgentUserId,c.userId,'TEST keeps its pre-existing default when the new variable is absent');
});
test('A controlled live trial does not claim sandbox decline/cancel completion and still requires bank query-field confirmation',()=>{
 const live={...env,GARANTI_MODE:'PROD',VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://moiynemxthkmgpgnfajd.supabase.co',
  GARANTI_SITE_ORIGIN:'https://nrsbequiteluminous.com',GARANTI_SUCCESS_URL:'https://nrsbequiteluminous.com/api/payment/garanti/success',
  GARANTI_ERROR_URL:'https://nrsbequiteluminous.com/api/payment/garanti/failure',GARANTI_OOS_VERIFIED:'true',GARANTI_LIVE_APPROVED:'true',
  GARANTI_LIVE_QUERY_FIELDS_CONFIRMED:'true',GARANTI_LIVE_CONTROLLED_ONLY:'true',GARANTI_LIVE_ALLOWED_USER_ID:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  GARANTI_LIVE_MAX_AMOUNT_MINOR:'5000',GARANTI_LIVE_MERCHANT_ID:'1000001',GARANTI_LIVE_TERMINAL_ID:'12345678',GARANTI_LIVE_USER_ID:'GARANTI',GARANTI_LIVE_QUERY_AGENT_USER_ID:'PROVAUT',
  GARANTI_LIVE_PROVISION_USER:'PROVAUT',GARANTI_LIVE_PROVISION_PASSWORD:'synthetic-live-password',GARANTI_LIVE_QUERY_USER:'PROVAUT',
  GARANTI_LIVE_QUERY_PASSWORD:'synthetic-live-query-password',GARANTI_LIVE_STORE_KEY:'synthetic-live-store-key',
  GARANTI_LIVE_FORM_URL:'https://sanalposprov.garanti.com.tr/servlet/gt3dengine',GARANTI_LIVE_QUERY_URL:'https://sanalposprov.garanti.com.tr/VPServlet'};
 delete live.GARANTI_SANDBOX_PASSED;
 const config=garantiConfig(live);assert.equal(config.mode,'PROD');assert.equal(config.initiationMaxAmountMinor,5000);
 assert.equal(config.userId,'GARANTI');assert.equal(config.queryAgentUserId,'PROVAUT');
 assert.equal(config.provisionUser,'PROVAUT');assert.equal(config.queryUser,'PROVAUT');
 const liveForm=protocol.bankFields(config,order,'127.0.0.1');
 assert.equal(liveForm.terminaluserid,'GARANTI');assert.equal(liveForm.terminalprovuserid,'PROVAUT');
 const liveQuery=protocol.queryXml(config,order,'127.0.0.1');
 assert.match(liveQuery,/<ProvUserID>PROVAUT<\/ProvUserID>/);assert.match(liveQuery,/<UserID>PROVAUT<\/UserID>/);
 assert.throws(()=>garantiConfig({...live,GARANTI_LIVE_QUERY_FIELDS_CONFIRMED:''}));
});
test('Isolated live observation keeps bank-confirmation flags false, verifies the signed return and order inquiry, and never yields paid',async()=>{
 const live={...env,GARANTI_MODE:'PROD',VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://moiynemxthkmgpgnfajd.supabase.co',
  GARANTI_SITE_ORIGIN:'https://nrsbequiteluminous.com',GARANTI_SUCCESS_URL:'https://nrsbequiteluminous.com/api/payment/garanti/success',
  GARANTI_ERROR_URL:'https://nrsbequiteluminous.com/api/payment/garanti/failure',GARANTI_OOS_VERIFIED:'false',GARANTI_LIVE_APPROVED:'false',
  GARANTI_SANDBOX_PASSED:'false',GARANTI_LIVE_QUERY_FIELDS_CONFIRMED:'false',GARANTI_LIVE_CONTROLLED_ONLY:'true',
  GARANTI_LIVE_OBSERVATION_ONLY:'true',GARANTI_LIVE_ALLOWED_USER_ID:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',GARANTI_LIVE_MAX_AMOUNT_MINOR:'5000',
  GARANTI_LIVE_MERCHANT_ID:'1000001',GARANTI_LIVE_TERMINAL_ID:'12345678',GARANTI_LIVE_USER_ID:'GARANTI',GARANTI_LIVE_QUERY_AGENT_USER_ID:'PROVAUT',
  GARANTI_LIVE_PROVISION_USER:'PROVAUT',GARANTI_LIVE_PROVISION_PASSWORD:'synthetic-live-password',GARANTI_LIVE_QUERY_USER:'PROVAUT',
  GARANTI_LIVE_QUERY_PASSWORD:'synthetic-live-query-password',GARANTI_LIVE_STORE_KEY:'synthetic-live-store-key',
  GARANTI_LIVE_FORM_URL:'https://sanalposprov.garanti.com.tr/servlet/gt3dengine',GARANTI_LIVE_QUERY_URL:'https://sanalposprov.garanti.com.tr/VPServlet',
  GARANTI_CAPTURED_STATUS:'',GARANTI_CAPTURED_RESULT_CODE:'',GARANTI_SALE_CHARGE_TYPE:'',GARANTI_FINAL_FAILED_STATUSES:''};
 const config=garantiConfig(live);assert.equal(config.liveObservationOnly,true);assert.equal(config.initiationMaxAmountMinor,5000);
 assert.throws(()=>garantiConfig({...live,GARANTI_LIVE_OBSERVATION_ONLY:'false'}));
 assert.throws(()=>garantiConfig({...live,VERCEL_ENV:'preview'}));
 assert.throws(()=>garantiConfig({...live,NEXT_PUBLIC_SUPABASE_URL:'https://dzuxhwtbuojnhibzfxqy.supabase.co'}));
 const liveOrder={...order,state:'pending'};let calls=0;const logs=[];
 const provider=new GarantiProvider(config,async()=>liveOrder,async(url,options)=>{
  calls++;assert.equal(url,config.queryUrl);assert.match(Buffer.from(options.body).toString(),/<Mode>PROD<\/Mode>/);
  return response({mode:'',omitMode:true,omitAuthDate:true,code:'',responseCode:'00',terminal:config.terminalId,merchant:config.merchantId});
 });
 const originalInfo=console.info;console.info=(value)=>logs.push(JSON.parse(value));
 try { await assert.rejects(provider.verifyReturn(signedReturn({},config),headers),GarantiPending); }
 finally { console.info=originalInfo; }
 assert.equal(calls,1);assert.equal(logs.length,2);
 assert.equal(logs[0].event,'garanti_live_return_verified');assert.equal(logs[0].signature_verified,true);
 assert.equal(logs[0].order_match,true);assert.equal(logs[0].amount_match,true);assert.equal(logs[0].currency_match,true);
 assert.equal(logs[0].terminal_match,true);assert.equal(logs[0].request_match,true);
 assert.equal(logs[1].event,'garanti_live_observation');assert.equal(logs[1].signed_return_verified,true);
 assert.equal(logs[1].order_match,true);assert.equal(logs[1].terminal_match,true);assert.equal(logs[1].amount_match,true);
 assert.equal(logs[1].mode_match,null);assert.equal(logs[1].auth_date_format,'missing');assert.equal(logs[1].order_result_success_codes_match,true);
 assert.equal(logs[1].status,'CAPTURED');assert.equal(logs[1].order_result_code,'00');assert.equal(logs[1].order_result_reason_code,'00');
 const serialized=JSON.stringify(logs);for(const secret of ['synthetic-live-password','synthetic-live-query-password','synthetic-live-store-key','123456','987654','authcode'])assert.equal(serialized.includes(secret),false);
});
test('Private live orderinq uses the PROVAUT query password/hash and performs no settlement operation',async()=>{
 const allowed='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const live={...env,GARANTI_MODE:'PROD',VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://moiynemxthkmgpgnfajd.supabase.co',
  GARANTI_SITE_ORIGIN:'https://nrsbequiteluminous.com',GARANTI_SUCCESS_URL:'https://nrsbequiteluminous.com/api/payment/garanti/success',
  GARANTI_ERROR_URL:'https://nrsbequiteluminous.com/api/payment/garanti/failure',GARANTI_LIVE_CONTROLLED_ONLY:'true',
  GARANTI_LIVE_OBSERVATION_ONLY:'true',GARANTI_LIVE_ALLOWED_USER_ID:allowed,GARANTI_LIVE_MAX_AMOUNT_MINOR:'1000',
  GARANTI_LIVE_MERCHANT_ID:'1000001',GARANTI_LIVE_TERMINAL_ID:'12345678',GARANTI_LIVE_USER_ID:'GARANTI',
  GARANTI_LIVE_PROVISION_USER:'PROVAUT',GARANTI_LIVE_PROVISION_PASSWORD:'synthetic-provision',
  GARANTI_LIVE_QUERY_USER:'PROVAUT',GARANTI_LIVE_QUERY_AGENT_USER_ID:'PROVAUT',GARANTI_LIVE_QUERY_PASSWORD:'synthetic-query',
  GARANTI_LIVE_STORE_KEY:'synthetic-store',GARANTI_LIVE_FORM_URL:'https://sanalposprov.garanti.com.tr/servlet/gt3dengine',
  GARANTI_LIVE_QUERY_URL:'https://sanalposprov.garanti.com.tr/VPServlet',GARANTI_CAPTURED_STATUS:'',
  GARANTI_CAPTURED_RESULT_CODE:'',GARANTI_SALE_CHARGE_TYPE:'',GARANTI_FINAL_FAILED_STATUSES:''};
 const config=garantiConfig(live), liveOrder={...order,userId:allowed,state:'pending',redirectUrl:null};let calls=0;
 const provider=new GarantiProvider(config,async()=>liveOrder,async(url,options)=>{
  calls++;assert.equal(url,'https://sanalposprov.garanti.com.tr/VPServlet');
  const xml=Buffer.from(options.body).toString('latin1');
  assert.match(xml,/<Mode>PROD<\/Mode>/);assert.match(xml,/<ProvUserID>PROVAUT<\/ProvUserID>/);
  assert.match(xml,/<UserID>PROVAUT<\/UserID>/);assert.match(xml,/<ID>12345678<\/ID>/);
  assert.match(xml,/<Type>orderinq<\/Type>/);assert.doesNotMatch(xml,/<Type>sales<\/Type>|CardNumber|CVV2/);
  const pass=protocol.bankHash('sha1','synthetic-query'+'012345678');
  const expected=protocol.bankHash('sha512',id+'12345678'+'12345'+'949'+pass);
  assert.match(xml,new RegExp(`<HashData>${expected}<\\/HashData>`));
  return new Response(`<GVPSResponse><Mode>PROD</Mode><Terminal><ProvUserID>PROVAUT</ProvUserID><UserID>PROVAUT</UserID><ID>12345678</ID><MerchantID>1000001</MerchantID></Terminal><Order><OrderID>${id}</OrderID><OrderInqResult><Code>00</Code><ReasonCode>00</ReasonCode><Status>APPROVED</Status><ChargeType>S</ChargeType><AuthAmount>12345</AuthAmount><AuthDate>2026-10-13 12:34:56.789</AuthDate><AuthCode>123456</AuthCode><RetrefNum>987654</RetrefNum></OrderInqResult></Order><Transaction><Response><Code>00</Code></Response></Transaction></GVPSResponse>`,{headers:{'content-type':'text/xml;charset=utf-8'}});
 });
 const signedUrl=new URL((await provider.initiate({...liveOrder,state:'initiating'},id,{customerIp:'127.0.0.1'})).redirectUrl);
 liveOrder.redirectUrl=signedUrl.toString()+'&used=1';
 const previous={GARANTI_MODE:process.env.GARANTI_MODE,VERCEL_ENV:process.env.VERCEL_ENV,GARANTI_LIVE_CONTROLLED_ONLY:process.env.GARANTI_LIVE_CONTROLLED_ONLY,
  GARANTI_LIVE_ALLOWED_USER_ID:process.env.GARANTI_LIVE_ALLOWED_USER_ID,NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL};
 Object.assign(process.env,{GARANTI_MODE:'PROD',VERCEL_ENV:'production',GARANTI_LIVE_CONTROLLED_ONLY:'true',GARANTI_LIVE_ALLOWED_USER_ID:allowed,
  NEXT_PUBLIC_SUPABASE_URL:'https://moiynemxthkmgpgnfajd.supabase.co'});
 let evidence, mismatchEvidence;
 try {
  evidence=await provider.readOnlyOrderInquiry(liveOrder,allowed,'987654');
  mismatchEvidence=await provider.readOnlyOrderInquiry(liveOrder,allowed,'000000');
 }
 finally { for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value} }
 assert.equal(calls,2);assert.equal(evidence.response_prov_user_match,true);assert.equal(evidence.response_agent_user_match,true);
 assert.equal(evidence.response_terminal_match,true);assert.equal(evidence.response_order_match,true);
 assert.equal(evidence.transaction_code,'00');assert.equal(evidence.transaction_reason_code,null);assert.equal(evidence.order_result_code,'00');assert.equal(evidence.order_result_reason_code,'00');assert.equal(evidence.auth_date_format,'timestamp');assert.equal(evidence.auth_amount_match,true);
 assert.equal(evidence.request_currency_code,'949');assert.equal(evidence.order_currency_match,true);assert.equal(evidence.reported_bank_reference_match,true);
 assert.equal(mismatchEvidence.reported_bank_reference_match,false);
 assert.equal(evidence.database_changed,false);assert.equal(evidence.sale_started,false);assert.equal(evidence.finalize_called,false);
 Object.assign(process.env,{GARANTI_MODE:'PROD',VERCEL_ENV:'production',GARANTI_LIVE_CONTROLLED_ONLY:'true',GARANTI_LIVE_ALLOWED_USER_ID:allowed,
  NEXT_PUBLIC_SUPABASE_URL:'https://moiynemxthkmgpgnfajd.supabase.co'});
 try { await assert.rejects(provider.readOnlyOrderInquiry({...liveOrder,userId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},allowed)); }
 finally { for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value} }
 assert.equal(calls,2);
 const otherQuery=garantiConfig({...live,GARANTI_LIVE_QUERY_AGENT_USER_ID:'PROVOOS'});
 const mismatch=new GarantiProvider(otherQuery,async()=>liveOrder,async()=>{calls++;throw Error('must not query')});
 Object.assign(process.env,{GARANTI_MODE:'PROD',VERCEL_ENV:'production',GARANTI_LIVE_CONTROLLED_ONLY:'true',GARANTI_LIVE_ALLOWED_USER_ID:allowed,
  NEXT_PUBLIC_SUPABASE_URL:'https://moiynemxthkmgpgnfajd.supabase.co'});
 try { await assert.rejects(mismatch.readOnlyOrderInquiry(liveOrder,allowed),/identity configuration mismatch/); }
 finally { for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value} }
 assert.equal(calls,2);
});
test('One explicitly gated Production order can reconcile through orderinq only after signed callback evidence is order-bound',async()=>{
 const target='f5bf8734-85e1-4a2f-8d04-c8d0145573ea',allowed='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const live={...env,GARANTI_MODE:'PROD',VERCEL_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://moiynemxthkmgpgnfajd.supabase.co',
  GARANTI_SITE_ORIGIN:'https://nrsbequiteluminous.com',GARANTI_SUCCESS_URL:'https://nrsbequiteluminous.com/api/payment/garanti/success',
  GARANTI_ERROR_URL:'https://nrsbequiteluminous.com/api/payment/garanti/failure',GARANTI_LIVE_CONTROLLED_ONLY:'true',
  GARANTI_LIVE_OBSERVATION_ONLY:'true',GARANTI_LIVE_ALLOWED_USER_ID:allowed,GARANTI_LIVE_MAX_AMOUNT_MINOR:'1000',
  GARANTI_LIVE_MERCHANT_ID:'1000001',GARANTI_LIVE_TERMINAL_ID:'12345678',GARANTI_LIVE_USER_ID:'GARANTI',
  GARANTI_LIVE_PROVISION_USER:'PROVAUT',GARANTI_LIVE_PROVISION_PASSWORD:'synthetic-provision',GARANTI_LIVE_QUERY_USER:'PROVAUT',
  GARANTI_LIVE_QUERY_AGENT_USER_ID:'PROVAUT',GARANTI_LIVE_QUERY_PASSWORD:'synthetic-query',GARANTI_LIVE_STORE_KEY:'synthetic-store',
  GARANTI_LIVE_FORM_URL:'https://sanalposprov.garanti.com.tr/servlet/gt3dengine',GARANTI_LIVE_QUERY_URL:'https://sanalposprov.garanti.com.tr/VPServlet',
  GARANTI_CAPTURED_STATUS:'',GARANTI_CAPTURED_RESULT_CODE:'',GARANTI_SALE_CHARGE_TYPE:'',GARANTI_FINAL_FAILED_STATUSES:''};
 const config=garantiConfig(live),liveOrder={...order,id:target,merchantReference:target,amountMinor:300,state:'pending',userId:allowed,redirectUrl:null};let calls=0;
 const provider=new GarantiProvider(config,async()=>liveOrder,async(url,options)=>{
  calls++;assert.equal(url,config.queryUrl);assert.match(Buffer.from(options.body).toString(),/<Type>orderinq<\/Type>/);
  assert.doesNotMatch(Buffer.from(options.body).toString(),/<Type>sales<\/Type>/);
  return response({mode:'',omitMode:true,amount:'300',status:'APPROVED',charge:'S',code:'',responseCode:'00',authDate:'2026-10-13 12:34:56.789',terminal:config.terminalId,merchant:config.merchantId,reference:target});
 });
 const handoffUrl=new URL((await provider.initiate({...liveOrder,state:'initiating'},target,{customerIp:'127.0.0.1'})).redirectUrl);
 liveOrder.redirectUrl=handoffUrl.toString()+'&used=1';
 const keys=['GARANTI_MODE','VERCEL_ENV','GARANTI_LIVE_CONTROLLED_ONLY','GARANTI_LIVE_ALLOWED_USER_ID','NEXT_PUBLIC_SUPABASE_URL','GARANTI_LIVE_SINGLE_FINALIZE_ORDER_ID','GARANTI_LIVE_VERIFIED_CALLBACK_ORDER_ID'];
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));Object.assign(process.env,{GARANTI_MODE:'PROD',VERCEL_ENV:'production',GARANTI_LIVE_CONTROLLED_ONLY:'true',
  GARANTI_LIVE_ALLOWED_USER_ID:allowed,NEXT_PUBLIC_SUPABASE_URL:'https://moiynemxthkmgpgnfajd.supabase.co',GARANTI_LIVE_SINGLE_FINALIZE_ORDER_ID:target,GARANTI_LIVE_VERIFIED_CALLBACK_ORDER_ID:target});
 try {
  const verified=await provider.verifyAuthorizedExistingLiveOrder(target,allowed);
  assert.equal(verified.status,'paid');assert.equal(verified.threeDS,'authenticated');assert.equal(verified.amountMinor,300);assert.equal(verified.currency,'TRY');
  await assert.rejects(provider.verifyAuthorizedExistingLiveOrder(target,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'));
  await assert.rejects(provider.verifyAuthorizedExistingLiveOrder(id,allowed));
 } finally { for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value} }
 assert.equal(calls,1);
});
test('ISO-8859-9 hash encoding uses Turkish bytes and rejects replacement characters',()=>{
 assert.deepEqual([...protocol.isoBytes('ĞİŞğış')],[208,221,222,240,253,254]);
 assert.throws(()=>protocol.isoBytes('😀'));assert.throws(()=>protocol.isoBytes('Ð'));
 assert.equal(protocol.bankHash('sha512','İş'),crypto.createHash('sha512').update(Buffer.from([221,254])).digest('hex').toUpperCase());
});
test('Hosted form contains sales/TRY/512/3D_OOS_PAY; no card data, password or StoreKey',()=>{
 const fields=protocol.bankFields(c,order,'127.0.0.1');
 assert.equal(fields.txntype,'sales');assert.equal(fields.txnamount,'12345');assert.equal(fields.txncurrencycode,'949');assert.equal(fields.apiversion,'512');
 assert.equal(fields.secure3dsecuritylevel,'3D_OOS_PAY');
 const json=JSON.stringify(fields);for(const secret of [c.storeKey,c.provisionPassword,c.queryPassword])assert.equal(json.includes(secret),false);
 for(const key of Object.keys(fields))assert.equal(/cardnumber|cvv|password|storekey/i.test(key),false);
 const hp=crypto.createHash('sha1').update(c.provisionPassword+'012345678').digest('hex').toUpperCase();
 const expected=crypto.createHash('sha512').update('12345678'+id+'12345'+'949'+c.successUrl+c.errorUrl+'sales'+''+c.storeKey+hp).digest('hex').toUpperCase();
 assert.equal(fields.secure3dhash,expected);
});
test('Initiation never calls bank; server-signed handoff rejects tampering, stale token and invalid order',async()=>{
 let calls=0;const p=new GarantiProvider(c,async()=>order,async()=>{calls++;return response()});
 const redirect=await p.initiate(order,id,{customerIp:'127.0.0.1'});assert.equal(calls,0);
 const token=new URL(redirect.redirectUrl).searchParams.get('token');assert.equal(p.handoff(token).id,id);
 assert.throws(()=>p.handoff(token+'a'));
 const now=Date.now;Date.now=()=>now()+1000000;try{assert.throws(()=>p.handoff(token));assert.equal(p.handoff(token,true).id,id)}finally{Date.now=now}
 for(const change of [{currency:'USD'},{amountMinor:1.5},{state:'paid'}])await assert.rejects(p.initiate({...order,...change},id,{customerIp:'127.0.0.1'}));
 await assert.rejects(p.initiate(order,id,{customerIp:'bad'}));
});
test('Signed return plus authenticated orderinq capture is required before paid; identical repeats dedupe and callbacks remain stable',async()=>{
 let calls=0;const p=new GarantiProvider(c,async()=>order,async(url,options)=>{
  calls++;assert.equal(url,c.queryUrl);assert.equal(options.redirect,'error');
  const body=Buffer.from(options.body).toString();assert.match(body,/<Type>orderinq<\/Type>/);assert.doesNotMatch(body,/synthetic-query-password|CardNumber/);
  return response();
 });
 const a=await p.verifyReturn(signedReturn(),headers),b=await p.verifyReturn(signedReturn(),headers);
 const repeatedField=await p.verifyReturn(signedReturn()+'&terminalid=12345678',headers);
 assert.equal(a.status,'paid');assert.equal(a.threeDS,'authenticated');assert.deepEqual(a,b);assert.deepEqual(a,repeatedField);assert.equal(calls,3);
 await assert.rejects(p.verifyReturn(signedReturn()+'&terminalid=87654321',headers),error=>error instanceof protocol.GarantiReturnParseError&&error.code==='duplicate_field');
 const tampered=new URLSearchParams(signedReturn());tampered.set('hash','invalid');
 await assert.rejects(p.verifyReturn(tampered.toString(),headers));
 assert.equal(calls,3,'conflicting duplicates and invalid signatures must not query or settle');
});
test('Bad signatures, unsigned status, changed amount/currency/order/terminal cannot reach paid',async()=>{
 for(const changes of [{hashparamsval:'attacker'},{txnamount:'1'},{txncurrencycode:'840'},{clientid:'87654321'},
 {orderid:'22222222-2222-4222-8222-222222222222'},{secure3dhash:'a'.repeat(128)},{mdstatus:'2'},{procreturncode:'05'}]){
  const p=new GarantiProvider(c,async()=>order,async()=>response());
  if(Object.hasOwn(changes,'hashparamsval')) assert.equal((await p.verifyReturn(signedReturn(changes),headers)).status,'paid');
  else await assert.rejects(p.verifyReturn(signedReturn(changes),headers));
 }
 const p=new GarantiProvider(c,async()=>order,async()=>{throw Error('must not call bank')});
 await assert.rejects(p.verifyReturn(signedReturn().replace(/hash=[^&]+/,'hash=bad'),headers));
 await assert.rejects(p.verifyReturn(signedReturn()+'&oid='+id,headers));
});
test('Query rejects mismatched capture, preauthorization, identity, unknown status and timeouts',async()=>{
 for(const change of [{amount:'1'},{status:'UNKNOWN'},{charge:'preauth'},{terminal:'87654321'},{mode:'PROD'},{code:'05'},{reference:'unknown'}]){
  const p=new GarantiProvider(c,async()=>order,async()=>response(change));await assert.rejects(p.verifyReturn(signedReturn(),headers));
 }
 const p=new GarantiProvider(c,async()=>order,async()=>{throw Error('timeout')});
 await assert.rejects(p.verifyReturn(signedReturn(),headers),GarantiPending);
});
test('TEST capture accepts omitted Mode/AuthDate/ReasonCode only with independent bank evidence; explicit conflicts/errors fail closed',async()=>{
 const config={...c,observationOnly:false};
 const missing=new GarantiProvider(config,async()=>order,async()=>response({omitMode:true,omitAuthDate:true,code:'',responseCode:''}));
 const verified=await missing.verifyReturn(signedReturn({},config),headers);
 assert.equal(verified.status,'paid');assert.equal(verified.threeDS,'authenticated');
 for(const change of [{mode:'PROD'},{code:'05'},{responseCode:'05'}]){
  const provider=new GarantiProvider(config,async()=>order,async()=>response(change));
  await assert.rejects(provider.verifyReturn(signedReturn({},config),headers));
 }
 const invalidDate=new GarantiProvider(config,async()=>order,async()=>response({authDate:'invalid'}));
 await assert.rejects(invalidDate.verifyReturn(signedReturn({},config),headers));
 const production={...config,mode:'PROD',queryUrl:'https://sanalposprov.garanti.com.tr/VPServlet'};
 for(const change of [{mode:'TEST'},{mode:'PROD',resultReasonCode:''},{mode:'PROD',authDate:'20260230'}]){
  const live=new GarantiProvider(production,async()=>order,async()=>response(change));
  await assert.rejects(live.verifyReturn(signedReturn({},production),headers));
 }
 const fullTimestamp=new GarantiProvider(production,async()=>order,async()=>response({omitMode:true,authDate:'2026-10-13 12:34:56.789',code:''}));
 assert.equal((await fullTimestamp.verifyReturn(signedReturn({},production),headers)).status,'paid');
});
test('Single-finalize TEST verification exposes only safe signature and same-query evidence once',async()=>{
 const isolated=garantiConfig({...observationEnv(),GARANTI_TEST_SINGLE_FINALIZE_ONLY:'true'});
 const settlement={...isolated,observationOnly:false,capturedStatus:'APPROVED',capturedResultCode:'00',saleChargeType:'S',failedStatuses:[]};
 const p=new GarantiProvider(settlement,async()=>({...order,state:'pending'}),async()=>response({status:'APPROVED',charge:'S',mode:'',omitAuthDate:true,code:'',responseCode:'00',terminal:settlement.terminalId,merchant:settlement.merchantId}));
 const result=await p.verifyReturn(signedReturn({},isolated),headers);assert.equal(result.status,'paid');
 const evidence=p.takeSuccessfulTestReturnEvidence();assert.equal(evidence.order_id,id);assert.equal(evidence.signature_verified,true);
 for(const key of ['order_match','amount_match','currency_match','terminal_match','request_match'])assert.equal(evidence[key],true);
 assert.equal(evidence.query_evidence.http,200);assert.equal(evidence.query_evidence.mode_evidence,'test_endpoint_and_request');
 assert.equal(evidence.query_evidence.identity_match,true);assert.equal(evidence.query_evidence.amount_match,true);assert.equal(evidence.query_evidence.auth_match,true);
 assert.equal(evidence.query_evidence.status,'APPROVED');assert.equal(evidence.query_evidence.charge_type,'S');assert.equal(evidence.query_evidence.result_code,'00');
 assert.equal(evidence.query_evidence.auth_code_present,true);assert.equal(evidence.query_evidence.bank_reference_present,true);
 assert.equal(p.takeSuccessfulTestReturnEvidence(),null);
 const json=JSON.stringify(evidence);for(const secret of ['123456','987654',settlement.storeKey,settlement.queryPassword,'authcode'])assert.equal(json.includes(secret),false);
});
test('Bank-confirmed final cancellation/decline with zero capture becomes failed, not paid',async()=>{
 for(const status of ['CANCELLED','DECLINED']){
  const p=new GarantiProvider(c,async()=>order,async()=>response({status,amount:'0'}));
  assert.equal((await p.verifyReturn(signedReturn({procreturncode:'05'}),headers)).status,'failed');
 }
 const p=new GarantiProvider(c,async()=>order,async()=>response({status:'CANCELLED',amount:'12345'}));
 await assert.rejects(p.verifyReturn(signedReturn(),headers),GarantiPending);
});
test('Query parsing rejects entity expansion, repeated identity tags and malformed XML',()=>{
 assert.throws(()=>protocol.parseQuery('<!DOCTYPE a [<!ENTITY x "bad">]><GVPSResponse>&x;</GVPSResponse>'));
 assert.throws(()=>protocol.parseQuery('<GVPSResponse>'));
 const q=protocol.parseQuery('<GVPSResponse><Mode>TEST</Mode><Mode>PROD</Mode></GVPSResponse>');assert.throws(()=>protocol.scalar(q.Mode));
});
test('Bank return endpoints are POST-only and independent of cookies; handoff has owner/CAS/CSRF checks',()=>{
 const fs=require('fs');
 const handler=fs.readFileSync('src/lib/payment/garanti/return-handler.ts','utf8');assert.doesNotMatch(handler,/auth\.getUser|cookies\(/);
 for(const path of ['success','failure']){const code=fs.readFileSync(`src/app/api/payment/garanti/${path}/route.ts`,'utf8');assert.match(code,/POST = garantiReturn/);assert.doesNotMatch(code,/export.*GET/)}
 const route=fs.readFileSync('src/app/api/payment/garanti/handoff/route.ts','utf8');assert.match(route,/user\?\.id === order\.userId/);assert.match(route,/guestTokenMatchesHash\(guestToken, order\.guestHash\)/);assert.match(route,/sameOrigin\(request\)/);assert.match(route,/claimGarantiHandoff/);
});
test('Return encoding handles bank ISO-8859-9 bytes, dedupes identical repeats, rejects conflicts and missing signatures',()=>{
 const isoHeaders=new Headers({'content-type':'application/x-www-form-urlencoded;charset=iso-8859-9'});
 assert.equal(protocol.parseReturn('name=%DD%FE',isoHeaders).name,'İş');
 const identical=protocol.parseReturn('terminalid=12345678&terminalid=12345678',headers,{allowIdenticalDuplicates:true});
 assert.equal(identical.terminalid,'12345678');
 assert.throws(()=>protocol.parseReturn('terminalid=12345678&terminalid=87654321',headers,{allowIdenticalDuplicates:true}),error=>error.code==='duplicate_field');
 assert.throws(()=>protocol.parseReturn('oid=x&oid=y',headers));
 assert.throws(()=>protocol.parseReturn('oid=%xx',headers));
 assert.throws(()=>protocol.verifyReturnHash(c,{hashparams:'oid:',oid:id,hash:'a'.repeat(128)}));
});
test('Atomic handoff compare-and-set lets only one of simultaneous requests send a bank form',async()=>{
 let stored='https://shop.example/handoff';
 const db={from(){const change={};return {update(v){change.value=v;return this},eq(name,value){change[name]=value;return this},async select(){
  if(change.redirect_url!==stored)return {data:[],error:null};stored=change.value.redirect_url;return {data:[{order_id:id}],error:null};
 }}}};
 const {claimGarantiHandoff}=loader({'@/lib/payment/repository':{paymentDatabase:()=>db}})('src/lib/payment/garanti/order.ts');
 const original=stored;const result=await Promise.allSettled([claimGarantiHandoff(order,original),claimGarantiHandoff(order,original)]);
 assert.equal(result.filter(x=>x.status==='fulfilled').length,1);assert.equal(result.filter(x=>x.status==='rejected').length,1);assert.match(stored,/used=1$/);
});
test('Reconciliation never turns a capture into paid without signed 3DS proof',async()=>{
 let saved;const p=new GarantiProvider(c,async()=>({...order,redirectUrl:saved}),async()=>response());
 saved=(await p.initiate(order,id,{customerIp:'127.0.0.1'})).redirectUrl+'&used=1';
 await assert.rejects(p.reconcile(id),GarantiPending);
});
test('Garanti customer metadata is rejected before any repository side effect',async()=>{
 const {initiatePayment}=load('src/lib/payment/service.ts');
 const {createLegalAcceptance}=load('src/lib/legal/acceptance.ts');
 const base={items:[{productId:'product',variantId:'44444444-4444-4444-8444-444444444444',quantity:1}],
  customer:{firstName:'Test',lastName:'Alıcı',email:'test@example.com',phone:'905551234567',address:'Beytepe',city:'Ankara',district:'Çankaya',postalCode:''},
  quoteHash:'a'.repeat(64),idempotencyKey:id,contractAccepted:true};
 const request={...base,...createLegalAcceptance(true)};
 let calls=0;const repo={findExisting(){calls++;throw Error('must not access database')}};
 const provider={name:'garanti-oos'};
 await assert.rejects(initiatePayment(request,'user',null,repo,provider,{customerIp:'bad'}));
 await assert.rejects(initiatePayment({...request,customer:{...request.customer,email:'a'.repeat(65)+'@example.com'}},'user',null,repo,provider,{customerIp:'127.0.0.1'}));
 assert.equal(calls,0);
});
test('POST return handler finalizes only verified capture without any session cookie; timeout does not finalize',async()=>{
 let finalized=0;
 const p=new GarantiProvider(c,async()=>order,async()=>response());
 const mocks={
  'next/server':{NextResponse:{redirect:(url,status)=>Response.redirect(url,status)}},
  '@/lib/payment/provider':{paymentAvailable:()=>true,getPaymentProvider:()=>p},
  '@/lib/payment/repository':{createPaymentRepository:()=>({finalizeAtomic:async result=>{assert.equal(result.status,'paid');finalized++}})},
  './adapter':{GarantiProvider,GarantiPending}
 };
 const {garantiReturn}=loader(mocks)('src/lib/payment/garanti/return-handler.ts');
 const request=()=>new Request(c.successUrl,{method:'POST',headers,body:signedReturn()});
 const r=await garantiReturn(request());assert.equal(r.status,303);assert.match(r.headers.get('location'),/checkout\/verify/);assert.equal(finalized,1);
 p.verifyReturn=async()=>{throw new GarantiPending(id)};
 assert.match((await garantiReturn(request())).headers.get('location'),/checkout\/verify/);assert.equal(finalized,1);
 p.verifyReturn=async()=>{throw Error('bad signature')};
 assert.match((await garantiReturn(request())).headers.get('location'),/checkout\/failure/);assert.equal(finalized,1);
});
test('Live failure callback emits safe signature diagnostics while preserving observation-only handling',async()=>{
 const provider=new GarantiProvider({...c,mode:'PROD',liveObservationOnly:true,observationOnly:false});
 provider.verifyReturn=async()=>{throw new protocol.ReturnSignatureError('hash_mismatch')};let finalized=0;const warnings=[],infos=[];
 const mocks={
  'next/server':{NextResponse:{redirect:(url,status)=>Response.redirect(url,status)}},
  '@/lib/payment/provider':{paymentAvailable:()=>true,getPaymentProvider:()=>provider},
  '@/lib/payment/repository':{createPaymentRepository:()=>({finalizeAtomic:async()=>{finalized++}})},
  './adapter':{GarantiProvider,GarantiPending},'./protocol':protocol,
  './diagnostics':{diagnoseLiveReturn:(_provider,_raw,_headers,code)=>({rejection_code:code,signature_verified:false,signature_result:'hash_mismatch',finalize_called:false})},
 };
 const {garantiReturn}=loader(mocks)('src/lib/payment/garanti/return-handler.ts');
 const oldWarn=console.warn,oldInfo=console.info;console.warn=value=>warnings.push(String(value));console.info=value=>infos.push(String(value));let response;
 try { response=await garantiReturn(new Request('https://shop.example/api/payment/garanti/failure',{
  method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'response=Declined&hash=redacted'})) }
 finally { console.warn=oldWarn;console.info=oldInfo }
 const location=new URL(response.headers.get('location'));assert.equal(location.pathname,'/checkout/failure');
 assert.equal(location.searchParams.get('code'),'GARANTI_FAILURE_RETURN_SIGNATURE_HASH_MISMATCH');
 assert.equal(finalized,0);assert.deepEqual(warnings.map(v=>JSON.parse(v)),[{event:'garanti_live_return_rejected',code:'GARANTI_FAILURE_RETURN_SIGNATURE_HASH_MISMATCH'}]);
 assert.deepEqual(infos.map(v=>JSON.parse(v)),[{event:'garanti_live_return_diagnostic',source:'failure',rejection_code:'GARANTI_FAILURE_RETURN_SIGNATURE_HASH_MISMATCH',signature_verified:false,signature_result:'hash_mismatch',finalize_called:false}]);
 assert.equal(warnings.join('').includes('Declined'),false);assert.equal(warnings.join('').includes('redacted'),false);
 assert.equal(infos.join('').includes('Declined'),false);assert.equal(infos.join('').includes('redacted'),false);
});
test('Unconfigured HTTPS test setup can never activate in Production or with a live DB/service key/write flags',()=>{
 const {isGarantiTestSetup}=load('src/lib/payment/garanti/test-setup.ts');
 const setup={GARANTI_TEST_SETUP_ONLY:'true',GARANTI_MODE:'TEST',NEXT_PUBLIC_SUPABASE_URL:'https://nrs-garanti-test-unconfigured.invalid',
  PAYMENT_ENABLED:'false',PAYMENT_DATABASE_VERIFIED:'false',ORDER_DATABASE_VERIFIED:'false'};
 assert.equal(isGarantiTestSetup(setup),true);
 for(const changes of [{VERCEL_ENV:'production'},{GARANTI_MODE:'PROD'},{NEXT_PUBLIC_SUPABASE_URL:'https://live-db.example'},
  {SUPABASE_SERVICE_ROLE_KEY:'synthetic'},{PAYMENT_ENABLED:'true'},{PAYMENT_DATABASE_VERIFIED:'true'},{ORDER_DATABASE_VERIFIED:'true'}])
  assert.equal(isGarantiTestSetup({...setup,...changes}),false);
});
function observationEnv(){const origin='https://nrs-bequite-garanti-test.vercel.app',db='https://dzuxhwtbuojnhibzfxqy.supabase.co';
 return {...env,GARANTI_TEST_OBSERVATION_ONLY:'true',VERCEL_ENV:'preview',GARANTI_OOS_VERIFIED:'false',
 GARANTI_SITE_ORIGIN:origin,GARANTI_SUCCESS_URL:origin+'/api/payment/garanti/success',GARANTI_ERROR_URL:origin+'/api/payment/garanti/failure',
 NEXT_PUBLIC_SUPABASE_URL:db,GARANTI_TEST_SUPABASE_URL:db,GARANTI_TEST_MERCHANT_ID:'7000679',GARANTI_TEST_TERMINAL_ID:'30691297',
 GARANTI_CAPTURED_STATUS:'',GARANTI_CAPTURED_RESULT_CODE:'',GARANTI_SALE_CHARGE_TYPE:'',GARANTI_FINAL_FAILED_STATUSES:''};
}
test('Observation without settlement mappings is restricted to the specific isolated Preview, TEST terminal and DB',()=>{
 assert.equal(garantiConfig(observationEnv()).observationOnly,true);
 for(const changes of [{VERCEL_ENV:'production'},{GARANTI_MODE:'PROD'},{GARANTI_SITE_ORIGIN:'https://other.example'},
 {NEXT_PUBLIC_SUPABASE_URL:'https://live.example'},{GARANTI_TEST_TERMINAL_ID:'12345678'},{GARANTI_TEST_MERCHANT_ID:'1000001'},
 {GARANTI_TEST_DATABASE_ISOLATED:'false'}])assert.throws(()=>garantiConfig({...observationEnv(),...changes}));
});
test('Single TEST finalization switch is available only inside the isolated observation Preview',()=>{
 const enabled=garantiConfig({...observationEnv(),GARANTI_TEST_SINGLE_FINALIZE_ONLY:'true'});
 assert.equal(enabled.observationOnly,true);assert.equal(enabled.singleFinalizeTest,true);
 for(const changes of [{VERCEL_ENV:'production'},{GARANTI_MODE:'PROD'},{GARANTI_SITE_ORIGIN:'https://other.example'},
  {NEXT_PUBLIC_SUPABASE_URL:'https://live.example'},{GARANTI_TEST_DATABASE_ISOLATED:'false'}])
  assert.throws(()=>garantiConfig({...observationEnv(),GARANTI_TEST_SINGLE_FINALIZE_ONLY:'true',...changes}));
});
test('Only the database-claimed single TEST order uses signed-return and orderinq auto-finalize; other orders remain observed',async()=>{
 const config=garantiConfig({...observationEnv(),GARANTI_TEST_SINGLE_FINALIZE_ONLY:'true'});
 const stored={...order,userId:'synthetic-user',state:'pending'};
 const finalizedEvents=new Set();let rpcCalls=0,diagnostics=0,bankCalls=0;const savedDiagnostics=[];
 const mocks={
  'next/server':{NextResponse:{redirect:(url,status)=>Response.redirect(url,status)}},
  '@/lib/payment/provider':{paymentAvailable:()=>true,getPaymentProvider:()=>provider},
  '@/lib/payment/repository':{createPaymentRepository:()=>({finalizeAtomic:async payment=>{rpcCalls++;assert.equal(payment.status,'paid');finalizedEvents.add(payment.eventId)}})},
  './order':{loadGarantiOrder:async()=>stored,isGarantiSingleFinalizeOrder:async candidate=>candidate.userId==='synthetic-user'&&candidate.id===id},
  './diagnostics':{diagnoseTestReturn:async(_provider,_raw,_headers,_source,evidence)=>{
    diagnostics++;assert.equal(evidence?.order_id,id);assert.equal(evidence?.signature_verified,true);
    assert.equal(evidence?.query_evidence?.status,'APPROVED');assert.equal(evidence?.query_evidence?.result_code,'00');
    return {order_id:id,signature_verified:true,association:'verified',query_stage:'matched',query_evidence:evidence.query_evidence};
   },saveTestDiagnostic:async diagnostic=>{savedDiagnostics.push(diagnostic)}},
 };
 const isolated=loader(mocks),{GarantiProvider:TestProvider}=isolated('src/lib/payment/garanti/adapter.ts');
 const provider=new TestProvider(config,async()=>stored,async()=>response({status:'APPROVED',charge:'S',mode:'',omitAuthDate:true,code:'',responseCode:'00',terminal:config.terminalId,merchant:config.merchantId}));
 mocks['@/lib/payment/provider'].getPaymentProvider=()=>provider;
 const {garantiReturn}=isolated('src/lib/payment/garanti/return-handler.ts');
 const request=body=>new Request(config.successUrl,{method:'POST',headers,body});
 const originalFetch=global.fetch;
 global.fetch=async()=>{bankCalls++;return response({status:'APPROVED',charge:'S',mode:'',omitAuthDate:true,code:'',responseCode:'00',terminal:config.terminalId,merchant:config.merchantId})};
 try {
 const result=await garantiReturn(request(signedReturn({},config)));
 assert.equal(result.status,303);assert.match(result.headers.get('location'),/checkout\/verify/);
 assert.equal(rpcCalls,1,'RPC calls');assert.equal(bankCalls,1,'Bank calls');assert.equal(diagnostics,1,'diagnostic calls');assert.equal(savedDiagnostics.length,1,'safe diagnostics saved');assert.equal(finalizedEvents.size,1,'unique event IDs');
 assert.equal(savedDiagnostics[0].query_evidence.auth_code_present,true);assert.equal(savedDiagnostics[0].query_evidence.bank_reference_present,true);
 await garantiReturn(request(signedReturn({},config)));
 assert.equal(rpcCalls,2);assert.equal(bankCalls,2);assert.equal(diagnostics,2);assert.equal(finalizedEvents.size,1);
 mocks['./order'].isGarantiSingleFinalizeOrder=async()=>false;
 await garantiReturn(request(signedReturn({},config)));
 assert.equal(rpcCalls,2);assert.equal(diagnostics,3);
 await garantiReturn(request(signedReturn({txnamount:'1'},config)));
 assert.equal(rpcCalls,2);assert.equal(diagnostics,4);
 } finally {global.fetch=originalFetch}
});
test('Even a valid signed return and successful bank query remain pending in observation mode',async()=>{
 const config=garantiConfig(observationEnv());let calls=0;
 const provider=new GarantiProvider(config,async()=>order,async()=>{calls++;return response({terminal:config.terminalId,merchant:config.merchantId})});
 await assert.rejects(provider.verifyReturn(signedReturn({},config),headers),GarantiPending);assert.equal(calls,1);
 const {validateVerifiedPayment}=load('src/lib/payment/service.ts');
 assert.throws(()=>validateVerifiedPayment({status:'paid'},provider),/cannot settle/);
});
test('Observation POST return cannot finalize, even if a provider unexpectedly returns paid or the body is invalid',async()=>{
 const p=new GarantiProvider(garantiConfig(observationEnv()),async()=>order,async()=>response());let finalized=0;
 const handler=loader({'next/server':{NextResponse:{redirect:(url,status)=>Response.redirect(url,status)}},
 '@/lib/payment/provider':{paymentAvailable:()=>true,getPaymentProvider:()=>p},
 '@/lib/payment/repository':{createPaymentRepository:()=>({finalizeAtomic:async()=>{finalized++}})},
 './adapter':{GarantiProvider,GarantiPending},
 './diagnostics':{diagnoseTestReturn:async()=>({order_id:null,association:'unassociated'}),saveTestDiagnostic:async()=>{}}})('src/lib/payment/garanti/return-handler.ts').garantiReturn;
 p.verifyReturn=async()=>({status:'paid',merchantReference:id});
 assert.equal((await handler(new Request(p.config.successUrl,{method:'POST',headers,body:'x=y'}))).status,303);
 p.verifyReturn=async()=>{throw Error('unsigned cancellation')};
 const result=await handler(new Request(p.config.errorUrl,{method:'POST',headers,body:'x=y'}));
 assert.match(result.headers.get('location'),/checkout\/failure/);assert.equal(finalized,0);
});

test('Observed TEST bank response with empty Mode/ReasonCode is traced but cannot settle',async()=>{
 const config=garantiConfig(observationEnv()),logs=[],original=console.info;
 console.info=value=>logs.push(JSON.parse(value));
 try {
  const provider=new GarantiProvider(config,async()=>order,async()=>new Response(
   `<GVPSResponse><Mode></Mode><Terminal><ID>${config.terminalId}</ID><MerchantID>${config.merchantId}</MerchantID></Terminal><Order><OrderID>${id}</OrderID><OrderInqResult><Status>APPROVED</Status><ChargeType>S</ChargeType><Code>00</Code><AuthAmount>${order.amountMinor}</AuthAmount><AuthCode>secret-auth</AuthCode><RetrefNum>secret-ref</RetrefNum></OrderInqResult></Order><Transaction><Response><Code>00</Code><ReasonCode></ReasonCode></Response></Transaction></GVPSResponse>`,{headers:{'content-type':'text/xml;charset=utf-8'}}));
  await assert.rejects(provider.verifyReturn(signedReturn({},config),headers));
  assert.equal(logs[0].mode_evidence,'test_endpoint_and_request');assert.equal(logs[0].identity_match,true);
  assert.equal(logs[0].status,'APPROVED');assert.equal(logs[0].charge_type,'S');assert.equal(logs[0].reason_code,'');
  assert.equal(logs[0].amount_match,true);assert.equal(provider.settlementDisabled,true);
  const text=JSON.stringify(logs);for(const value of [id,'secret-auth','secret-ref',config.storeKey])assert.equal(text.includes(value),false);
 } finally {console.info=original}
});

test('TEST query evidence uses fixed endpoint context; contradictory echoes and LIVE mismatches remain rejected',async()=>{
 const {testQueryEvidence}=load('src/lib/payment/garanti/query-evidence.ts'),config=garantiConfig(observationEnv());
 const q={Terminal:{ID:config.terminalId,MerchantID:config.merchantId},Order:{OrderID:id,OrderInqResult:{AuthAmount:String(order.amountMinor),AuthCode:'synthetic',RetrefNum:'synthetic'}}};
 for(const Mode of [undefined,'','TEST'])assert.equal(testQueryEvidence(config,order,{...q,Mode},200,'synthetic').identity_match,true);
 for(const Mode of ['PROD','UNKNOWN',['TEST','TEST'],{}])assert.equal(testQueryEvidence(config,order,{...q,Mode},200).identity_match,false);
 for(const changed of [{mode:'PROD'},{observationOnly:false},{queryUrl:'https://evil.example/VPServlet'},{queryUrl:'https://sanalposprov.garanti.com.tr/VPServlet'}])assert.throws(()=>testQueryEvidence({...config,...changed},order,q,200));
 assert.equal(testQueryEvidence(config,order,{...q,Terminal:{...q.Terminal,ID:'87654321'}},200).identity_match,false);
 assert.equal(testQueryEvidence(config,order,{...q,Order:{...q.Order,OrderID:'different'}},200).identity_match,false);
 assert.equal(testQueryEvidence(config,order,{...q,Order:{...q.Order,OrderInqResult:{...q.Order.OrderInqResult,AuthAmount:'1'}}},200).amount_match,false);
 assert.equal(testQueryEvidence(config,order,q,200,'different').auth_match,false);
 const strictConfig={...c,mode:'PROD',queryUrl:'https://sanalposprov.garanti.com.tr/VPServlet'};
 const strict=new GarantiProvider(strictConfig,async()=>order,async()=>response({mode:''}));assert.equal((await strict.verifyReturn(signedReturn({},strictConfig),headers)).status,'paid');
 const contradictoryMode=new GarantiProvider(strictConfig,async()=>order,async()=>response({mode:'TEST'}));await assert.rejects(contradictoryMode.verifyReturn(signedReturn({},strictConfig),headers));
 let calls=0;const wrong=new GarantiProvider({...config,queryUrl:'https://evil.example/VPServlet'},async()=>order,async()=>{calls++;return response()});await assert.rejects(wrong.observeQuery(order,'127.0.0.1'));assert.equal(calls,0);
});

test('Canonicalization of identical TEST values leaves the signature scalar unchanged; contradictions never reach query',async()=>{
 const config=garantiConfig(observationEnv());let calls=0;
 const p=new GarantiProvider(config,async()=>order,async()=>{calls++;return response({terminal:config.terminalId,merchant:config.merchantId})});
 const body=signedReturn({},config);
 await assert.rejects(p.verifyReturn(body+'&response=Approved&txnamount=12345&oid='+id,headers),GarantiPending);assert.equal(calls,1);
 for(const tail of ['&response=Declined','&oid=other','&txnamount=1','&response=Declined&response=Approved'])await assert.rejects(p.verifyReturn(body+tail,headers));
 assert.equal(calls,1);
 const normal=new GarantiProvider(c,async()=>order,async()=>{throw Error('No query')});await assert.rejects(normal.verifyReturn(signedReturn()+'&response=Approved',headers));
});

test('Official return SHA1 Base64 vector covers hashparams order, absent-empty fields, form decoding and literal StoreKey',()=>{
 const names=['clientid','oid','authcode','procreturncode','response','mdstatus','cavv','eci','md','rnd'];
 const fields={clientid:'12345678',oid:id,authcode:'123456',procreturncode:'00',response:'Approved',mdstatus:'1',cavv:'',eci:'',md:'',rnd:'a+b c%20'};
 const prefix=Buffer.from(names.map(n=>fields[n]).join(''),'ascii');
 const config={...c,storeKey:'ĞİŞğış'};
 const expected=crypto.createHash('sha1').update(Buffer.concat([prefix,Buffer.from([208,221,222,240,253,254])])).digest('base64');
 const signed={...fields,hashparams:names.join(':')+':',hash:expected,hashparamsval:'UNTRUSTED'};
 const decoded=protocol.parseReturn(new URLSearchParams(signed).toString(),headers);assert.equal(decoded.rnd,'a+b c%20');
 assert.doesNotThrow(()=>protocol.verifyReturnHash(config,decoded));
 for(const missing of ['cavv','eci','md'])delete decoded[missing];
 assert.doesNotThrow(()=>protocol.verifyReturnHash(config,decoded));
 const evidence=protocol.inspectReturnSignature(config,decoded);assert.deepEqual(evidence.missing_fields,['cavv','eci','md']);assert.equal(evidence.hashparamsval_matches_rebuilt,false);
 assert.doesNotThrow(()=>protocol.verifyReturnHash(config,{...decoded,hash:expected}));
 assert.throws(()=>protocol.verifyReturnHash(config,{...decoded,hash:expected+' '}));
 assert.throws(()=>protocol.verifyReturnHash(config,{...decoded,rnd:'a b c%20'}));
 assert.throws(()=>protocol.verifyReturnHash(config,{...decoded,hashparams:[...names].reverse().join(':')}));
 assert.throws(()=>protocol.verifyReturnHash({...config,storeKey:' '+config.storeKey},decoded));
 assert.throws(()=>protocol.verifyReturnHash(config,{...decoded,hash:'A'.repeat(28),secure3dhash:expected}));
 assert.equal(protocol.inspectReturnSignature(config,{...decoded,hash:Buffer.alloc(20,0xab).toString('base64')}).result,'hash_mismatch');
 assert.throws(()=>protocol.verifyReturnHash(config,{...decoded,hashparams:'clientid:oid:'}));
 const repeated=protocol.parseReturn(new URLSearchParams(signed).toString()+'&rnd=a%2Bb+c%2520',headers,{allowIdenticalDuplicates:true});assert.doesNotThrow(()=>protocol.verifyReturnHash(config,repeated));
 assert.throws(()=>protocol.parseReturn(new URLSearchParams(signed).toString()+'&rnd=a+b+c%2520',headers,{allowIdenticalDuplicates:true}));
});

test('Hash representation telemetry is strict, value-free and cannot choose or bypass an algorithm',()=>{
 const inspect=protocol.inspectHashRepresentation;
 for(const bytes of [20,32,64]){const b64=Buffer.alloc(bytes,0xab).toString('base64');const hex=Buffer.alloc(bytes,0xab).toString('hex');
  assert.equal(inspect(b64).strict_base64,true);assert.equal(inspect(b64).base64_decoded_bytes,bytes);
  assert.equal(inspect(hex).strict_hex,true);assert.equal(inspect(hex).hex_decoded_bytes,bytes);
  assert.equal(inspect(hex).character_length,bytes*2);
  assert.equal(JSON.stringify(inspect(b64)).includes(b64),false);
 }
 for(const value of ['AB==','AAB=','AAA','AA== ','AA-_','A==='])assert.equal(inspect(value).strict_base64,false);
 assert.equal(inspect('ABC').strict_hex,false);assert.equal(inspect('00 00').strict_hex,false);assert.equal(inspect('').strict_hex,false);
 assert.equal(inspect('A'.repeat(128)).strict_hex,true);assert.equal(inspect('A'.repeat(128)).strict_base64,true);
 assert.equal(inspect('A'.repeat(128)).hex_decoded_bytes,64);assert.equal(inspect('A'.repeat(128)).base64_decoded_bytes,96);
 const encoded=Buffer.alloc(64,0xab).toString('base64');
 const result=protocol.inspectReturnSignature(c,{hashparams:'clientid:oid:authcode:procreturncode:response:mdstatus:cavv:eci:md:rnd:',hash:encoded});
 assert.equal(result.result,'hash_format_invalid');assert.equal(result.hash_shape.base64_decoded_bytes,64);
 assert.throws(()=>protocol.verifyReturnHash(c,{hashparams:'clientid:oid:authcode:procreturncode:response:mdstatus:cavv:eci:md:rnd:',hash:encoded}));
 const names=['clientid','oid','authcode','procreturncode','response','mdstatus','cavv','eci','md','rnd'];
 const values=['12345678',id,'123456','00','Approved','1','','','','r'];
 const good={};names.forEach((n,i)=>good[n]=values[i]);good.hashparams=names.join(':')+':';
 const payload=values.join('')+c.storeKey;
 good.hash=crypto.createHash('sha1').update(Buffer.from(payload,'ascii')).digest('base64');
 assert.doesNotThrow(()=>protocol.verifyReturnHash(c,good));
 assert.equal(protocol.inspectReturnSignature(c,{...good,response:'Declined'}).result,'hash_mismatch');
 assert.throws(()=>protocol.verifyReturnHash(c,{...good,response:'Declined'}));
 const changedFirst=String.fromCharCode(good.hash.charCodeAt(0)==='A'.charCodeAt(0)?'B'.charCodeAt(0):'A'.charCodeAt(0))+good.hash.slice(1);
 assert.equal(protocol.inspectReturnSignature(c,{...good,hash:changedFirst}).result,'hash_mismatch');
});
