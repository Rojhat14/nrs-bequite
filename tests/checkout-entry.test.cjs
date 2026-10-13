const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loader } = require('./source-loader.cjs');

const animation = { m: { div: ({ children }) => React.createElement('div', null, children), aside: ({ children, ...props }) => React.createElement('aside', props, children) }, AnimatePresence: ({ children }) => children };
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

test('Cart drawer checkout preserves the cart and keeps compact WhatsApp access', () => {
  const routes = [], closes = [], updates = [], removals = [];
  const item = { id: 'product-1', variantId: 'variant-1', title: 'Test', price: '₺100', size: 'M', quantity: 2 };
  const cart = { items: [item], isDrawerOpen: true, closeDrawer: () => closes.push(true), removeItem: id => removals.push(id), updateQuantity: (...args) => updates.push(args), subtotalAmount: 200, discountAmount: 0, shippingAmount: 0, totalAmount: 200 };
  const Drawer = loader({ 'framer-motion': animation,
    '@/store/useCart': { getCartItemId: () => 'product-1::variant-1', parsePrice: value => Number(String(value).replace(/[^\d,.-]/g, '').replace(',', '.')), useCart: () => cart },
    '@/hooks/useDialog': { useDialog: () => ({ current: null }) },
    'next/navigation': { useRouter: () => ({ push: path => routes.push(path) }) },
    'next/image': { __esModule: true, default: () => null },
    '@/lib/feature-flags': { useCardPaymentEnabled: () => false },
    '@/components/CartWhatsappOrder': { __esModule: true, default: () => null },
  })('src/components/CartDrawer.tsx').default;
  const tree = Drawer();
  find(tree, node => node.type === 'button' && node.props['aria-label'] === 'Test miktarını artır').props.onClick();
  assert.deepEqual(updates, [['product-1::variant-1', 3]]);
  find(tree, node => node.type === 'button' && node.props['aria-label'] === 'Test ürününü kaldır').props.onClick();
  assert.deepEqual(removals, ['product-1::variant-1']);
  const entry = find(tree, node => node.type === 'button' && node.props['aria-label'] === 'Ödemeye geç');
  assert.ok(entry); entry.props.onClick();
  assert.deepEqual(routes, ['/checkout']); assert.equal(closes.length, 1);
  assert.deepEqual(cart.items, [item]);
  assert.ok(find(tree, node => node.props?.items === cart.items));
  const html = renderToStaticMarkup(tree);
  assert.match(html, /Sepetiniz/); assert.match(html, /2 ürün/); assert.match(html, /₺200/);
  assert.doesNotMatch(html, /Ödeme yöntemi|IBAN bilgisi|kesin sipariş onayı değildir/);
  assert.equal(find(tree, node => node.type === 'button' && node.props.children === 'Ölçülerle Sipariş Oluştur'), null);
});
