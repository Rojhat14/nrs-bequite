const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loader } = require('./source-loader.cjs');

function find(element, type) {
  if (!React.isValidElement(element)) return null;
  if (element.type === type) return element;
  for (const child of React.Children.toArray(element.props.children)) {
    const result = find(child, type);
    if (result) return result;
  }
  return null;
}

test('Embroidery note preserves Turkish text and newlines in the WhatsApp message', () => {
  let note = '';
  const Component = loader({
    react: { ...React, useState: () => [note, value => { note = value; }] },
    '@/lib/storefront-config': { whatsappUrl: message => 'https://wa.me/905000000000?text=' + encodeURIComponent(message) },
  })('src/components/HomeEmbroideryRequest.tsx').default;
  const textarea = find(Component(), 'textarea');
  assert.equal(textarea.props.maxLength, 1500);
  textarea.props.onChange({ target: { value: '  Ş & İ baş harfleri\nKrem iplik, çift kişilik  ' } });
  const tree = Component();
  const anchor = find(tree, 'a');
  const message = new URL(anchor.props.href).searchParams.get('text');
  assert.equal(message, 'Merhaba, NRS HOME kişiye özel nakışlı nevresim için bilgi almak istiyorum.\n\nNakış isteğim: Ş & İ baş harfleri\nKrem iplik, çift kişilik');
  assert.ok(renderToStaticMarkup(tree).includes('Notumu WhatsApp’a Aktar'));
  assert.equal(anchor.props.rel, 'noopener noreferrer');
});

test('Unavailable WhatsApp shows a status without a sending link', () => {
  const Component = loader({ '@/lib/storefront-config': { whatsappUrl: () => null } })('src/components/HomeEmbroideryRequest.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Component));
  assert.ok(html.includes('WhatsApp iletişimi şu anda kullanılamıyor.'));
  assert.ok(html.includes('Bu alan ayrı bir talep kaydı oluşturmaz.'));
  assert.ok(!html.includes('href='));
});

test('Embroidery section appears on all Home aliases and stays absent from clothing pages', async () => {
  for (const slug of ['bedding', 'home', 'nevresim', 'elbiseler']) {
    const Page = loader({
      '@/lib/products': { getCategoryCatalog: async () => ({ category: { id: '', name: slug === 'elbiseler' ? 'Elbiseler' : 'Home', slug }, products: [] }) },
      '@/lib/storage/category-covers': { getHomeCategoryCover: async () => '/home.webp' },
      '@/components/ProductListing': { __esModule: true, default: () => null },
      '@/components/CategoryHero': { __esModule: true, default: ({ children }) => React.createElement('header', null, children) },
    })('src/app/category/[slug]/page.tsx').default;
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ slug }) }));
    assert.equal(html.includes('id="nakis-talebi"'), slug !== 'elbiseler');
    assert.equal(html.includes('href="#nakis-talebi"'), slug !== 'elbiseler');
  }
});
