'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getLegalDocument, legalDocumentHref } from '@/lib/legal/documents'
import { isLegalOrderSummary, type OrderLegalRecord } from '@/lib/legal/order-summary'
import LegalOrderSummary from './LegalOrderSummary'
import LegalDocumentContent from './LegalDocumentContent'
import { useLocale } from '@/context/LocaleContext'
import { localePrefix } from '@/lib/i18n/messages'

export default function OrderLegalDocuments({ orderId }: { orderId: string }) {
  const { locale } = useLocale()
  const prefix = localePrefix(locale)
  const copy = (tr: string, en: string, ar: string) => locale === 'ar' ? ar : locale === 'en' ? en : tr
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
      if (!data) { setMessage(copy('Bu sipariş için kayıtlı sözleşme kabulü bulunamadı. Belge talebi için bizimle iletişime geçebilirsiniz.', 'No agreement acceptance record was found for this order. Contact us to request the documents.', 'لم يُعثر على سجل قبول اتفاقية لهذا الطلب. تواصلوا معنا لطلب المستندات.')); return }
      if (data.order_id !== orderId || data.contract_accepted !== true || !Number.isFinite(Date.parse(data.accepted_at))
        || !isLegalOrderSummary(data.order_summary)) throw new Error('Invalid legal record')
      setRecord(data as OrderLegalRecord)
    } catch {
      setMessage(copy('Sipariş belgeleri şu anda yüklenemiyor. Tekrar deneyebilir veya bizimle iletişime geçebilirsiniz.', 'Order documents are unavailable right now. Try again or contact us.', 'مستندات الطلب غير متاحة حالياً. حاولوا مرة أخرى أو تواصلوا معنا.'))
    } finally {
      setLoading(false)
    }
  }

  return <div className="mt-5 space-y-4">
    <button type="button" aria-expanded={opened} aria-controls={`order-documents-${orderId}`}
      onClick={() => { if (opened) setOpened(false); else if (record) setOpened(true); else void load() }}
      className="min-h-11 text-sm underline underline-offset-4 text-left">
      {copy('Sipariş özeti ve sözleşmeler', 'Order summary and agreements', 'ملخص الطلب والاتفاقيات')}
    </button>
    {opened && <div id={`order-documents-${orderId}`} className="space-y-5">
      {loading && <p role="status" className="text-sm">{copy('Belgeler yükleniyor…', 'Loading documents…', 'جارٍ تحميل المستندات…')}</p>}
      {message && <div className="text-sm space-y-3"><p role="status">{message}</p>
        <button type="button" onClick={() => void load()} className="min-h-11 underline">{copy('Tekrar dene', 'Try again', 'حاولوا مرة أخرى')}</button>{' '}
        <Link href={prefix + '/contact'} className="inline-flex min-h-11 items-center underline">{copy('İletişim', 'Contact', 'التواصل')}</Link>
      </div>}
      {record && <>
        <p className="text-xs leading-6 text-nrs-ink/65">{copy('Kabul zamanı', 'Acceptance time', 'وقت القبول')}: {new Date(record.accepted_at).toLocaleString(locale === 'ar' ? 'ar' : locale === 'en' ? 'en-US' : 'tr-TR', { timeZone: 'Europe/Istanbul' })}</p>
        <LegalOrderSummary summary={record.order_summary} />
        {(['contract', 'preInformation'] as const).map(kind => {
          const version = kind === 'contract' ? record.contract_version : record.pre_information_version
          const slug = kind === 'contract' ? 'mesafeli-satis-sozlesmesi' : 'on-bilgilendirme-formu'
          const document = getLegalDocument(slug, version)
          const title = kind === 'contract'
            ? copy('Mesafeli Satış Sözleşmesi', 'Distance Sales Agreement', 'اتفاقية البيع عن بُعد')
            : copy('Ön Bilgilendirme Formu', 'Pre-Contractual Information Form', 'نموذج المعلومات المسبقة')
          return <details key={kind} className="min-w-0 border border-nrs-ink/15 p-4">
            <summary className="min-h-11 cursor-pointer font-serif text-lg">{title} · {version}</summary>
            {document ? <div className="pt-5 space-y-5">
              <p className="text-xs text-nrs-ink/60">{copy('Siparişte kabul edilen kaynak dilindeki metin aynen gösterilir.', 'The accepted source-language text is shown as it was recorded for this order.', 'يُعرض النص باللغة الأصلية الذي سُجل قبوله لهذا الطلب كما هو.')}</p>
              <LegalDocumentContent document={document} />
              <Link href={prefix + legalDocumentHref(kind, version)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm underline">{copy('Kabul edilen metni aç', 'Open accepted text', 'افتحوا النص المقبول')} {version}</Link>
            </div> : <p className="text-sm">{copy('Bu belge sürümü arşivde bulunamadı. Güncel metin eski kabulün yerine gösterilmez; bizimle iletişime geçin.', 'This document version is not in the archive. The current text is not substituted for the earlier acceptance; contact us.', 'إصدار المستند غير موجود في الأرشيف. لا يُستبدل النص الحالي بالقبول السابق؛ تواصلوا معنا.')}</p>}
          </details>
        })}
      </>}
    </div>}
  </div>
}
