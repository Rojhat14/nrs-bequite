import type { LegalDocument } from '@/lib/legal/versions/v1'

export default function LegalDocumentContent({ document }: { document: LegalDocument }) {
  return <div className="space-y-8">
    {document.sections.map((section, index) => <section key={section.title} className="space-y-3 border-b border-nrs-ink/10 pb-6">
      <h2 className="font-serif text-xl sm:text-2xl text-nrs-ink">{index + 1}. {section.title}</h2>
      {section.paragraphs.map((paragraph, i) => <p key={i} className="text-sm sm:text-base leading-7 text-nrs-ink/75 break-words">{paragraph}</p>)}
    </section>)}
  </div>
}
