const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { loader } = require('./source-loader.cjs');

const root = path.resolve(__dirname, '..');

test('the checkout header link to /cart has a real page', () => {
  assert.ok(fs.existsSync(path.join(root, 'src/app/cart/page.tsx')));
  assert.match(fs.readFileSync(path.join(root, 'src/components/StorefrontShell.tsx'), 'utf8'), /\/cart`\}/);
});

test('common storefront paths redirect instead of returning 404 in every language', async () => {
  const config = (await import(pathToFileURL(path.join(root, 'next.config.mjs')).href)).default;
  const redirects = await config.redirects();
  for (const prefix of ['', '/en', '/ar']) {
    for (const [source, destination] of [['/wishlist', '/profile'], ['/shop', '/collections'], ['/products', '/collections']]) {
      const rule = redirects.find(item => item.source === `${prefix}${source}`);
      assert.ok(rule, `${prefix}${source} redirect missing`);
      assert.equal(rule.destination, `${prefix}${destination}`);
      assert.equal(rule.permanent, false);
    }
  }
  assert.ok(config.images.minimumCacheTTL >= 60 * 60 * 24);
});

test('product image URLs carry the upload version when one is stored', () => {
  const { getProductImageUrl, versionedProductImageUrl } = loader()(path.join(root, 'src/lib/storage/products.ts'));
  const publicUrl = 'https://example.supabase.co/storage/v1/object/public/product-images/dress/main.webp';
  const supabase = { storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl } }) }) } };
  const image = { provider: 'supabase', storage_key: 'dress/main.webp' };
  assert.equal(versionedProductImageUrl(publicUrl, 42), `${publicUrl}?v=42`);
  assert.equal(getProductImageUrl(supabase, { ...image, url: `${publicUrl}?v=42` }), `${publicUrl}?v=42`);
  assert.equal(getProductImageUrl(supabase, { ...image, url: publicUrl }), publicUrl);
  // A stored URL for another object must not replace the storage key's URL.
  assert.equal(getProductImageUrl(supabase, { ...image, url: 'https://evil.example/x.webp?v=1' }), publicUrl);
});
