const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite'),{loader}=require('./source-loader.cjs');
const id='11111111-1111-4111-8111-111111111111',attempt='22222222-2222-4222-8222-222222222222';
const c={observationOnly:true,mode:'TEST',merchantId:'1000001',terminalId:'12345678',userId:'GARANTI',provisionUser:'PROVAUT',provisionPassword:'synthetic-password',queryUser:'PROVAUT',queryPassword:'synthetic-query',storeKey:'synthetic-store',handoffSecret:'a'.repeat(64),siteOrigin:'https://shop.example',formUrl:'https://sanalposprovtest.garantibbva.com.tr/servlet/gt3dengine',queryUrl:'https://sanalposprovtest.garantibbva.com.tr/VPServlet',successUrl:'https://shop.example/api/payment/garanti/success',errorUrl:'https://shop.example/api/payment/garanti/failure',installment:'',capturedStatus:'',capturedResultCode:'',saleChargeType:'',failedStatuses:[]};
const order={id,merchantReference:id,amountMinor:100,currency:'TRY',state:'pending',legal:{order_summary:{buyer:{email:'private@example.com'}}}};
const headers=new Headers({'content-type':'application/x-www-form-urlencoded;charset=utf-8'});
function fixture(){let saved;const db={from(){return{select(){return this},eq(){return this},async single(){return{data:{idempotency_key:attempt},error:null}},async upsert(row){saved=row;return{error:null}}}}};
 const load=loader({'./config':{garantiObservationOnly:()=>true,garantiLiveObservationOnly:()=>true},'./order':{loadGarantiOrder:async()=>order},'@/lib/payment/repository':{paymentDatabase:()=>db,createPaymentRepository:()=>{throw Error('Settlement forbidden')}}});
 const protocol=load('src/lib/payment/garanti/protocol.ts'),{GarantiProvider}=load('src/lib/payment/garanti/adapter.ts');
 const provider=new GarantiProvider(c,async()=>order,async()=>{throw Error('No capture')});
 function body(changes={},signed=true){const f={...protocol.bankFields(c,order,'192.168.0.1'),clientid:c.terminalId,oid:id,authcode:'synthetic',mdstatus:'0',response:'Declined',procreturncode:'05',cavv:'synthetic',eci:'synthetic',md:'synthetic',rnd:'synthetic',mderrormessage:'Authentication failed',errmsg:'Card expired',...changes};
 f.hashparams='clientid:oid:authcode:procreturncode:response:mdstatus:cavv:eci:md:rnd:';f.hash=signed?crypto.createHash('sha1').update(protocol.isoBytes(f.hashparams.split(':').filter(Boolean).map(n=>f[n]).join('')+c.storeKey)).digest('base64'):'invalid';return new URLSearchParams(f).toString()}
 return{load,provider,body,saved:()=>saved};}
test('Signed TEST failure is tied to the existing attempt; unsigned failure remains explicitly untrusted',async()=>{
 for(const signed of [true,false]){const f=fixture(),api=f.load('src/lib/payment/garanti/diagnostics.ts');const d=await api.diagnoseTestReturn(f.provider,f.body({},signed),headers,'failure');
 assert.equal(d.order_id,id);assert.equal(d.payment_attempt_id,attempt);assert.equal(d.signature_verified,signed);assert.equal(d.association,signed?'verified':'claimed');assert.equal(d.outcome,signed?'verified_failure':'unverified_failure');assert.equal(d.error_text_signed,false);
 await api.saveTestDiagnostic(d);const row=f.saved();assert.equal(row.mdstatus,'0');assert.equal(row.procreturncode,'05');assert.match(row.fingerprint,/^[a-f0-9]{64}$/);assert.equal(Object.hasOwn(row,'raw'),false);}
});
test('Wrong amount/currency/terminal or unsigned approved claim cannot be displayed as a verified result',async()=>{
 for(const changes of [{txnamount:'1'},{txncurrencycode:'840'},{terminalid:'87654321'},{orderid:attempt}]){const f=fixture();const d=await f.load('src/lib/payment/garanti/diagnostics.ts').diagnoseTestReturn(f.provider,f.body(changes),headers,'failure');assert.equal(d.association,'claimed');assert.equal(d.outcome,'unverified_failure')}
 const f=fixture(),d=await f.load('src/lib/payment/garanti/diagnostics.ts').diagnoseTestReturn(f.provider,f.body({mdstatus:'1',response:'Approved',procreturncode:'00'},false),headers,'success');assert.equal(d.outcome,'unverified');
});
test('Error-text sanitizer retains no arbitrary PAN/CVV/secret/email/name or oversized text',async()=>{
 const f=fixture(),api=f.load('src/lib/payment/garanti/diagnostics.ts');
 for(const text of ['Synthetic Person private@example.com 4111111111111111 CVV=999 StoreKey=synthetic-store','card expired '+c.provisionPassword,'x'.repeat(8192),'<script>secret</script>']){const clean=api.cleanBankExplanation(text);assert.equal(clean,'Açıklama gizlilik nedeniyle saklanmadı.');assert.ok(clean.length<=160)}
 const d=await api.diagnoseTestReturn(f.provider,f.body({errmsg:'4111111111111111 CVV=999 password=synthetic-password',cardnumber:'4111111111111111',cvv:'999',token:'private-token'}),headers,'failure');await api.saveTestDiagnostic(d);
 const stored=JSON.stringify(f.saved());for(const secret of ['4111111111111111','999','synthetic-password','private-token','private@example.com'])assert.equal(stored.includes(secret),false);
});
test('Malformed/duplicate fields cannot be trusted or associated; signed approval stays verification_pending',async()=>{
 const f=fixture(),api=f.load('src/lib/payment/garanti/diagnostics.ts');const bad=await api.diagnoseTestReturn(f.provider,f.body()+'&oid='+attempt,headers,'failure');assert.equal(bad.order_id,null);assert.equal(bad.signature_verified,false);assert.equal(bad.outcome,'unverified_failure');
 const good=await api.diagnoseTestReturn(f.provider,f.body({mdstatus:'1',response:'Approved',procreturncode:'00'}),headers,'success');assert.equal(good.outcome,'verification_pending');
 const partial=await api.diagnoseTestReturn(f.provider,f.body({mdstatus:'2',response:'Approved',procreturncode:'00'}),headers,'success');assert.equal(partial.outcome,'unverified');
});
test('TEST return handler saves safe diagnostics before redirect and never finalizes payments',async()=>{
 const f=fixture(),diagnostics=f.load('src/lib/payment/garanti/diagnostics.ts');let calls=0;
 f.provider.verifyReturn=async()=>{calls++;return{status:'paid',merchantReference:id}};
 const handler=loader({'@/lib/payment/provider':{paymentAvailable:()=>true,getPaymentProvider:()=>f.provider},'./adapter':{GarantiProvider:f.provider.constructor,GarantiPending:class extends Error{}},'./diagnostics':diagnostics,'@/lib/payment/repository':{createPaymentRepository:()=>{throw Error('Never finalize')}}})('src/lib/payment/garanti/return-handler.ts').garantiReturn;
 const r=await handler(new Request(c.errorUrl,{method:'POST',headers,body:f.body()}));assert.equal(r.status,303);assert.match(r.headers.get('location'),/checkout\/verify\?orderId=/);assert.equal(f.saved().outcome,'verified_failure');assert.equal(calls,0);
 await handler(new Request(c.errorUrl,{method:'POST',headers,body:f.body({},false)}));assert.equal(calls,0);assert.equal(f.saved().association,'claimed');
});
test('Result screen separates signed failure, untrusted failure and pending verification; no paid or consumed-link retry',async()=>{
 const {renderToStaticMarkup}=require('react-dom/server');
 for(const [outcome,title] of [['verified_failure','TEST — Banka işlemi başarısız'],['unverified_failure','TEST — Başarısızlık dönüşü, sonuç doğrulanamadı'],['verification_pending','TEST — Banka dönüşü doğrulandı'],['unverified','TEST — Sonuç doğrulanamadı']]){
 const view=loader({'@/lib/payment/garanti/config':{garantiObservationOnly:()=>true,garantiLiveObservationOnly:()=>false},'@/lib/payment/repository':{readAccessiblePaymentOrder:async()=>({id,status:'pending',legal:{order_summary:{},accepted_at:'2026-10-12T00:00:00Z',contract_version:'unknown',pre_information_version:'unknown'}})},
 '@/lib/payment/garanti/diagnostics':{readTestDiagnostic:async()=>({outcome,association:outcome==='unverified_failure'?'claimed':'verified',signature_verified:true,mdstatus:'0',response:'declined',procreturncode:'05',mderrormessage:'',errmsg:''})},
 '@/lib/payment/garanti/order':{testHandoffUnsubmitted:async()=>false},'@/components/legal/LegalOrderSummary':()=>null})('src/components/payment/PaymentResult.tsx').default;
 const html=renderToStaticMarkup(await view({orderId:id}));assert.ok(html.includes(title));assert.equal(html.includes('Ödeme doğrulandı'),false);assert.equal(html.includes('/api/payment/garanti/renew'),false);
 }
});
test('TEST-only diagnostic table denies browser access and cannot store a verified failure without proofs',async()=>{
 const db=new PGlite();try{await db.exec("CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE TABLE products(id text);INSERT INTO products VALUES('garanti-test-accessory');CREATE TABLE payment_orders(order_id uuid PRIMARY KEY);SET app.nrs_test_project_ref='dzuxhwtbuojnhibzfxqy';");
 await db.exec(fs.readFileSync('supabase/test-setup/dzuxhwtbuojnhibzfxqy-garanti-diagnostics.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/test-setup/dzuxhwtbuojnhibzfxqy-garanti-diagnostics-evidence.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/test-setup/dzuxhwtbuojnhibzfxqy-garanti-diagnostics-duplicates.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/test-setup/dzuxhwtbuojnhibzfxqy-garanti-diagnostics-signature.sql','utf8'));
 for(const role of ['anon','authenticated'])assert.equal((await db.query(`SELECT has_table_privilege('${role}','garanti_test_return_diagnostics','SELECT') allowed`)).rows[0].allowed,false);
 assert.equal((await db.query("SELECT has_table_privilege('service_role','garanti_test_return_diagnostics','INSERT') allowed")).rows[0].allowed,true);
 assert.equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE relname='garanti_test_return_diagnostics'")).rows[0].relrowsecurity,true);
 await db.exec("INSERT INTO garanti_test_return_diagnostics(fingerprint,source,mderrormessage,errmsg,error_text_signed,signature_verified,association,outcome) VALUES(repeat('b',64),'failure','','',false,false,'unassociated','unverified_failure') ON CONFLICT(fingerprint) DO NOTHING;INSERT INTO garanti_test_return_diagnostics(fingerprint,source,mderrormessage,errmsg,error_text_signed,signature_verified,association,outcome) VALUES(repeat('b',64),'failure','','',false,false,'unassociated','unverified_failure') ON CONFLICT(fingerprint) DO NOTHING;");
 assert.equal((await db.query('SELECT count(*)::int n FROM garanti_test_return_diagnostics')).rows[0].n,1);
 await assert.rejects(db.exec("INSERT INTO garanti_test_return_diagnostics(fingerprint,source,mderrormessage,errmsg,error_text_signed,signature_verified,association,outcome) VALUES(repeat('a',64),'failure','','',false,false,'claimed','verified_failure')"));
 }finally{await db.close()}
});

test('TEST parser failures expose only fixed stage codes and never collapse into a claimed approval',async()=>{
 const f=fixture(),api=f.load('src/lib/payment/garanti/diagnostics.ts'),logs=[],original=console.info;
 console.info=value=>logs.push(JSON.parse(value));
 try {
  for(const [body,h,stage] of [
   ['private=secret',new Headers({'content-type':'application/json'}),'content_type'],
   [f.body()+'&oid='+attempt,headers,'duplicate_field'],
   ['oid=%XX',headers,'percent_encoding'],
   ['errmsg=%DD%FE',headers,'text_encoding']
  ]){
   const d=await api.diagnoseTestReturn(f.provider,body,h,'success');
   assert.equal(d.order_id,null);assert.equal(d.signature_verified,false);assert.equal(logs.at(-1).stage,stage);
  }
  assert.equal(JSON.stringify(logs).includes('secret'),false);
  assert.equal(JSON.stringify(logs).includes(id),false);
  const approved=await api.diagnoseTestReturn(f.provider,f.body({mdstatus:'1',response:'Approved',procreturncode:'00'}),headers,'success');
  assert.equal(approved.procreturncode,'00');assert.equal(approved.outcome,'verification_pending');
  assert.equal(logs.at(-1).stage,'return_verified');
 } finally {console.info=original}
});

test('Signed return and matching TEST query persist independent evidence without enabling settlement',async()=>{
 const f=fixture(),api=f.load('src/lib/payment/garanti/diagnostics.ts');let queries=0;
 const evidence={http:200,mode_evidence:'test_endpoint_and_request',identity_match:true,amount_match:true,auth_match:true,response_code:'00',reason_code:'',result_code:'00',status:'APPROVED',charge_type:'S',auth_code_present:true,bank_reference_present:true};
 f.provider.observeQuery=async()=>{queries++;return evidence};
 const d=await api.diagnoseTestReturn(f.provider,f.body({mdstatus:'1',response:'Approved',procreturncode:'00'}),headers,'success');
 await api.saveTestDiagnostic(d);const stored=f.saved();
 assert.equal(stored.signature_verified,true);assert.equal(stored.validation_stage,'return_verified');assert.equal(stored.query_stage,'matched');assert.deepEqual(stored.query_evidence,evidence);assert.equal(stored.outcome,'verification_pending');assert.equal(f.provider.settlementDisabled,true);
 for(const key of ['order_match','amount_match','currency_match','terminal_match','request_match'])assert.equal(stored[key],true);
 await api.diagnoseTestReturn(f.provider,f.body({mdstatus:'1',response:'Approved',procreturncode:'00'},false),headers,'success');assert.equal(queries,1);
 f.provider.observeQuery=async()=>({...evidence,identity_match:false});assert.equal((await api.diagnoseTestReturn(f.provider,f.body({mdstatus:'1',response:'Approved',procreturncode:'00'}),headers,'success')).query_stage,'mismatch');
 f.provider.observeQuery=async()=>{throw Error('query rejected')};assert.equal((await api.diagnoseTestReturn(f.provider,f.body({mdstatus:'1',response:'Approved',procreturncode:'00'}),headers,'success')).query_stage,'unavailable');
});

test('Verified single-finalize callback reuses its exact orderinq evidence without another bank query',async()=>{
 const f=fixture(),api=f.load('src/lib/payment/garanti/diagnostics.ts');let queries=0;
 const evidence={order_id:id,signature_verified:true,order_match:true,amount_match:true,currency_match:true,terminal_match:true,request_match:true,
  query_evidence:{http:200,mode_evidence:'test_endpoint_and_request',identity_match:true,amount_match:true,auth_match:true,response_code:'00',reason_code:'',result_code:'00',status:'APPROVED',charge_type:'S',auth_code_present:true,bank_reference_present:true}};
 f.provider.observeQuery=async()=>{queries++;throw Error('Should reuse verified query')};
 const d=await api.diagnoseTestReturn(f.provider,f.body({mdstatus:'1',response:'Approved',procreturncode:'00'}),headers,'success',evidence);
 assert.equal(d.signature_verified,true);assert.equal(d.association,'verified');assert.equal(d.query_stage,'matched');assert.deepEqual(d.query_evidence,evidence.query_evidence);assert.equal(queries,0);
 await api.saveTestDiagnostic(d);const stored=JSON.stringify(f.saved());
 assert.equal(f.saved().signature_verified,true);assert.equal(f.saved().query_stage,'matched');
 for(const secret of [c.storeKey,c.provisionPassword,'private@example.com','synthetic'])assert.equal(stored.includes(secret),false);
});

test('Result screen shows observation policy separately from query errors or missing evidence',async()=>{
 const {renderToStaticMarkup}=require('react-dom/server');
 for(const [stage,title] of [['matched','TEST — Banka dönüşü ve sorgu eşleşti'],['mismatch','TEST — Banka sorgusu eşleşmedi'],['unavailable','TEST — Banka dönüşü doğrulandı'],[null,'TEST — Gözlem modu']]){
  const view=loader({'@/lib/payment/garanti/config':{garantiObservationOnly:()=>true,garantiLiveObservationOnly:()=>false},'@/lib/payment/repository':{readAccessiblePaymentOrder:async()=>({id,status:'pending',legal:{order_summary:{},accepted_at:'2026-10-13T00:00:00Z',contract_version:'unknown',pre_information_version:'unknown'}})},
   '@/lib/payment/garanti/diagnostics':{readTestDiagnostic:async()=>stage?{outcome:'verification_pending',association:'verified',signature_verified:true,query_stage:stage}:null},
   '@/lib/payment/garanti/order':{testHandoffUnsubmitted:async()=>false},'@/components/legal/LegalOrderSummary':()=>null})('src/components/payment/PaymentResult.tsx').default;
  const html=renderToStaticMarkup(await view({orderId:id}));assert.ok(html.includes(title));assert.ok(html.includes('otomatik sipariş onayı kapalı'));assert.equal(html.includes('Sonuç doğrulanamadı'),false);assert.equal(html.includes('Ödeme doğrulandı'),false);
 }
});

test('Paid TEST order result takes precedence over observation copy and discloses absent return diagnostics',async()=>{
 const {renderToStaticMarkup}=require('react-dom/server');
 const view=loader({'@/lib/payment/garanti/config':{garantiObservationOnly:()=>true,garantiLiveObservationOnly:()=>false},'@/lib/payment/repository':{readAccessiblePaymentOrder:async()=>({id,status:'paid',legal:{order_summary:{},accepted_at:'2026-10-13T00:00:00Z',contract_version:'unknown',pre_information_version:'unknown'}})},
  '@/lib/payment/garanti/diagnostics':{readTestDiagnostic:async()=>null},'@/lib/payment/garanti/order':{testHandoffUnsubmitted:async()=>false},'@/components/legal/LegalOrderSummary':()=>null})('src/components/payment/PaymentResult.tsx').default;
 const html=renderToStaticMarkup(await view({orderId:id}));
 assert.ok(html.includes('TEST — Sipariş paid'));
 assert.ok(html.includes('Test veritabanında sipariş paid olarak kayıtlı'));
 assert.ok(html.includes('dönüş tanı kaydı bulunmuyor'));
 assert.equal(html.includes('otomatik sipariş onayı kapalı'),false);
 assert.equal(html.includes('TEST — Sonuç doğrulanamadı'),false);
});

test('Unassociated receipts retain separate timestamps instead of deduping a new parse failure into an old probe',async()=>{
 const f=fixture(),api=f.load('src/lib/payment/garanti/diagnostics.ts');
 const d=await api.diagnoseTestReturn(f.provider,'private=withheld',new Headers({'content-type':'application/json'}),'success');
 await api.saveTestDiagnostic(d);const first=f.saved().fingerprint;await api.saveTestDiagnostic(d);assert.notEqual(f.saved().fingerprint,first);
 const associated=await api.diagnoseTestReturn(f.provider,f.body({},false),headers,'failure');
 await api.saveTestDiagnostic(associated);const same=f.saved().fingerprint;await api.saveTestDiagnostic(associated);assert.equal(f.saved().fingerprint,same);
});

test('Rejected success form routes to a technical result; inaccessible order is not reported as an absent bank record',async()=>{
 const f=fixture(),diagnostics=f.load('src/lib/payment/garanti/diagnostics.ts');
 const handler=loader({'@/lib/payment/provider':{paymentAvailable:()=>true,getPaymentProvider:()=>f.provider},'./adapter':{GarantiProvider:f.provider.constructor,GarantiPending:class extends Error{}},'./diagnostics':diagnostics,'@/lib/payment/repository':{createPaymentRepository:()=>{throw Error('Never finalize')}}})('src/lib/payment/garanti/return-handler.ts').garantiReturn;
 const response=await handler(new Request(c.successUrl,{method:'POST',headers,body:f.body()+'&oid='+attempt}));
 assert.equal(response.status,303);assert.equal(new URL(response.headers.get('location')).pathname,'/checkout/failure');assert.equal(f.saved().validation_stage,'duplicate_field');assert.equal(f.saved().order_id,null);
 const {renderToStaticMarkup}=require('react-dom/server');
 const view=loader({'@/lib/payment/garanti/config':{garantiObservationOnly:()=>true,garantiLiveObservationOnly:()=>false},'@/lib/payment/repository':{readAccessiblePaymentOrder:async()=>null},'@/lib/payment/garanti/diagnostics':{readTestDiagnostic:async()=>{throw Error('No unauthorized read')}},'@/lib/payment/garanti/order':{testHandoffUnsubmitted:async()=>{throw Error('No unauthorized read')}}})('src/components/payment/PaymentResult.tsx').default;
 const technical=renderToStaticMarkup(await view({failure:true}));assert.ok(technical.includes('TEST — Banka dönüşü ilişkilendirilemedi'));assert.ok(technical.includes('teknik dönüş sorunu'));
 const denied=renderToStaticMarkup(await view({orderId:id}));assert.ok(denied.includes('TEST — Sipariş erişimi doğrulanamadı'));assert.equal(denied.includes('banka dönüş kaydı henüz bulunmuyor'),false);assert.equal(denied.includes('Ödeme doğrulandı'),false);
});

test('TEST duplicate diagnostics retain only names/count/equality and preserve signature/return checks',async()=>{
 const f=fixture(),api=f.load('src/lib/payment/garanti/diagnostics.ts');
 const body=f.body({mdstatus:'1',response:'Approved',procreturncode:'00'});
 const same=await api.diagnoseTestReturn(f.provider,body+'&response=Approved&response=Approved&txnamount=100',headers,'success');
 assert.equal(same.signature_verified,true);assert.equal(same.association,'verified');assert.equal(same.outcome,'verification_pending');
 assert.deepEqual(same.duplicate_fields,[{name:'response',count:3,values:'same'},{name:'txnamount',count:2,values:'same'}]);
 await api.saveTestDiagnostic(same);assert.deepEqual(f.saved().duplicate_fields,same.duplicate_fields);
 const bad=await api.diagnoseTestReturn(f.provider,body+'&response=Declined&response=Approved',headers,'success');
 assert.equal(bad.validation_stage,'duplicate_field');assert.equal(bad.signature_verified,false);assert.equal(bad.order_id,null);
 assert.deepEqual(bad.duplicate_fields,[{name:'response',count:3,values:'different'}]);
 const sensitive=await api.diagnoseTestReturn(f.provider,body+'&cardnumber=private-card&cardnumber=private-card&private_name=private-value&private_name=other-value',headers,'success');
 assert.deepEqual(sensitive.duplicate_fields,[{name:'cardnumber',count:2,values:'same'},{name:'unrecognized',count:2,values:'different'}]);
 await api.saveTestDiagnostic(sensitive);const persisted=JSON.stringify(f.saved());
 for(const value of ['private-card','private_name','private-value','other-value',c.storeKey,c.provisionPassword])assert.equal(persisted.includes(value),false);
 const tampered=await api.diagnoseTestReturn(f.provider,body.replace(/(^|&)hash=[^&]+/,'$1hash=bad')+'&response=Approved',headers,'success');assert.equal(tampered.signature_verified,false);
 const mismatch=await api.diagnoseTestReturn(f.provider,f.body({mdstatus:'1',response:'Approved',procreturncode:'00',txnamount:'1'})+'&txnamount=1',headers,'success');assert.equal(mismatch.amount_match,false);assert.equal(mismatch.association,'claimed');
});

test('Safe signature evidence separates missing fields, bad hash shape and mismatch without storing hash inputs',async()=>{
 const f=fixture(),api=f.load('src/lib/payment/garanti/diagnostics.ts');
 const d=await api.diagnoseTestReturn(f.provider,f.body({},false),headers,'success');await api.saveTestDiagnostic(d);
 assert.equal(f.saved().return_signature_evidence.result,'hash_format_invalid');
 assert.equal(f.saved().return_signature_evidence.algorithm,'sha1');assert.equal(f.saved().return_signature_evidence.encoding,'iso-8859-9');
 const stored=JSON.stringify(f.saved().return_signature_evidence);for(const value of [c.storeKey,c.provisionPassword,'invalid',id,'private@example.com'])assert.equal(stored.includes('"'+value+'"'),false);
 const good=await api.diagnoseTestReturn(f.provider,f.body({mdstatus:'1',response:'Approved',procreturncode:'00'}),headers,'success');assert.equal(good.return_signature_evidence.result,'verified');
});

test('Controlled Production callback diagnostic records safe signature shape and duplicate summaries only',()=>{
 const f=fixture(),api=f.load('src/lib/payment/garanti/diagnostics.ts');f.provider.config.liveObservationOnly=true;f.provider.config.mode='PROD';
 const malformed=api.diagnoseLiveReturn(f.provider,f.body({},false),headers,'GARANTI_SUCCESS_RETURN_SIGNATURE_HASH_FORMAT_INVALID');
 assert.equal(malformed.rejection_code,'GARANTI_SUCCESS_RETURN_SIGNATURE_HASH_FORMAT_INVALID');assert.equal(malformed.signature_verified,false);
 assert.equal(malformed.signature_result,'hash_format_invalid');assert.equal(malformed.hash_format,'other');
 assert.equal(malformed.hash_character_length,7);assert.equal(malformed.hash_strict_hex,false);assert.equal(malformed.hash_strict_base64,false);assert.equal(malformed.hash_decoded_bytes,null);
 assert.deepEqual(malformed.hashparams_order,['clientid','oid','authcode','procreturncode','response','mdstatus','cavv','eci','md','rnd']);
 assert.deepEqual(malformed.missing_fields,[]);assert.deepEqual(malformed.empty_fields,[]);
 const duplicate='&terminalid=12345678';
 const same=api.diagnoseLiveReturn(f.provider,f.body()+duplicate,headers,'GARANTI_SUCCESS_RETURN_FIELD_DUPLICATE_FIELD');
 assert.equal(same.validation_stage,'duplicate_field');assert.equal(same.signature_verified,false);assert.equal(same.signature_result,'verified');
 assert.deepEqual(same.duplicate_fields,[{name:'terminalid',count:2,values:'same'}]);
 const different=api.diagnoseLiveReturn(f.provider,f.body()+ '&terminalid=87654321',headers,'GARANTI_SUCCESS_RETURN_FIELD_DUPLICATE_FIELD');
 assert.equal(different.signature_result,'not_evaluated_ambiguous_duplicate');assert.equal(different.signature_verified,false);
 assert.deepEqual(different.duplicate_fields,[{name:'terminalid',count:2,values:'different'}]);
 const emptyRaw=f.body({cavv:'',eci:''});
 const absent=api.diagnoseLiveReturn(f.provider,emptyRaw.replace(/&eci=[^&]*/,''),headers,null);
 assert.deepEqual(absent.empty_fields,['cavv']);assert.deepEqual(absent.missing_fields,['eci']);
 const safe=JSON.stringify([malformed,same,different]);
 for(const value of [c.storeKey,c.provisionPassword,'private@example.com','synthetic',id,attempt,'Authentication failed','Card expired','4111111111111111','999']) assert.equal(safe.includes(value),false);
 assert.throws(()=>api.diagnoseLiveReturn({...f.provider,config:{...f.provider.config,liveObservationOnly:false}},f.body(),headers,null),/not enabled/);
});
test('Controlled live failure diagnostic records bounded result codes as untrusted and distinguishes absent from empty signature fields',()=>{
 const f=fixture(),api=f.load('src/lib/payment/garanti/diagnostics.ts');f.provider.config.liveObservationOnly=true;f.provider.config.mode='PROD';
 const raw=f.body({response:'Declined',procreturncode:'05',mdstatus:'0'},false)
  .replace(/(?:^|&)hashparams=[^&]*/,'').replace(/(?:^|&)hash=[^&]*/,'');
 const absent=api.diagnoseLiveReturn(f.provider,raw,headers,'GARANTI_FAILURE_RETURN_SIGNATURE_HASHPARAMS_INVALID','failure');
 assert.equal(absent.validation_stage,'parsed');assert.equal(absent.signature_verified,false);
 assert.equal(absent.hash_field_state,'missing');assert.equal(absent.hashparams_field_state,'missing');
 assert.equal(absent.failure_notice_classification,'failure_callback_signature_material_absent_or_empty_unverified');
 assert.equal(absent.reported_response,'declined');assert.equal(absent.reported_procreturncode,'05');assert.equal(absent.reported_mdstatus,'0');
 assert.equal(absent.reported_fields_trust,'untrusted_unsigned_callback');assert.deepEqual(absent.hashparams_order,[]);
 const empty=api.diagnoseLiveReturn(f.provider,'response=Declined&procreturncode=05&mdstatus=0&hash=&hashparams=',headers,'GARANTI_FAILURE_RETURN_SIGNATURE_HASHPARAMS_INVALID','failure');
 assert.equal(empty.hash_field_state,'empty');assert.equal(empty.hashparams_field_state,'empty');
 assert.equal(empty.reported_fields_trust,'untrusted_unsigned_callback');
 const changed=api.diagnoseLiveReturn(f.provider,raw+'&response=approved',headers,'GARANTI_FAILURE_RETURN_FIELD_DUPLICATE_FIELD','failure');
 assert.equal(changed.reported_response,null);assert.equal(changed.reported_fields_trust,'untrusted_unsigned_callback');
 const safe=JSON.stringify([absent,empty,changed]);
 for(const value of [c.storeKey,c.provisionPassword,'synthetic','private@example.com','Authentication failed','Card expired','4111111111111111']) assert.equal(safe.includes(value),false);
});
