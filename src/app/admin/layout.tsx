import '../globals-admin.css'

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#F7F5F0] text-[#11110F]">{children}</div>
}
