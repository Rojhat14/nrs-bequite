import Link from 'next/link'

export default function AdminPagination({ page, pageCount, pathname, query = '' }: { page: number; pageCount: number; pathname: string; query?: string }) {
  if (pageCount <= 1) return null
  const href = (nextPage: number) => `${pathname}?${query ? `${query}&` : ''}page=${nextPage}`
  return (
    <nav aria-label="Sayfalar" className="mt-5 flex items-center justify-between border-t border-[#EEE9DF] pt-4 text-xs text-[#777165]">
      <span>Sayfa {page} / {pageCount}</span>
      <div className="flex gap-2">
        {page > 1 && <Link className="border border-[#D8D0C3] px-3 py-2 hover:bg-[#F8F4EA]" href={href(page - 1)}>Önceki</Link>}
        {page < pageCount && <Link className="border border-[#D8D0C3] px-3 py-2 hover:bg-[#F8F4EA]" href={href(page + 1)}>Sonraki</Link>}
      </div>
    </nav>
  )
}
