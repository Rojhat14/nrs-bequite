// Run against an already running production build. Uses an isolated Chrome
// profile and real production CSS; never enables payments. CHROME_BIN optional.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { loader } = require(process.cwd()+'/tests/source-loader.cjs');
const React = require(process.cwd()+'/node_modules/react');
const { renderToStaticMarkup } = require(process.cwd()+'/node_modules/react-dom/server');
const load=loader({'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)}});
const Consent=load('src/components/legal/CheckoutLegalConsent.tsx').default;
const markup=renderToStaticMarkup(React.createElement('div',{className:'mx-auto max-w-3xl px-6 py-12 space-y-5'},React.createElement(Consent,{accepted:false,onChange(){},error:''}),React.createElement('button',{className:'w-full bg-nrs-charcoal text-nrs-ivory py-4 text-xs'},'Siparişi Ver ve Ödeme Yap')));
const chrome=spawn(process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9324','--user-data-dir=/tmp/nrs-payment-headless','about:blank'],{stdio:'ignore'});
let ws;
(async()=>{
 let targets;for(let i=0;i<50;i++){try{targets=await (await fetch('http://127.0.0.1:9324/json')).json();break}catch{await new Promise(r=>setTimeout(r,100))}}
 const target=targets?.find(t=>t.type==='page'); assert.ok(target); ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();
 ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.method==='Runtime.exceptionThrown')console.log('BROWSER ERROR',String(v.params.exceptionDetails.exception?.description||v.params.exceptionDetails.text).replace(/[A-Za-z0-9_\-]{60,}/g,'[redacted]').slice(0,1500));if(pending.has(v.id)){const [resolve,reject]=pending.get(v.id);pending.delete(v.id);v.error?reject(new Error(v.error.message)):resolve(v.result)}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,[resolve,reject]);ws.send(JSON.stringify({id,method,params}))});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
 await send('Page.enable');await send('Runtime.enable');
 await send('Page.navigate',{url:(process.env.PAYMENT_TEST_URL || 'http://127.0.0.1:3118')+'/mesafeli-satis-sozlesmesi'});
 await new Promise(r=>setTimeout(r,2000));
 assert.ok((await evaluate('document.body.innerText')).includes('Mesafeli Satış Sözleşmesi'), 'Legal page did not hydrate');
 for(const width of [320,390,1280]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<500});
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true,'legal overflow '+width);
  const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/nrs-legal-'+width+'.png',Buffer.from(shot.data,'base64'));
 }
 // Isolated fixture: actual consent component + production CSS. The live flag
 // stays false; this does not bypass payment gates or connect to any bank.
 const bodyClass=await evaluate('document.body.className');
 const css=await evaluate("[...document.querySelectorAll('link[rel=stylesheet]')].map(l=>l.href)");
 const frame=(await send('Page.getFrameTree')).frameTree.frame.id;
 await send('Page.setDocumentContent',{frameId:frame,html:'<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">'+css.map(h=>'<link rel="stylesheet" href="'+h+'">').join('')+'</head><body class="'+bodyClass+'"><main>'+markup+'</main></body></html>'});
 await new Promise(r=>setTimeout(r,300));
 for(const width of [320,390,1280]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<500});
  const result=await evaluate(`(()=>{const checkbox=document.querySelector('input[type=checkbox]');return{overflow:document.documentElement.scrollWidth>innerWidth,checked:checkbox.checked,links:[...document.querySelector('main').querySelectorAll('a')].map(a=>a.getAttribute('href')),checkboxWidth:checkbox.getBoundingClientRect().width,labelHeight:document.querySelector('label[for=checkout-contract]').getBoundingClientRect().height,buttonWidth:document.querySelector('main button').getBoundingClientRect().width}})()`);
  assert.equal(result.overflow,false);assert.equal(result.checked,false);assert.ok(result.checkboxWidth>=20);assert.ok(result.labelHeight>=44);assert.ok(result.buttonWidth>=250);assert.ok(result.links.includes('/mesafeli-satis-sozlesmesi'));assert.ok(result.links.includes('/on-bilgilendirme-formu'));
  const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('/tmp/nrs-consent-'+width+'.png',Buffer.from(shot.data,'base64'));
  console.log('PASS viewport '+width+' legal/consent links, unchecked, touch targets, no horizontal overflow');
 }
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>{ws?.close();chrome.kill('SIGTERM')});
