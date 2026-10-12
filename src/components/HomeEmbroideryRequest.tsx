'use client'

import { useState } from 'react'
import { whatsappUrl } from '@/lib/storefront-config'
import WhatsAppIcon from '@/components/WhatsAppIcon'

export default function HomeEmbroideryRequest() {
  const [note, setNote] = useState('')
  const href = whatsappUrl([
    'Merhaba, NRS HOME kişiye özel nakışlı nevresim için bilgi almak istiyorum.',
    note.trim() ? `Nakış isteğim: ${note.trim()}` : '',
  ].filter(Boolean).join('\n\n'))

  return (
    <section id="nakis-talebi" aria-labelledby="nakis-baslik" className="scroll-mt-32 border-b border-nrs-ink/10 bg-nrs-panel">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-2 md:gap-16 md:py-16">
        <div>
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-nrs-ink/65">NRS HOME · Size özel dikim & nakış</p>
          <h2 id="nakis-baslik" className="text-3xl font-serif leading-tight md:text-4xl">Hayalinizdeki nakış,<br />size özel bir nevresim.</h2>
          <p className="mt-5 max-w-lg leading-7 text-nrs-ink/75">İsim, baş harf, monogram ya da istediğiniz bir desen… Nevresiminizi sizin seçtiğiniz nakış detaylarıyla hazırlamak için birlikte tasarlayalım.</p>
          <p className="mt-4 max-w-lg text-sm leading-7 text-nrs-ink/65">Nakışın rengini, yerini ve nevresim ölçüsünü paylaşabilirsiniz. Beğendiğiniz bir örnek görsel varsa WhatsApp üzerinden bize iletin.</p>
          <p className="mt-6 text-sm leading-6 text-nrs-ink/65">Desenin uygulanabilirliği, fiyat ve hazırlık süresi talebiniz değerlendirildikten sonra sizinle birlikte netleştirilir.</p>
        </div>
        <div className="border border-nrs-ink/15 bg-nrs-canvas p-6 md:p-8">
          <label htmlFor="nakis-notu" className="block font-serif text-2xl">Nakış isteğinizi yazın</label>
          <p id="nakis-yardim" className="mt-2 text-sm leading-6 text-nrs-ink/65">İstediğiniz yazı veya desen, iplik rengi, nakışın yeri ve ölçü gibi detayları ekleyin.</p>
          <textarea id="nakis-notu" value={note} onChange={event => setNote(event.target.value)} maxLength={1500} rows={5}
            aria-describedby="nakis-yardim nakis-gonderim" placeholder="Örn. Yastık kılıflarına R & M baş harfleri, krem rengi iplikle. Çift kişilik nevresim istiyorum."
            className="mt-5 w-full resize-y border border-nrs-ink/25 bg-transparent p-4 text-base leading-6 placeholder:text-nrs-ink/45 focus:outline-none focus:ring-2 focus:ring-nrs-ink" />
          {href ? <a href={href} target="_blank" rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-3 bg-nrs-ink px-5 py-3 text-center text-sm text-nrs-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
            <WhatsAppIcon />{note.trim() ? 'Notumu WhatsApp’a Aktar' : 'WhatsApp’tan Bilgi Al'}
          </a> : <p role="status" className="mt-4 text-sm">WhatsApp iletişimi şu anda kullanılamıyor.</p>}
          <p id="nakis-gonderim" className="mt-4 text-xs leading-6 text-nrs-ink/65">Notunuz WhatsApp mesajına eklenir. Bize ulaşması için açılan WhatsApp ekranında mesajı gönderin. Bu alan ayrı bir talep kaydı oluşturmaz.</p>
        </div>
      </div>
    </section>
  )
}
