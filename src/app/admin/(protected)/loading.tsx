export default function AdminLoading() {
  return <div aria-label="Yönetim verileri yükleniyor" className="mx-auto max-w-7xl animate-pulse">
    <div className="mb-8 h-20 border-b border-[#E4DED2] bg-white/50" />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 7 }, (_, index) => <div key={index} className="h-32 border border-[#E4DED2] bg-white" />)}</div>
    <p className="sr-only">Yükleniyor…</p>
  </div>
}
