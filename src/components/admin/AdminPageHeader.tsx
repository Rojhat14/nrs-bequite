import type { ReactNode } from 'react'

export default function AdminPageHeader({ eyebrow = 'NRS ADMIN', title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col justify-between gap-5 border-b border-[#E4DED2] pb-6 sm:flex-row sm:items-end">
      <div>
        <p className="text-[9px] uppercase tracking-[0.32em] text-[#9A8358]">{eyebrow}</p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight text-[#11110F] sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#777165]">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}
