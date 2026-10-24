const test=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {loader}=require('./source-loader.cjs');
const load=loader();
const f=require('./payment-security-fixture.cjs');
const ids=[
 'noir-crystal-collar-saten-elbise','burgundy-embroidered-kalem-elbise','11111222',
 'slate-cepli-dugmeli-maxi-gomlek-elbise','azure-geometrik-desenli-dugmeli-maxi-elbise',
 'noir-bros-detayli-kruvaze-uzun-elbise','noir-cicek-aplikeli-gipeli-maksi-siyah-elbise',
 'scarlet-dik-yaka-v-dekolteli-kirmizi-midi-elbise','elysian-asimetrik-yaka-drape-katmanli-kahve-midi-elbise',
 'scarlet-kruvaze-klapa-yaka-pileli-bordo-elbise','etoile-bros-detayli-uzun-siyah-ceket-elbise'
];
const names=[
 'Noir Crystal Collar Saten Elbise','Burgundy Embroidered Kalem Elbise','Beige Cep Detaylı Büzgülü Maksi Gömlek Elbise',
 'Slate Maxi Gömlek Elbise','Azure Geometrik Desenli Elbise','Noir Broş Detaylı Kruvaze Uzun Elbise',
 'Noir Çiçek Aplikeli Gipeli Maksi Siyah Elbise','Scarlet Dik Yaka V Dekolteli Kırmızı Midi Elbise',
 'Elysian Asimetrik Yaka Drape Katmanlı Kahve Midi Elbise','Scarlet Kruvaze Klapa Yaka Pileli Bordo Elbise',
 'Etoile Broş Detaylı Uzun Siyah Ceket Elbise'
];
const sizes=['32','34','36','38','40','42','44'];
const summaryFor=(productId,name,size)=>({items:[{productId,name,description:'Drape kumaşlı elbise',size,quantity:1,unitPrice:100}],
 buyer:{name:'Test Alıcı',email:'test@example.com',phone:'905551234567',address:'Beytepe, Çankaya, Ankara'},
 subtotal:120,discount:20,shipping:20,total:120,currency:'TRY',paymentMethod:'Online kartla ödeme',deliveryTerms:'Teyit edilmiş süre',orderedAt:new Date().toISOString()});

test('PostgreSQL: 11 verified dresses expose exactly 77 numeric sizes without ready-stock reservations',async()=>{
 const db=new PGlite();
 try {
  await f.setup(db);
  await db.exec(`ALTER TABLE public.products ADD COLUMN payment_test_only boolean NOT NULL DEFAULT false;
    ALTER TABLE public.products ADD COLUMN category_id uuid;
    INSERT INTO public.products(id,name,description,price_amount,compare_at_price,currency,status,in_stock,category_id,payment_test_only)
    VALUES ${ids.map((id,i)=>`('${id.replaceAll("'","''")}','${names[i].replaceAll("'","''")}','Drape kumaşlı elbise',100,120,'TRY','active',true,gen_random_uuid(),false)`).join(',')};
    INSERT INTO public.product_variants(id,product_id,size,stock_quantity,is_active)
    SELECT gen_random_uuid(),id,'S',3,true FROM public.products WHERE id IN (${ids.map(id=>`'${id}'`).join(',')});`);
  await db.exec(f.read('supabase/migrations/20261019120000_optional_personal_measurements.sql'));
  await db.exec(f.read('supabase/migrations/20261019130000_made_to_order_numeric_dresses.sql'));

  const catalogue=(await db.query(`SELECT p.id,p.fulfillment_mode,v.size,v.stock_quantity,v.is_active
    FROM public.products p JOIN public.product_variants v ON v.product_id=p.id
    WHERE p.id=ANY($1::text[]) AND public.nrs_is_made_to_order_dress_variant(p.id,v.size) ORDER BY p.id,v.size`,[ids])).rows;
  assert.equal(catalogue.length,77);
  assert.equal(new Set(catalogue.map(row=>`${row.id}:${row.size}`)).size,77);
  assert.ok(catalogue.every(row=>row.fulfillment_mode==='made_to_order'&&row.is_active&&row.stock_quantity===0));
  assert.equal((await db.query(`SELECT count(*)::int n FROM public.product_variants WHERE product_id=ANY($1::text[]) AND size='S' AND NOT is_active`,[ids])).rows[0].n,11);
  assert.equal((await db.query("SELECT has_function_privilege('anon','public.nrs_is_made_to_order_dress_variant(text,text)','EXECUTE') AS allowed")).rows[0].allowed,false);

  const chosen=await db.query("SELECT id FROM public.product_variants WHERE product_id=$1 AND size='32' AND is_active",[ids[0]]);
  const variantId=chosen.rows[0].id;
  const create=async(orderId,userId,requestKey,variant=variantId,size='32')=>{
    const summary=summaryFor(ids[0],names[0],size);
    return db.query('SELECT public.nrs_create_payment_order($1::uuid,$2::uuid,NULL,$3::uuid,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8) AS result',
      [orderId,userId,requestKey,'c'.repeat(64),JSON.stringify([{productId:ids[0],variantId:variant,quantity:1}]),JSON.stringify(f.customer),JSON.stringify(f.historicalRecord(orderId,summary)),'test-bank']);
  };
  const first='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',second='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  assert.equal((await create(first,f.userId,first)).rows[0].result.created,true);
  assert.equal((await create(second,f.otherId,second)).rows[0].result.created,true);
  const recorded=(await db.query('SELECT o.id,l.order_summary->\'items\'->0->>\'size\' AS size FROM public.orders o JOIN public.order_legal_records l ON l.order_id=o.id WHERE o.id=ANY($1::uuid[]) ORDER BY o.id',[ [first,second] ])).rows;
  assert.deepEqual(recorded.map(row=>row.size),['32','32']);
  assert.equal((await db.query("SELECT stock_quantity FROM public.product_variants WHERE id=$1",[variantId])).rows[0].stock_quantity,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.payment_stock_reservations WHERE order_id=ANY($1::uuid[])',[[first,second]])).rows[0].n,0);
  const legacy=(await db.query("SELECT id FROM public.product_variants WHERE product_id=$1 AND size='S'",[ids[0]])).rows[0].id;
  const staleId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
  await assert.rejects(create(staleId,f.userId,staleId,legacy,'S'),/stock unavailable/);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.orders WHERE id=$1::uuid',[staleId])).rows[0].n,0);
 } finally { await db.close(); }
});

test('Made-to-order dresses are limited to the seven numeric sizes',()=>{
 const source=f.read('src/lib/dress-sizes.ts');
 const migration=f.read('supabase/migrations/20261019130000_made_to_order_numeric_dresses.sql');
 const sizing=load('src/lib/dress-sizes.ts');
 const unordered=sizes.slice().reverse().map((size,index)=>({id:`variant-${index}`,label:size,size,stock:0}));
 const options=sizing.numericDressVariantOptions(unordered);
 assert.deepEqual(options.map(option=>option.size),sizes);
 assert.ok(options.every(option=>option.stock===0&&option.id));
 assert.equal(sizing.isMadeToOrderVariant(ids[0],'made_to_order','32'),true);
 assert.equal(sizing.isMadeToOrderVariant(ids[0],'made_to_order','S'),false);
 assert.equal(sizing.isMadeToOrderVariant('jade-desenli-ipeksi-tulum','made_to_order','S'),true);
 assert.equal(sizing.isMadeToOrderVariant('jade-desenli-ipeksi-tulum','stock','S'),false);
 assert.equal(sizing.isMadeToOrderVariant(ids[0],'stock','32'),false);
 assert.equal(ids.length* sizes.length,77);
 assert.match(source,/MADE_TO_ORDER_DRESS_IDS = NUMERIC_DRESS_PRODUCT_IDS/);
 assert.match(migration,/RAISE EXCEPTION 'Made-to-order dress identity\/eligibility preflight failed/);
 assert.match(migration,/UPDATE public\.products p SET fulfillment_mode='made_to_order'/);
 assert.match(migration,/stock_quantity,\s*is_active\)/);
 assert.match(migration,/payment_stock_reservations/);
 assert.doesNotMatch(migration,/9999|999/);
});

test('PostgreSQL: every sale-open product becomes made to order and sells beyond stock without reservations',async()=>{
 const db=new PGlite();
 try {
  await f.setup(db);
  await db.exec(`ALTER TABLE public.products ADD COLUMN payment_test_only boolean NOT NULL DEFAULT false;
    ALTER TABLE public.products ADD COLUMN category_id uuid;
    UPDATE public.products SET category_id=gen_random_uuid(), in_stock=false WHERE id='product';
    INSERT INTO public.products(id,name,description,price_amount,compare_at_price,currency,status,in_stock,category_id,payment_test_only)
    VALUES ${ids.map((id,i)=>`('${id}','${names[i]}','Drape kumaşlı elbise',100,120,'TRY','active',true,gen_random_uuid(),false)`).join(',')},
      ('payment-test','Deneme','Deneme',3,NULL,'TRY','active',true,gen_random_uuid(),true);
    INSERT INTO public.product_variants(id,product_id,size,stock_quantity,is_active)
    SELECT gen_random_uuid(),id,'S',3,true FROM public.products WHERE id IN (${ids.map(id=>`'${id}'`).join(',')});
    INSERT INTO public.product_variants(product_id,size,stock_quantity,is_active) VALUES('payment-test',NULL,1,true);`);
  await db.exec(f.read('supabase/migrations/20261019120000_optional_personal_measurements.sql'));
  await db.exec(f.read('supabase/migrations/20261019130000_made_to_order_numeric_dresses.sql'));
  await db.exec(f.read('supabase/migrations/20261025120000_made_to_order_all_products.sql'));

  const modes=Object.fromEntries((await db.query('SELECT id,fulfillment_mode,in_stock FROM public.products')).rows.map(row=>[row.id,row]));
  assert.equal(modes.product.fulfillment_mode,'made_to_order');
  assert.equal(modes.product.in_stock,true);
  assert.equal(modes['payment-test'].fulfillment_mode,'stock');
  await db.exec(`INSERT INTO public.products(id,name,description,price_amount,currency,status,in_stock) VALUES('new-product','Yeni','Yeni',100,'TRY','draft',false)`);
  assert.equal((await db.query("SELECT fulfillment_mode FROM public.products WHERE id='new-product'")).rows[0].fulfillment_mode,'made_to_order');
  assert.equal((await db.query("SELECT has_function_privilege('anon','public.nrs_is_made_to_order_dress_variant(text,text)','EXECUTE') AS allowed")).rows[0].allowed,false);
  assert.equal((await db.query("SELECT public.nrs_is_made_to_order_dress_variant('product','M') AS ok")).rows[0].ok,true);
  assert.equal((await db.query("SELECT public.nrs_is_made_to_order_dress_variant('payment-test',NULL) AS ok")).rows[0].ok,false);
  assert.equal((await db.query(`SELECT public.nrs_is_made_to_order_dress_variant('${ids[0]}','S') AS ok`)).rows[0].ok,false);

  await db.exec(`UPDATE public.product_variants SET stock_quantity=0 WHERE id='${f.variantId}'`);
  const orders=['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'];
  for(const orderId of orders){
   const result=await db.query('SELECT public.nrs_create_payment_order($1::uuid,$2::uuid,NULL,$1::uuid,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7) AS result',
    [orderId,f.userId,'d'.repeat(64),JSON.stringify(f.items),JSON.stringify(f.customer),JSON.stringify(f.historicalRecord(orderId,f.summary)),'test-bank']);
   assert.equal(result.rows[0].result.created,true);
  }
  assert.equal((await db.query('SELECT stock_quantity FROM public.product_variants WHERE id=$1',[f.variantId])).rows[0].stock_quantity,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM public.payment_stock_reservations WHERE order_id=ANY($1::uuid[])',[orders])).rows[0].n,0);
 } finally { await db.close(); }
});
