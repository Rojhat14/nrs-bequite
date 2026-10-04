const assert = require('node:assert/strict');

const base = new URL(process.argv[2] || 'http://localhost:3100');
assert.ok(['localhost', '127.0.0.1'].includes(base.hostname), 'Run only against a local test server.');

async function main() {
  const categoryRedirects = [
    ['dresses', 'elbiseler'], ['tops', 'ust-giyim'],
    ['blazers', 'ceketler-blazerlar'], ['bottoms', 'alt-giyim'], ['suits', 'takimlar'],
  ];
  for (const [alias, slug] of categoryRedirects) {
    const target = `/category/${slug}`;
    const response = await fetch(new URL(`/category/${alias}`, base), { redirect: 'manual' });
    assert.equal(response.status, 308, `${alias} must permanently redirect.`);
    assert.equal(response.headers.get('location'), target);
    const direct = await fetch(new URL(target, base), { redirect: 'manual' });
    assert.equal(direct.status, 200, `${target} must not redirect.`);
    const followed = await fetch(new URL(`/category/${alias}`, base));
    assert.equal(followed.status, 200);
    assert.equal(new URL(followed.url).pathname, target);
    const html = await followed.text();
    const canonicals = [...html.matchAll(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/g)];
    assert.deepEqual(canonicals.map(match => match[1]), [`https://nrsbequiteluminous.com${target}`]);
    console.log(`PASS redirect ${alias} → ${slug}, target 200 and canonical`);
  }
  for (const source of ['/category/dresses?test=1', '/category/dresses/']) {
    const response = await fetch(new URL(source, base), { redirect: 'manual' });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), source.endsWith('/')
      ? '/category/dresses' : '/category/elbiseler?test=1');
    const followed = await fetch(new URL(source, base));
    assert.equal(followed.status, 200);
    assert.equal(new URL(followed.url).pathname, '/category/elbiseler');
    assert.equal(new URL(followed.url).search, source.includes('?') ? '?test=1' : '');
    console.log(`PASS redirect query/trailing slash ${source}`);
  }
  for (const route of ['/category/sale', '/category/indirim', '/collections/indirim']) {
    const response = await fetch(new URL(route, base), { redirect: 'manual' });
    assert.equal(response.status, 200, `${route} must remain unchanged.`);
    assert.equal(response.headers.get('location'), null);
  }
  const routes = new Set(['/', '/about', '/contact', '/shipping', '/returns', '/faq', '/size-guide', '/care-guide', '/curated', '/collections',
    '/category/dresses', '/category/tops', '/category/blazers', '/category/bottoms', '/category/suits', '/category/sale',
    '/search', '/search?q=elbise', '/checkout', '/checkout/verify', '/checkout/success', '/profile']);
  const failed = [];
  let pageCount = 0;
  for (const route of routes) {
    const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(20000) });
    const html = await response.text();
    const headers = (html.match(/<header\b/g) || []).length;
    const pass = response.status === 200 && headers === 1 && !html.includes('Application error:');
    if (!pass) failed.push(route);
    if (route.startsWith('/product/')) {
      assert.ok(html.includes('object-contain'), 'Gallery must preserve image ratio.');
      if (html.includes('ürün görselini göster')) assert.ok(html.includes('order-first'), 'Multiple images must have left thumbnails.');
    }
    if (route === '/') {
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(response.headers.get('x-powered-by'), null);
    }
    if (pass) {
      for (const match of html.matchAll(/href="(\/[^"<>]*)"/g)) {
        const url = new URL(match[1].replace(/&amp;/g, '&'), base);
        if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/')) continue;
        if (/\.(ico|png|svg|jpe?g|webp|avif|gif)$/i.test(url.pathname)) continue;
        routes.add(url.pathname + url.search);
      }
    }
    pageCount++;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${response.status} ${route} (headers: ${headers})`);
  }
  for (const route of ['/admin', '/admin/products', '/admin/orders']) {
    const response = await fetch(new URL(route, base), { redirect: 'manual' });
    assert.equal(response.status, 307);
    assert.ok(response.headers.get('location').includes('/admin/login'));
    console.log(`PASS protected ${route}`);
  }
  for (const action of ['create', 'callback']) {
    const response = await fetch(new URL(`/api/payment/${action}`, base), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'test-not-an-order', status: 'paid', totalAmount: 0 }),
    });
    assert.equal(response.status, 503);
    console.log(`PASS blocked payment ${action}`);
  }
  console.log(`Pages checked: ${pageCount}; failures: ${failed.length}`);
  assert.deepEqual(failed, [], 'Fix broken internal links before publishing.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
