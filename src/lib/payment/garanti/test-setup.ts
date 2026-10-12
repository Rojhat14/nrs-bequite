import 'server-only'

// Publish callback reachability before a separate test database exists.
// This mode cannot use any live database or enable order/payment writes.
export function isGarantiTestSetup(env: NodeJS.ProcessEnv = process.env) {
  return env.GARANTI_TEST_SETUP_ONLY === 'true' && env.GARANTI_MODE === 'TEST'
    && env.VERCEL_ENV !== 'production'
    && env.NEXT_PUBLIC_SUPABASE_URL === 'https://nrs-garanti-test-unconfigured.invalid'
    && !env.SUPABASE_SERVICE_ROLE_KEY
    && env.PAYMENT_ENABLED === 'false' && env.PAYMENT_DATABASE_VERIFIED === 'false'
    && env.ORDER_DATABASE_VERIFIED === 'false'
}
