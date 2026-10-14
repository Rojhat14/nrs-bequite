const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loader } = require('./source-loader.cjs');

test('sitemap excludes payment-test-only products while retaining normal products', async () => {
  const rows = {
    products: [
      { slug: 'deneme', updated_at: '2026-10-01T00:00:00Z', payment_test_only: false, status: 'active' },
      { slug: 'controlled-payment-observation-3try', updated_at: '2026-10-01T00:00:00Z', payment_test_only: true, status: 'active' },
    ],
    categories: [{ slug: 'bedding', updated_at: '2026-10-01T00:00:00Z', is_active: true }],
    collections: [],
  };
  const filters = [];
  const supabase = {
    from(table) {
      let result = [...rows[table]];
      const query = {
        select(columns) { query.columns = columns; return query; },
        eq(key, value) { filters.push([table, key, value]); result = result.filter(row => row[key] === value); return query; },
        order() { return query; },
        range(start, end) { result = result.slice(start, end + 1); return query; },
        then(resolve, reject) { return Promise.resolve({ data: result, error: null }).then(resolve, reject); },
      };
      return query;
    },
  };
  const sitemap = loader({
    '@supabase/supabase-js': { createClient: () => supabase },
    '@/lib/legal/documents': { LEGAL_ROUTES: [] },
    '@/lib/payment/garanti/test-setup': { isGarantiTestSetup: () => false },
  })(path.resolve(__dirname, '..', 'src/app/sitemap.ts')).default;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-anon';
  try {
    const entries = await sitemap();
    const urls = entries.map(entry => entry.url);
    assert.ok(urls.includes('https://nrsbequiteluminous.com/product/deneme'));
    assert.ok(!urls.includes('https://nrsbequiteluminous.com/product/controlled-payment-observation-3try'));
    assert.ok(filters.some(([table, key, value]) => table === 'products' && key === 'payment_test_only' && value === false));
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});
