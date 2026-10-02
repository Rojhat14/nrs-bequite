import AdminLoginForm from '@/components/admin/AdminLoginForm'

interface AdminLoginPageProps {
  searchParams?: Promise<{ reason?: string }>
}

export default async function AdminLoginPage({ searchParams: searchParamsPromise }: AdminLoginPageProps) {
  const searchParams = await searchParamsPromise
  const reason = searchParams?.reason

  const notice = reason === 'not-authorized'
    ? 'Bu hesap için aktif yönetici erişimi bulunamadı.'
    : reason === 'setup'
      ? 'Yönetici erişimi henüz yapılandırılmadı. Admin kurulumu tamamlandığında tekrar deneyin.'
      : null

  return <AdminLoginForm notice={notice} />
}
