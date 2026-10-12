// Source/invariant checklist only; never represents production DB verification.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const { loader } = require('../tests/source-loader.cjs');
const load = loader();
const { LEGAL_ROUTES, LEGAL_DOCUMENT_VERSIONS } = load('src/lib/legal/documents.ts');
const { paymentAvailable } = load('src/lib/payment/provider.ts');
const read = path => fs.readFileSync(path, 'utf8');
const checks = [];
function check(name, passed, evidence) { checks.push({ name, status: passed ? 'SOURCE_PASS' : 'FAIL', evidence }); }
check('Legal pages', LEGAL_ROUTES.every(route => fs.existsSync('src/app' + route + '/page.tsx')), '8 explicit routes');
check('Footer and sitemap', read('src/components/Footer.tsx').includes('LEGAL_ROUTES') && read('src/app/sitemap.ts').includes('LEGAL_ROUTES'), 'Shared route list');
check('Checkout legal consent', read('src/app/checkout/page.tsx').includes('useState<string | null>(null)') && read('src/components/legal/CheckoutLegalConsent.tsx').includes('type="checkbox"'), 'Initial consent is null/unselected');
check('Consent before payment request', read('src/app/checkout/page.tsx').indexOf('withLegalAcceptance({') < read('src/app/checkout/page.tsx').indexOf("fetch('/api/payment/create'"), 'UI + server tests');
check('Payment obligation button', read('src/app/checkout/page.tsx').includes('Siparişi Ver ve Ödeme Yap'), 'Hidden while payment unavailable');
check('Server preflight', read('src/lib/payment/service.ts').includes('parsePaymentRequest(body)'), 'Strict legal versions and request parser');
check('Trusted prices and stock', read('src/lib/payment/repository.ts').includes("db.from('products')") && read('src/lib/payment/repository.ts').includes('variant.stock_quantity < item.quantity'), 'Catalog quote + locked SQL recheck');
check('Atomic order and legal', read('supabase/migrations/20261008130000_payment_order_transactions.sql').includes('INSERT INTO public.order_legal_records'), 'Single SQL function, transaction rollback tests');
check('Stock locking and idempotency', read('supabase/migrations/20261008130000_payment_order_transactions.sql').includes('pg_advisory_xact_lock') && read('supabase/migrations/20261008130000_payment_order_transactions.sql').includes('FOR UPDATE'), 'Keys + locks + unique constraints');
check('Provider and secret boundaries', read('src/lib/payment/provider.ts').includes("import 'server-only'") && read('.env.example').includes('PAYMENT_ENABLED=false'), 'No real provider registered');
check('Callback and 3DS verification interfaces only', read('src/app/api/payment/callback/route.ts').includes('processPaymentCallback') && read('src/app/api/payment/return/route.ts').includes('provider.verifyReturn'), 'No real adapter: interfaces require verification; local DB checks amount/currency/transaction');
check('Contract versions match RPC', ['contract', 'preInformation'].every(k => read('supabase/migrations/20261009130000_payment_transaction_hardening.sql').includes("FROM '" + LEGAL_DOCUMENT_VERSIONS[k] + "'")), 'Current v1.1; v1.0 archive preserved');
check('Hashes and snapshot', ['document_hash', 'summary_hash', 'order_summary', 'accepted_at'].every(k => read('src/lib/legal/payment-preflight.ts').includes(k)), 'Deterministic SHA-256 + server acceptance time');
check('Legal FK and immutability', read('supabase/migrations/20261008120000_order_legal_records.sql').includes('REFERENCES public.orders(id) ON DELETE RESTRICT') && read('supabase/migrations/20261008120000_order_legal_records.sql').includes('BEFORE UPDATE OR DELETE'), 'Local PostgreSQL FK/RLS tests; live pending');
check('Guest access', read('src/app/api/payment/create/route.ts').includes('if (!user)') && read('src/lib/payment/access.ts').includes('randomBytes(32)'), 'New guest checkout disabled; legacy hashed capability has expiry and no ID-only access');
check('Success/failure server status', read('src/components/payment/PaymentResult.tsx').includes("order?.status === 'paid'"), 'No browser success flag accepted');
check('Profile and admin documents', read('src/app/profile/components/OrderHistory.tsx').includes('OrderLegalDocuments') && read('src/app/admin/(protected)/orders/[id]/page.tsx').includes('OrderLegalDocuments'), 'Existing authentication preserved');
check('Payment is unavailable', paymentAvailable() === false, 'Disabled/default gate + empty real adapter registry');
for (const [name, paths] of [
  ['WhatsApp flow preserved', ['src/lib/whatsapp-order.ts']],
  ['Bank transfer flow preserved', ['src/components/BankTransferInfo.tsx']],
  ['Products, prices, categories, stock and cart preserved', ['src/lib/products.ts','src/store/useCart.ts']],
  ['Authentication and existing RLS preserved', ['src/context/AuthContext.tsx','middleware.ts','supabase/migrations/20260928130000_admin_panel_access.sql']],
]) check(name, execFileSync('git', ['diff','HEAD','--',...paths], { encoding: 'utf8' }).trim() === '', 'No tracked source diff in protected paths');
check('Order ACL and RLS hardening prepared', read('supabase/migrations/20261009120000_order_access_hardening.sql').includes('REVOKE ALL ON public.orders,public.order_items'), 'Local table and column privilege tests; NOT APPLIED');
checks.push({ name: 'Production Supabase schema, migration, ownership and RLS', status: 'NOT_VERIFIED', evidence: 'Live access explicitly forbidden; only local representative PostgreSQL schema tested' });
checks.push({ name: 'Business shipping/delivery policy', status: 'NOT_CONFIGURED', evidence: 'PAYMENT_SHIPPING_MINOR and PAYMENT_DELIVERY_TERMS require confirmed business policy' });
checks.push({ name: 'Real provider sandbox and production deployment', status: 'NOT_PERFORMED', evidence: 'Bank protocol/credentials absent; no deployment performed' });
assert.ok(checks.every(c => c.status !== 'FAIL'), 'Source checklist failed');
const report = { checkedAt: new Date().toISOString(), finalStatus: 'PARTIALLY_READY', scope: 'Source checks, NOT production certification', checks };
fs.writeFileSync('Raporlar/NRS_PAYMENT_READINESS_CHECKLIST.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ sourceChecks: checks.filter(c => c.status === 'SOURCE_PASS').length, productionReadiness: report.finalStatus, unresolved: checks.filter(c => c.status !== 'SOURCE_PASS') }, null, 2));
