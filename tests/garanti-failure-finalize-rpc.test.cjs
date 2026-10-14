const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

const db = new PGlite();
const failedOrder = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const paidOrder = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const variant = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const payload = (orderId, status, eventId) => ({
  merchantId: 'merchant', merchantReference: orderId, transactionId: `terminal:${orderId}`,
  eventId, amountMinor: 300, currency: 'TRY', status,
  threeDS: status === 'paid' ? 'authenticated' : 'failed',
});

test.before(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE public.orders(id uuid PRIMARY KEY,status text NOT NULL);
    CREATE TABLE public.payment_orders(order_id uuid PRIMARY KEY,merchant_reference uuid UNIQUE NOT NULL,
      provider text NOT NULL,state text NOT NULL,amount_minor bigint NOT NULL,currency text NOT NULL,
      transaction_id text,redirect_url text,updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE public.payment_events(provider text NOT NULL,event_id text NOT NULL,order_id uuid NOT NULL,
      transaction_id text NOT NULL,amount_minor bigint NOT NULL,currency text NOT NULL,state text NOT NULL,
      three_ds text NOT NULL,merchant_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY(provider,event_id));
    CREATE TABLE public.payment_stock_reservations(order_id uuid NOT NULL,variant_id uuid NOT NULL,
      quantity integer NOT NULL,released boolean NOT NULL DEFAULT false,PRIMARY KEY(order_id,variant_id));
    CREATE TABLE public.product_variants(id uuid PRIMARY KEY,stock_quantity integer NOT NULL);
    INSERT INTO public.orders VALUES('${failedOrder}','payment_pending'),('${paidOrder}','paid');
    INSERT INTO public.payment_orders(order_id,merchant_reference,provider,state,amount_minor,currency,redirect_url)
      VALUES('${failedOrder}','${failedOrder}','garanti-oos','pending',300,'TRY','submitted'),
        ('${paidOrder}','${paidOrder}','garanti-oos','paid',300,'TRY',NULL);
    INSERT INTO public.product_variants VALUES('${variant}',0);
    INSERT INTO public.payment_stock_reservations VALUES('${failedOrder}','${variant}',1,false);
    GRANT SELECT ON public.orders,public.payment_orders,public.payment_events,
      public.payment_stock_reservations,public.product_variants TO service_role;`);
  await db.exec(fs.readFileSync('supabase/migrations/20261014120000_garanti_failure_reconciliation.sql', 'utf8'));
});

test.after(async () => db.close());

test('verified failure releases stock once; replay is idempotent; late success and paid failure cannot change state', async () => {
  await db.exec('SET ROLE service_role');
  try {
    const failure = payload(failedOrder, 'failed', 'verified-failure-event');
    await db.query('SELECT public.nrs_finalize_payment($1::jsonb,$2)', [JSON.stringify(failure), 'garanti-oos']);
    await db.query('SELECT public.nrs_finalize_payment($1::jsonb,$2)', [JSON.stringify(failure), 'garanti-oos']);
    assert.equal((await db.query('SELECT state FROM public.payment_orders WHERE order_id=$1::uuid', [failedOrder])).rows[0].state, 'failed');
    assert.equal((await db.query('SELECT status FROM public.orders WHERE id=$1::uuid', [failedOrder])).rows[0].status, 'payment_failed');
    assert.equal((await db.query('SELECT stock_quantity FROM public.product_variants WHERE id=$1::uuid', [variant])).rows[0].stock_quantity, 1);
    assert.equal((await db.query('SELECT released FROM public.payment_stock_reservations WHERE order_id=$1::uuid', [failedOrder])).rows[0].released, true);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.payment_events WHERE order_id=$1::uuid', [failedOrder])).rows[0].n, 1);

    await assert.rejects(db.query('SELECT public.nrs_finalize_payment($1::jsonb,$2)', [
      JSON.stringify(payload(failedOrder, 'paid', 'late-success-event')), 'garanti-oos']), /terminal payment already finalized/);
    await assert.rejects(db.query('SELECT public.nrs_finalize_payment($1::jsonb,$2)', [
      JSON.stringify(payload(paidOrder, 'failed', 'failure-after-paid')), 'garanti-oos']), /terminal payment already finalized/);
    assert.equal((await db.query('SELECT status FROM public.orders WHERE id=$1::uuid', [paidOrder])).rows[0].status, 'paid');
    assert.equal((await db.query('SELECT stock_quantity FROM public.product_variants WHERE id=$1::uuid', [variant])).rows[0].stock_quantity, 1);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM public.payment_events')).rows[0].n, 1);
  } finally {
    await db.exec('RESET ROLE');
  }
});
