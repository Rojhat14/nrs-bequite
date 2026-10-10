'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getLegalDocument, legalDocumentHref } from '@/lib/legal/documents'
import { isLegalOrderSummary, type OrderLegalRecord } from '@/lib/legal/order-summary'
import LegalOrderSummary from './LegalOrderSummary'
import LegalDocumentContent from './LegalDocumentContent'

export default function OrderLegalDocuments({ orderId }: { orderId: string }) {
  const [opened, setOpened] = useState(false)
  const [loading, setLoading] = useState(false)
  const [record, setRecord] = useState<OrderLegalRecord | null>(null)
  const [message, setMessage] = useState('')

  async function load() {
    setOpened(true)
    setLoading(true)
    setMessage('')
    try {
      // New table has owner-only SELECT RLS; legacy order/customer policies are unchanged.
      const { data, error } = await supabase.from('order_legal_records')
        .select('order_id,contract_accepted,contract_version,pre_information_version,accepted_at,document_hash,summary_hash,order_summary')
        .eq('order_id', orderId).maybeSingle()
      if (error) throw error
      if (!data) { setMessage('Bu sipariş için kayıtlı sözleşme kabulü bulunamadı. Belge talebi için bizimle iletişime geçebilirsiniz.'); return }
      if (data.order_id !== orderId || data.contract_accepted !== true || !Number.isFinite(Date.parse(data.accepted_at))
        || !isLegalOrderSummary(data.order_summary)) throw new Error('Invalid legal record')
      setRecord(data as OrderLegalRecord)
    } catch {
      setMessage('Sipariş belgeleri şu anda yüklenemiyor. Tekrar deneyebilir veya bizimle iletişime geçebilirsiniz.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="mt-5 space-y-4">
    <button type="button" aria-expanded={opened} aria-controls={`order-documents-${orderId}`}
      onClick={() => { if (opened) setOpened(false); else if (record) setOpened(true); else void load() }}
      className="min-h-11 text-sm underline underline-offset-4 text-left">
      Sipariş özeti ve sözleşmeler
    </button>
    {opened && <div id={`order-documents-${orderId}`} className="space-y-5">
      {loading && <p role="status" className="text-sm">Belgeler yükleniyor…</p>}
      {message && <div className="text-sm space-y-3"><p role="status">{message}</p>
        <button type="button" onClick={() => void load()} className="min-h-11 underline">Tekrar dene</button>{' '}
        <Link href="/contact" className="inline-flex min-h-11 items-center underline">İletişim</Link>
      </div>}
      {record && <>
        <p className="text-xs leading-6 text-nrs-ink/65">Kabul zamanı: {new Date(record.accepted_at).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}</p>
        <LegalOrderSummary summary={record.order_summary} />
        {(['contract', 'preInformation'] as const).map(kind => {
          const version = kind === 'contract' ? record.contract_version : record.pre_information_version
          const slug = kind === 'contract' ? 'mesafeli-satis-sozlesmesi' : 'on-bilgilendirme-formu'
          const document = getLegalDocument(slug, version)
          const title = kind === 'contract' ? 'Mesafeli Satış Sözleşmesi' : 'Ön Bilgilendirme Formu'
          return <details key={kind} className="min-w-0 border border-nrs-ink/15 p-4">
            <summary className="min-h-11 cursor-pointer font-serif text-lg">{title} · {version}</summary>
            {document ? <div className="pt-5 space-y-5">
              <LegalDocumentContent document={document} />
              <Link href={legalDocumentHref(kind, version)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm underline">Kabul edilen {version} metnini aç</Link>
            </div> : <p className="text-sm">Bu belge sürümü arşivde bulunamadı. Güncel metin eski kabulün yerine gösterilmez; bizimle iletişime geçin.</p>}
          </details>
        })}
      </>}
    </div>}
  </div>
}
