const styles: Record<string, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  draft: 'border-stone-200 bg-stone-50 text-stone-600',
  archived: 'border-stone-200 bg-stone-100 text-stone-500',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  delivered: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  shipped: 'border-sky-200 bg-sky-50 text-sky-800',
  processing: 'border-blue-200 bg-blue-50 text-blue-800',
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  payment_pending: 'border-amber-200 bg-amber-50 text-amber-800',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-800',
  refunded: 'border-violet-200 bg-violet-50 text-violet-800',
}

export default function AdminStatusBadge({ value }: { value: string }) {
  const label = value.replaceAll('_', ' ')
  return <span className={`inline-flex border px-2 py-1 text-[10px] uppercase tracking-[0.1em] ${styles[value] ?? 'border-[#E4DED2] bg-white text-[#777165]'}`}>{label}</span>
}
