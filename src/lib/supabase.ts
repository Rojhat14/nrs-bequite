import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// DEBUG: Check if keys are loaded (This will show in browser console)
if (typeof window !== 'undefined') {
  console.log('Supabase URL loaded:', supabaseUrl ? '✅ Yes' : '❌ No');
  console.log('Supabase Key loaded:', supabaseAnonKey ? '✅ Yes' : '❌ No');
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are missing. Please check .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
