export type DescriptionBullet = { label?: string; text: string }
export type ParsedDescription = { paragraphs: string[]; heading?: string; bullets: DescriptionBullet[] }

/** Catalogue descriptions are written as prose followed by an inline list,
 * e.g. "… Öne Çıkan Özellikler: • Kesim: … • Detay: …". Split them so the
 * product page can show paragraphs and a readable list. */
export function parseProductDescription(text: string | null | undefined): ParsedDescription {
  const [intro, ...items] = (text ?? '').split('•').map(part => part.trim())
  let body = intro ?? ''
  let heading: string | undefined
  if (items.length) {
    // A short trailing "Heading:" before the first bullet becomes the list title.
    const match = body.match(/([^.!?\n]{2,40}):\s*$/)
    if (match && match.index !== undefined) {
      heading = match[1].trim()
      body = body.slice(0, match.index).trim()
    }
  }
  const paragraphs = body.split(/\n\s*\n/).map(part => part.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean)
  const bullets = items.filter(Boolean).map(item => {
    const labelled = item.match(/^([^:]{2,30}):\s*([\s\S]+)$/)
    return labelled ? { label: labelled[1].trim(), text: labelled[2].trim() } : { text: item }
  })
  return { paragraphs, heading, bullets }
}
