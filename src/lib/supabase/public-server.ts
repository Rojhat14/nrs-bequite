import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Anonymous, RLS-governed client for public storefront reads.
 * It deliberately does not read request cookies or inherit a customer JWT, so
 * results are safe to reuse in the shared storefront data cache.
 */
export function createSupabasePublicServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Supabase public server environment is not configured.')
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
