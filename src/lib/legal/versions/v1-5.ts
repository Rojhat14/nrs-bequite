import { DOCUMENTS_V1_4, SELLER_V1_4 } from './v1-4'

// A new publication fixes the earlier statement that personal measurements
// are mandatory. Previous accepted snapshots remain immutable in v1.4.
export const SELLER_V1_5 = SELLER_V1_4
export const DOCUMENTS_V1_5 = structuredClone(DOCUMENTS_V1_4)

const optionalSize = 'Ürün sayfasında sunulan sayısal bedenlerden biri seçilerek siparişe devam edilebilir. Göğüs, bel, basen, boy veya diğer kişisel ölçüleri paylaşmak isteğe bağlıdır; yalnızca bilinen ölçüler girilebilir. Standart beden seçimi tek başına ürünün kişiye özel olarak hazırlandığı anlamına gelmez ve emredici tüketici haklarını sınırlamaz. Ayrı bir kişiselleştirme seçeneği sunulursa kapsamı ve koşulları siparişten önce ayrıca açıklanır.'
const optionalMeasurementPrivacy = 'Göğüs, bel, basen, boy, omuz, kol, ürün ve iç bacak ölçüleri müşteri tarafından isteğe bağlı olarak paylaşılırsa yalnız ilgili siparişin hazırlanmasına yardımcı olmak için kullanılır. Sağlık bilgisi istenmez. Ölçüler reklam, müşteri profillemesi veya başka siparişler için kendiliğinden yeniden kullanılmaz. Kanuni delil saklama zorunluluğu varsa kullanım yalnız ilgili hakkın korunmasıyla sınırlanır.'

for (const document of Object.values(DOCUMENTS_V1_5)) {
  for (const section of document.sections) {
    section.paragraphs = section.paragraphs.map(text => {
      if (text.startsWith('Bütün NRS kıyafetleri müşterinin ürün bazında')) return optionalSize
      if (text.startsWith('NRS kıyafetleri müşterinin ürün bazında ilettiği beden ölçülerine göre')) return optionalSize
      if (text.startsWith('Göğüs, bel, basen, boy, omuz, kol, ürün ve iç bacak ölçüleri yalnız ilgili siparişin hazırlanması')) return optionalMeasurementPrivacy
      return text
    })
  }
}
