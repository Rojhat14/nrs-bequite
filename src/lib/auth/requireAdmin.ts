import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/admin/login?reason=sign-in')
  }

  const { data: adminRecord, error: adminError } = await supabase
    .from('admin_users')
    .select('role, is_active')
    .eq('user_id', user.id)
    .maybeSingle()

  if (adminError) {
    redirect('/admin/login?reason=setup')
  }

  if (!adminRecord || adminRecord.role !== 'admin' || !adminRecord.is_active) {
    redirect('/admin/login?reason=not-authorized')
  }

  return user
}
