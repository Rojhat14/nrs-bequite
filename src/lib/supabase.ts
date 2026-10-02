import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// Storefront and admin share the same cookie-backed authentication session.
export const supabase = createSupabaseBrowserClient();
