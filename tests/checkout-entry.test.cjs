const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loader } = require('./source-loader.cjs');

const animation = { m: { div: ({ children }) => React.createElement('div', null, children) }, AnimatePresence: ({ children }) => children };
function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean) || null;
  return predicate(node) ? node : find(node.props?.children, predicate);
}
function productHarness({ stock = 2, inStock = true, variants = true } = {}) {
  let cursor = 0;
  const slots = [], additions = [], routes = [], drawers = [];
  const store = { addItem: (...args) => additions.push(args), openDrawer: () => drawers.push(true) };
  const fakeReact = { ...React, useEffect() {}, useRef: () => ({ current: null }), useState(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  } };
  const Detail = loader({
    react: fakeReact, 'framer-motion': animation,
    'next/image': { __esModule: true, default: () => null },
    'next/navigation': { useRouter: () => ({ push: path => routes.push(path) }) },
    '@/store/useCart': { useCart: selector => selector(store), parsePrice: () => 100 },
    '@/context/AuthContext': { useAuth: () => ({ user: null }) },
    '@/lib/supabase': { supabase: {} },
    '@/lib/wishlistClient': { lookupWishlist: async () => false },
    '@/lib/feature-flags': { useCardPaymentEnabled: () => false },
  })('src/components/ProductDetail.tsx').default;
  const product = { id: 'product-1', slug: 'test-product', name: 'Test Ürün', price: '₺100', priceAmount: 100, category: 'Home', inStock,
    variants: variants ? [{ id: 'variant-1', size: 'M', stock_quantity: stock }] : [], galleryImages: [], details: {} };
  return { additions, routes, drawers, render() { cursor = 0; return Detail({ product }); } };
}

test('Product checkout entry stays visible while unavailable and requires a stocked variant and valid quantity', () => {
  const h = productHarness();
  let tree = h.render();
  const checkout = () => find(tree, node => node.type === 'button' && node.props.children === 'Ödeme / Siparişe Geç');
  assert.equal(checkout().props.disabled, true);
  checkout().props.onClick();
  assert.equal(h.additions.length, 0);
  find(tree, node => node.type === 'button' && node.props.children === 'M').props.onClick();
  tree = h.render();
  assert.equal(checkout().props.disabled, false);
  find(tree, node => node.type === 'input' && node.props.type === 'number').props.onChange({ target: { value: '3' } });
  tree = h.render(); checkout().props.onClick();
  assert.equal(h.additions.length, 0); assert.equal(h.routes.length, 0);
  find(tree, node => node.type === 'input' && node.props.type === 'number').props.onChange({ target: { value: '2' } });
  tree = h.render(); checkout().props.onClick();
  assert.equal(h.additions[0][0].variantId, 'variant-1');
  assert.equal(h.additions[0][0].id, 'product-1');
  assert.equal(h.additions[0][1], 2);
  assert.deepEqual(h.routes, ['/checkout']); assert.equal(h.drawers.length, 0);
  assert.ok(find(tree, node => node.type === 'button' && node.props['aria-label'] === "Test Ürün için WhatsApp'tan sipariş ver"));
});

test('Out-of-stock products cannot enter checkout; sizeless products use the same cart path', () => {
  const unavailable = productHarness({ inStock: false });
  const button = find(unavailable.render(), node => node.type === 'button' && node.props.children === 'Ödeme / Siparişe Geç');
  assert.equal(button.props.disabled, true); button.props.onClick();
  assert.equal(unavailable.additions.length, 0);
  const sizeless = productHarness({ variants: false });
  find(sizeless.render(), node => node.type === 'button' && node.props.children === 'Ödeme / Siparişe Geç').props.onClick();
  assert.equal(sizeless.additions[0][0].variantId, undefined);
  assert.deepEqual(sizeless.routes, ['/checkout']);
});

test('Compact cart checkout entry closes the drawer without changing cart data and retains WhatsApp', () => {
  const routes = [], closes = [];
  const item = { id: 'product-1', variantId: 'variant-1', title: 'Test', price: '₺100', size: 'M', quantity: 2 };
  const cart = { items: [item], isDrawerOpen: true, closeDrawer: () => closes.push(true), subtotalAmount: 200, discountAmount: 0, shippingAmount: 0, totalAmount: 200 };
  const Drawer = loader({ 'framer-motion': animation,
    '@/store/useCart': { getCartItemId: () => 'product-1::variant-1', useCart: () => cart },
    '@/hooks/useDialog': { useDialog: () => ({ current: null }) },
    'next/navigation': { useRouter: () => ({ push: path => routes.push(path) }) },
    'next/image': { __esModule: true, default: () => null },
    '@/lib/feature-flags': { useCardPaymentEnabled: () => false },
    '@/components/CartWhatsappOrder': { __esModule: true, default: () => null },
  })('src/components/CartDrawer.tsx').default;
  const tree = Drawer();
  const entry = find(tree, node => node.type === 'button' && node.props.children === 'Ödemeye Geç');
  assert.ok(entry); entry.props.onClick();
  assert.deepEqual(routes, ['/checkout']); assert.equal(closes.length, 1);
  assert.deepEqual(cart.items, [item]);
  assert.equal(find(tree, node => node.props?.items === cart.items).props.compact, true);
  assert.doesNotMatch(renderToStaticMarkup(tree), /Ölçülerle Sipariş Oluştur|Kartla ödeme|IBAN|Ara Toplam/);
  assert.match(renderToStaticMarkup(tree), /Kargo ücretsiz/);
});

test('Compact WhatsApp preserves the full message and checkout keeps its detailed default view', () => {
  const Order = loader()('src/components/CartWhatsappOrder.tsx').default;
  const items = [{ id: 'p1', slug: 'uzun-urun', title: 'Çok uzun bir ürün ismi', size: 'M', measurements: { chest: 92 }, price: '₺99,90', quantity: 2 }];
  const compact = Order({ items, total: 199.8, compact: true });
  const normal = Order({ items, total: 199.8 });
  const normalLink = find(normal, node => node.type === 'a');
  assert.equal(compact.props.href, normalLink.props.href);
  const message = new URL(compact.props.href).searchParams.get('text');
  assert.match(message, /Adet: 2/); assert.match(message, /Beden: M/); assert.match(message, /92/);
  assert.match(message, /Toplam: 199,8 TL/);
  assert.equal(compact.props.rel, 'noopener noreferrer');
  const html = renderToStaticMarkup(compact);
  assert.match(html, /WhatsApp&#x27;tan Sipariş Ver/);
  assert.doesNotMatch(html.replace(/<[^>]*>/g, ''), /IBAN|Mesafeli Satış|kesin sipariş/);
  assert.doesNotMatch(html, /bg-\[#25D366\]/);
  assert.match(renderToStaticMarkup(normal), /Mesafeli Satış Sözleşmesi|kesin sipariş onayı değildir/);
  assert.equal(Order({ items: [], total: 0, compact: true }), null);
  const unavailable = loader({ '@/lib/storefront-config': { whatsappUrl: () => null } })('src/components/CartWhatsappOrder.tsx').default;
  assert.match(renderToStaticMarkup(unavailable({ items, total: 199.8, compact: true })), /role="status"/);
});

test('Many long-name cart rows retain quantity/removal identity, and empty carts have no checkout action', () => {
  const updates = [], removals = [];
  const cart = { items: Array.from({ length: 8 }, (_, i) => ({ id: 'product-' + i, variantId: 'variant-' + i, title: 'UzunÜrünİsmi'.repeat(12) + i, price: '₺100', size: 'XL', quantity: 2 })),
    isDrawerOpen: true, closeDrawer() {}, updateQuantity: (...args) => updates.push(args), removeItem: id => removals.push(id), shippingAmount: 0, totalAmount: 1600 };
  const Drawer = loader({ 'framer-motion': animation,
    '@/store/useCart': { getCartItemId: item => item.id + '::' + item.variantId, useCart: () => cart },
    '@/hooks/useDialog': { useDialog: () => ({ current: null }) },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    'next/image': { __esModule: true, default: () => null },
    '@/components/CartWhatsappOrder': { __esModule: true, default: () => null },
  })('src/components/CartDrawer.tsx').default;
  const tree = Drawer();
  const list = find(tree, node => node.props?.role === 'list');
  assert.equal(list.props.children.length, 8);
  const last = list.props.children[7];
  find(last, node => node.type === 'button' && node.props.children === '+').props.onClick();
  find(last, node => node.type === 'button' && node.props.children === '−').props.onClick();
  find(last, node => node.type === 'button' && node.props.children === 'Kaldır').props.onClick();
  assert.deepEqual(updates, [['product-7::variant-7', 3], ['product-7::variant-7', 1]]);
  assert.deepEqual(removals, ['product-7::variant-7']);
  assert.match(renderToStaticMarkup(tree), /₺1.600/);
  cart.items = [];
  const empty = Drawer();
  assert.match(renderToStaticMarkup(empty), /Your bag is currently empty/);
  assert.equal(find(empty, node => node.type === 'button' && node.props.children === 'Ödemeye Geç'), null);
});
