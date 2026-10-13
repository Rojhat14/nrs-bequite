// TEST hosted entry probe only: no card details and no capture.
const fs=require('fs'),{randomUUID}=require('crypto'),{loader}=require('../tests/source-loader.cjs');
async function main(){
 const at=process.argv.indexOf('--document');if(!process.argv.includes('--official-test')||at<0)throw Error('TEST opt-in/document required');
 const html=fs.readFileSync(process.argv[at+1],'utf8');
 const field=n=>{const m=html.match(new RegExp('<td[^>]*>\\s*'+n+'\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>','i'));if(!m)throw Error('TEST field unavailable');return m[1].replace(/<[^>]+>/g,'').trim().replace(/&amp;/g,'&')};
 const origin='https://nrs-bequite-garanti-test.vercel.app',db='https://dzuxhwtbuojnhibzfxqy.supabase.co';
 const env={GARANTI_MODE:'TEST',VERCEL_ENV:'preview',GARANTI_TEST_OBSERVATION_ONLY:'true',GARANTI_SITE_ORIGIN:origin,
 GARANTI_TEST_DATABASE_ISOLATED:'true',GARANTI_TEST_SUPABASE_URL:db,NEXT_PUBLIC_SUPABASE_URL:db,
 GARANTI_SUCCESS_URL:origin+'/api/payment/garanti/success',GARANTI_ERROR_URL:origin+'/api/payment/garanti/failure',
 GARANTI_TEST_MERCHANT_ID:field('MerchantID'),GARANTI_TEST_TERMINAL_ID:field('TerminalID'),
 GARANTI_TEST_PROVISION_USER:'PROVAUT',GARANTI_TEST_USER_ID:'GARANTI',GARANTI_TEST_QUERY_USER:'PROVAUT',GARANTI_TEST_QUERY_AGENT_USER_ID:'PROVAUT',
 GARANTI_TEST_PROVISION_PASSWORD:field('ProvisionPassword'),GARANTI_TEST_QUERY_PASSWORD:field('ProvisionPassword'),GARANTI_TEST_STORE_KEY:field('StoreKey'),
 GARANTI_HANDOFF_SECRET:'a'.repeat(64),GARANTI_SINGLE_INSTALLMENT:'',
 GARANTI_TEST_FORM_URL:'https://sanalposprovtest.garantibbva.com.tr/servlet/gt3dengine',GARANTI_TEST_QUERY_URL:'https://sanalposprovtest.garantibbva.com.tr/VPServlet'};
 const load=loader(),c=load('src/lib/payment/garanti/config.ts').garantiConfig(env),fields=load('src/lib/payment/garanti/protocol.ts').bankFields(c,
 {merchantReference:randomUUID(),amountMinor:100,legal:{order_summary:{buyer:{email:'isolated-test@example.com'}}}},'192.168.0.1');
 const r=await fetch(c.formUrl,{method:'POST',redirect:'follow',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields),signal:AbortSignal.timeout(20000)});
 const body=await r.text();if(body.length>2000000)throw Error('Oversized bank page');
 const cardEntry=/name\s*=\s*["'](?:cardnumber|cardnum|pan|card_number)["']/i.test(body)||/kart\s*numara/i.test(body);
 const u=new URL(r.url);console.log(JSON.stringify({mode:'TEST',http:r.status,bankOrigin:u.origin,hostedCardEntry:cardEntry,cardSubmitted:false,applicationOrderCreated:false}));
 if(!cardEntry)process.exitCode=1;
}
main().catch(()=>{console.log('Hosted TEST entry probe BLOCKED; details withheld');process.exitCode=1});
