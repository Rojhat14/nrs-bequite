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
function productHarness({ stock = 2, inStock = true, variants = true, bag = [] } = {}) {
  let cursor = 0;
  const slots = [], additions = [], routes = [], drawers = [];
  const store = { items: bag, addItem: (...args) => additions.push(args), openDrawer: () => drawers.push(true) };
  const fakeReact = { ...React, useEffect() {}, useCallback: fn => fn, useRef: () => ({ current: null }), useState(initial) {
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

test('Product checkout entry reports a missing size beside the picker and requires a real stocked variant and valid quantity', () => {
  const h = productHarness();
  let tree = h.render();
  const checkout = () => find(tree, node => node.type === 'button' && node.props.children === 'Ödeme / Siparişe geç');
  assert.equal(checkout().props.disabled, false);
  checkout().props.onClick();
  assert.equal(h.additions.length, 0);
  tree = h.render();
  assert.ok(find(tree, node => node.type === 'p' && node.props.id === 'product-size-error'));
  assert.equal(find(tree, node => node.type === 'p' && node.props.id === 'whatsapp-order-error'), null);
  find(tree, node => node.type === 'button' && node.props.children === 'M · 38').props.onClick();
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
  assert.ok(find(tree, node => node.type === 'button' && node.props['aria-label'] === 'WhatsApp üzerinden Test Ürün için sipariş ver'));
});

test('Out-of-stock and variantless products cannot enter checkout; no synthetic variant is created', () => {
  const unavailable = productHarness({ inStock: false });
  const button = find(unavailable.render(), node => node.type === 'button' && node.props.children === 'Ödeme / Siparişe geç');
  assert.equal(button.props.disabled, true); button.props.onClick();
  assert.equal(unavailable.additions.length, 0);
  const sizeless = productHarness({ variants: false });
  const unavailableSize = find(sizeless.render(), node => node.type === 'button' && node.props.children === 'Ödeme / Siparişe geç');
  assert.equal(unavailableSize.props.disabled, true);
  unavailableSize.props.onClick();
  assert.equal(sizeless.additions.length, 0);
  assert.deepEqual(sizeless.routes, []);
});

test('real dresses offer sorted 32–44 only from real variant IDs and never invent stock', () => {
  const sizes = loader()('src/lib/dress-sizes.ts');
  assert.equal(sizes.NUMERIC_DRESS_PRODUCT_IDS.size, 11);
  assert.equal(sizes.isNumericDressProduct({ id: 'noir-crystal-collar-saten-elbise', category: 'فساتين' }), true);
  assert.equal(sizes.isNumericDressProduct({ id: 'jade-desenli-ipeksi-tulum', category: 'Elbiseler' }), false);
  assert.equal(sizes.isNumericDressProduct({ id: 'nocturne-boncuk-islemeli-lacivert-tul-kimono', category: 'Elbiseler' }), false);
  const actual = ['32', '34', '36', '38', '40', '42', '44'].map((size, index) => ({
    id: `variant-${size}`, label: size, size, stock: size === '36' ? 2 : size === '40' ? 0 : index + 1,
  }));
  const options = sizes.numericDressVariantOptions(actual);
  assert.deepEqual(options.map(option => option.size), ['32','34','36','38','40','42','44']);
  assert.equal(options[2].id, 'variant-36'); assert.equal(options[2].stock, 2);
  assert.equal(options[4].id, 'variant-40'); assert.equal(options[4].stock, 0);
  assert.equal(options.length, 7);
  assert.equal(sizes.numericDressVariantOptions(actual.slice(0, 1)), null);
  assert.equal(sizes.numericDressVariantOptions([{ id: 'legacy-m', label: 'M', size: 'M', stock: 2 }]), null);
  assert.deepEqual(sizes.sortActualVariantOptions([
    { id: 'l', label: 'L', size: 'L', stock: 1 }, { id: 's', label: 'S', size: 'S', stock: 1 },
    { id: 'm', label: 'M', size: 'M', stock: 1 }, { id: 'xl', label: 'XL', size: 'XL', stock: 1 },
  ]).map(option => option.size), ['S', 'M', 'L', 'XL']);
  assert.deepEqual(sizes.sortActualVariantOptions([
    { id: '40', label: '40', size: '40', stock: 1 }, { id: '32', label: '32', size: '32', stock: 1 },
  ]).map(option => option.size), ['32', '40']);
});

test('Cart drawer checkout preserves the cart and keeps compact WhatsApp access', () => {
  const routes = [], closes = [], updates = [], removals = [];
  const item = { id: 'product-1', variantId: 'variant-1', title: 'Test', price: '₺100', size: 'M', quantity: 2 };
  const cart = { items: [item], isDrawerOpen: true, closeDrawer: () => closes.push(true), removeItem: id => removals.push(id), updateQuantity: (...args) => updates.push(args), subtotalAmount: 200, discountAmount: 0, shippingAmount: 0, totalAmount: 200 };
  const Drawer = loader({ 'framer-motion': animation,
    '@/store/useCart': { getCartItemId: () => 'product-1::variant-1', parsePrice: value => Number(String(value).replace(/[^\d,.-]/g, '').replace(',', '.')),
      getCartLineCampaignPrice: () => ({ normalLineAmount: 200, saleLineAmount: 160 }), useCart: () => cart },
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

test('Localized checkout shell uses a compact header and only the necessary short links', () => {
  const link = { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
  const image = { __esModule: true, default: ({ priority, ...props }) => React.createElement('img', props) };
  const Shell = loader({
    'next/navigation': { usePathname: () => '/ar/checkout' },
    'next/link': link,
    'next/image': image,
    'lucide-react': { ArrowLeft: () => React.createElement('span', null, 'back') },
    '@/components/CartPriceSync': { __esModule: true, default: () => null },
    '@/components/Navigation': { __esModule: true, default: () => React.createElement('nav', null, 'full navigation') },
    '@/components/Newsletter': { __esModule: true, default: () => React.createElement('aside', null, 'newsletter') },
    '@/components/CartDrawer': { __esModule: true, default: () => React.createElement('aside', null, 'cart drawer') },
    '@/context/StorefrontCatalogContext': { StorefrontCatalogProvider: ({ children }) => children },
    '@/context/LocaleContext': { useLocale: () => ({ locale: 'ar', t: key => ({ cart: 'السلة', language: 'اللغة', privacyNotice: 'إشعار البيانات الشخصية', privacyPolicy: 'سياسة الخصوصية', delivery: 'التوصيل' })[key] || key }) },
  })('src/components/StorefrontShell.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Shell, { categories: [], collections: [], footer: React.createElement('footer', null, 'long footer'), children: React.createElement('main', null, 'checkout form') }));
  assert.match(html, /NRS Bequite Luminous/);
  assert.match(html, /checkout form/);
  assert.match(html, /href="\/ar\/cart"/);
  assert.match(html, /href="\/ar\/kvkk"/);
  assert.match(html, /href="\/ar\/gizlilik-politikasi"/);
  assert.doesNotMatch(html, /full navigation|newsletter|cart drawer|long footer/);
});

test('Adding a size again counts what is already in the bag, so a saved cart cannot outgrow the stock', () => {
  const h = productHarness({ stock: 2, bag: [{ id: 'product-1', variantId: 'variant-1', quantity: 2 }] });
  let tree = h.render();
  find(tree, node => node.type === 'button' && node.props.children === 'M · 38').props.onClick();
  tree = h.render();
  find(tree, node => node.type === 'button' && [].concat(node.props.children).includes('Sepete ekle')).props.onClick();
  assert.equal(h.additions.length, 0);
  assert.match(renderToStaticMarkup(h.render()), /sepetinizde zaten 2 adet var; stokta 2 adet/);
  // "Checkout" with the line already in the bag goes to checkout without adding more.
  tree = h.render();
  find(tree, node => node.type === 'button' && node.props.children === 'Ödeme / Siparişe geç').props.onClick();
  assert.equal(h.additions.length, 0);
  assert.deepEqual(h.routes, ['/checkout']);
});
