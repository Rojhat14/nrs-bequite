// Explicit opt-in, official TEST service only. Read-only nonexistent-order query.
// Public official-document test credentials stay in memory; never printed/saved.
const fs=require('node:fs'),{randomUUID}=require('node:crypto');
const {loader}=require('../tests/source-loader.cjs');
async function main(){
 if(!process.argv.includes('--official-test'))throw Error('Explicit official-test opt-in required');
 const at=process.argv.indexOf('--document');
 if(at<0||!process.argv[at+1])throw Error('Downloaded official document required');
 const html=fs.readFileSync(process.argv[at+1],'utf8');
 const field=label=>{
  const re=new RegExp('<td[^>]*>\\s*'+label+'\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>','i');
  const m=html.match(re);if(!m)throw Error('Official test fields unavailable');
  return m[1].replace(/<[^>]+>/g,'').trim().replace(/&amp;/g,'&');
 };
 const {queryXml,isoBytes,parseQuery,scalar}=loader()('src/lib/payment/garanti/protocol.ts');
 const c={mode:'TEST',merchantId:field('MerchantID'),terminalId:field('TerminalID'),userId:'PROVAUT',
  queryUser:'PROVAUT',queryPassword:field('ProvisionPassword')};
 if(!/^\d+$/.test(c.merchantId)||!/^\d{8}$/.test(c.terminalId))throw Error('Official test identity unavailable');
 const order={merchantReference:randomUUID(),amountMinor:100,currency:'TRY',legal:{order_summary:{buyer:{email:'isolated-test@example.com'}}}};
 const r=await fetch('https://sanalposprovtest.garantibbva.com.tr/VPServlet',{
  method:'POST',redirect:'error',headers:{'Content-Type':'text/xml; charset=iso-8859-9'},
  body:new Uint8Array(isoBytes(queryXml(c,order,'127.0.0.1'))),signal:AbortSignal.timeout(15000)});
 let code='UNPARSED';
 if(r.ok){
  const bytes=await r.arrayBuffer();if(bytes.byteLength>65536)throw Error('Oversized response');
  const q=parseQuery(new TextDecoder('windows-1254').decode(bytes));
  const candidate=scalar(q.Transaction?.Response?.ReasonCode);
  if(/^[A-Za-z0-9_-]{1,16}$/.test(candidate))code=candidate;
 }
 console.log(JSON.stringify({mode:'TEST',operation:'orderinq_nonexistent',http:r.status,safeCode:code,orderCreated:false}));
}
main().catch(e=>{console.log(JSON.stringify({mode:'TEST',operation:'orderinq_nonexistent',status:'BLOCKED',safeCode:e.cause?.code||e.name}));process.exitCode=1});
