const test=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {loader}=require('./source-loader.cjs');
const id='abcdefab-abcd-4abc-8abc-abcdefabcdef';
const home={id,name:'Home',slug:'bedding',description:null,sort_order:100,is_active:true};
const png=Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0]);
function request(bytes=png,mime='image/png',origin='https://nrs.test',categoryId=id){
 const form=new FormData();form.set('category_id',categoryId);form.set('file',new File([bytes],'cover.png',{type:mime}));
 return new Request('https://nrs.test/api/admin/categories/cover',{method:'POST',headers:{Origin:origin},body:form});
}
function route({category=home,deny=false}={}){
 const calls=[];
 const db={
  from(table){
   calls.push(['table',table]);assert.equal(table,'categories');
   return {select(){return this},eq(){return this},maybeSingle:async()=>({data:category,error:null})};
  },
  storage:{from(bucket){return {
   upload:async(key,bytes,options)=>{calls.push(['upload',bucket,key,options]);return {error:null}},
   getPublicUrl:key=>({data:{publicUrl:'https://example.supabase.co/storage/v1/object/public/'+bucket+'/'+key}}),
  }}},
 };
 const value=loader({'@/lib/auth/requireAdmin':{requireAdmin:async()=>{calls.push(['admin']);if(deny)throw Error('Denied')}},'@/lib/supabase/server':{createSupabaseServerClient:async()=>db},'next/cache':{revalidatePath:path=>calls.push(['revalidate',path])}})('src/app/api/admin/categories/cover/route.ts');
 return {value,calls};
}
test('Home cover upload rejects cross-origin and non-admin requests before storage access',async()=>{
 const cross=route();assert.equal((await cross.value.POST(request(png,'image/png','https://other.test'))).status,403);assert.deepEqual(cross.calls,[]);
 const denied=route({deny:true});await assert.rejects(denied.value.POST(request()),/Denied/);assert.deepEqual(denied.calls,[['admin']]);
});
test('Home cover upload validates file signature, size, category and immutable storage scope',async()=>{
 for(const [req,status,options]of [[request(new Uint8Array([1,2]),'image/png'),415,{}],[request(png,'text/plain'),415,{}],[request(new Uint8Array(5*1024*1024+1),'image/png'),413,{}],[request(),404,{category:{...home,slug:'elbiseler',name:'Elbiseler'}}],[request(png,'image/png','https://nrs.test','../unsafe'),400,{}]]){
  const {value,calls}=route(options);assert.equal((await value.POST(req)).status,status);assert.ok(!calls.some(c=>c[0]==='upload'));
 }
 const {value,calls}=route();const response=await value.POST(request(png,'image/png','https://nrs.test',id.toUpperCase()));assert.equal(response.status,200);
 const body=await response.json();assert.ok(body.imageUrl.includes('/category-covers/'+id+'/cover?v='));
 const upload=calls.find(c=>c[0]==='upload');assert.equal(upload[1],'product-images');assert.equal(upload[2],'category-covers/'+id+'/cover');assert.deepEqual(upload[3],{contentType:'image/png',cacheControl:'60',upsert:true});
 assert.ok(calls.find(c=>c[0]==='revalidate'&&c[1]==='/'));
});
test('Public Home cover uses default photo without a file and refreshes uploaded-photo cache by ETag',async()=>{
 const originalFetch=global.fetch,originalUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
 try {
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co';
  const lib=loader({'react':{cache:fn=>fn}})('src/lib/storage/category-covers.ts');
  global.fetch=async(url,options)=>{assert.equal(options.method,'HEAD');assert.equal(options.cache,'no-store');assert.equal(options.headers,undefined);return new Response(null,{status:404})};
  assert.equal(await lib.getHomeCategoryCover(id),'/images/editorial/categories/home-bedding.webp');
  global.fetch=async()=>new Response(null,{status:200,headers:{'Content-Type':'image/webp',ETag:'new-cover'}});
  assert.equal(new URL(await lib.getHomeCategoryCover(id)).searchParams.get('v'),'new-cover');
 }finally{global.fetch=originalFetch;if(originalUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=originalUrl}
});
test('Admin Home card offers category creation or upload and a product link with Home preselected',()=>{
 const component=()=>null;
 const Manager=loader({'next/navigation':{useRouter:()=>({refresh(){}})},'next/image':{__esModule:true,default:props=>React.createElement('img',props)},'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},'@/app/admin/(protected)/actions':{},'./HomeCategoryCover':{__esModule:true,default:component}})('src/components/admin/AdminCategoryManager.tsx').default;
 const empty=renderToStaticMarkup(React.createElement(Manager,{categories:[],productCounts:{}}));assert.ok(empty.includes('Home kategorisini oluştur'));assert.ok(empty.includes('name="slug" value="bedding"'));
 const existing=renderToStaticMarkup(React.createElement(Manager,{categories:[home],productCounts:{}}));assert.ok(existing.includes('/admin/products/new?category_id='+id));assert.ok(existing.includes('Nevresim ürünü ekle'));
});
test('Home bedding uses no clothing body measurements; clothing rules stay intact',()=>{
 const lib=loader()('src/lib/order-measurements.ts');
 for(const name of ['Home','Bedding','Çift kişilik nevresim takımı'])assert.deepEqual(lib.requiredMeasurements(lib.measurementKind(name)),[]);
 assert.deepEqual(lib.requiredMeasurements(lib.measurementKind('Elbise')),['chest','waist','hips','height']);
});
test('New-product page selects the existing Home category and rejects unknown category hints',async()=>{
 const component=()=>null;
 const Form=({initialCategoryId})=>React.createElement('span',{'data-category':initialCategoryId});
 const Page=loader({'@/lib/admin/data':{getCategories:async()=>({data:[home],error:null}),getCollections:async()=>({data:[],error:null}),isMissingTable:()=>false},'@/components/admin/AdminProductForm':{__esModule:true,default:Form},'@/components/admin/AdminPageHeader':{__esModule:true,default:component},'@/components/admin/AdminDatabaseState':{__esModule:true,default:component}})('src/app/admin/(protected)/products/new/page.tsx').default;
 const known=renderToStaticMarkup(await Page({searchParams:Promise.resolve({category_id:id})}));assert.ok(known.includes('data-category="'+id+'"'));
 const unknown=renderToStaticMarkup(await Page({searchParams:Promise.resolve({category_id:'unknown'})}));assert.ok(unknown.includes('data-category=""'));
});

test('Admin navigation exposes Home / Nevresim directly',()=>{
 const Shell=loader({'next/navigation':{usePathname:()=>'/admin/home',useRouter:()=>({})},'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},'@/lib/supabase/client':{createSupabaseBrowserClient:()=>{throw Error('No live client')}}})('src/components/admin/AdminShell.tsx').default;
 const html=renderToStaticMarkup(React.createElement(Shell,{children:'Home content'}));
 assert.ok(html.includes('href="/admin/home"'));assert.ok(html.includes('Home / Nevresim'));
});

test('Dedicated Home page permits product entry only after a real, active category exists',async()=>{
 for(const category of [null,home,{...home,is_active:false}]){
  const component=()=>null;
  const Form=({categories,initialCategoryId})=>React.createElement('span',{'data-home-form':initialCategoryId,'data-options':categories.length});
  const Manager=({categories,homeOnly})=>React.createElement('span',{'data-create-home':String(categories.length===0),'data-home-only':String(homeOnly)});
  const Page=loader({'@/lib/admin/data':{getCategories:async()=>({data:category?[category]:[],error:null}),getCategoryProductCounts:async()=>({counts:{}}),getCollections:async()=>({data:[],error:null}),isMissingTable:()=>false},'@/lib/storage/category-covers':{getHomeCategoryCover:async()=>'/test.webp'},'@/components/admin/AdminProductForm':{__esModule:true,default:Form},'@/components/admin/AdminCategoryManager':{__esModule:true,default:Manager},'@/components/admin/AdminPageHeader':{__esModule:true,default:component},'@/components/admin/AdminDatabaseState':{__esModule:true,default:component},'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)}})('src/app/admin/(protected)/home/page.tsx').default;
  const html=renderToStaticMarkup(await Page());
  assert.ok(html.includes('data-home-only="true"'));
  if(category?.is_active){assert.ok(html.includes('data-home-form="'+id+'"'));assert.ok(html.includes('data-options="1"'));assert.ok(html.includes('/admin/products?category='+id));}
  else assert.ok(!html.includes('data-home-form'));
  if(!category)assert.ok(html.includes('data-create-home="true"'));
 }
});
