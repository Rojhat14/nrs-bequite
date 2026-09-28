import { requireAdmin } from '@/lib/auth/requireAdmin'
import AdminShell from '@/components/admin/AdminShell'

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return <AdminShell>{children}</AdminShell>
}
