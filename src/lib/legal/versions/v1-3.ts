import { DOCUMENTS_V1_2, SELLER_V1_2 } from './v1-2'
import { DELIVERY_TERMS } from '@/lib/delivery-policy'
export const SELLER_V1_3 = SELLER_V1_2
export const DOCUMENTS_V1_3 = structuredClone(DOCUMENTS_V1_2)
for (const document of Object.values(DOCUMENTS_V1_3)) {
  for (const section of document.sections) {
    section.paragraphs = section.paragraphs.map(text => {
      if (text.startsWith('Sepette kargo kaleminin') || text.startsWith('Sitedeki sepet şu anda kargo')) return DELIVERY_TERMS + ' Kargo firması henüz seçilmemiştir. Önceden bildirilmeyen ek teslimat bedeli talep edilmez.'
      if (text.startsWith('Taşıyıcı, hazırlık ve teslimat') || text.startsWith('Standart ürünlerde hazırlık süresi')) return DELIVERY_TERMS + ' Bu süre takvim günü değildir; üretime ek bir kargo süresi eklenmez. Gecikme halinde tüketici bilgilendirilir; süresinde ifa etmeme, fesih, geri ödeme ve diğer emredici tüketici hakları korunur.'
      return text.replace('Özel ölçü paylaşmayı seçerseniz', 'Özel dikim kıyafet siparişi için').replace('Standart beden siparişinde özel ölçü girmek zorunlu değildir;', 'Her kıyafet için gerekli ölçüler zorunludur; standart beden bunların yerini almaz;')
    })
  }
}
for (const slug of ['mesafeli-satis-sozlesmesi','on-bilgilendirme-formu','iade-ve-degisim','kargo-ve-teslimat']) {
  DOCUMENTS_V1_3[slug].sections.push({ title: 'Kişiye özel dikim ve ölçüler', paragraphs: [
    'NRS kıyafetleri müşterinin ürün bazında ilettiği beden ölçülerine göre özel dikilir. Standart beden seçimi gerekli ölçülerin yerini almaz. Ürün, ölçüler, teslimat adresi, ücretsiz kargo, sipariş onayından itibaren üretim ve taşımacılık dahil 7–10 iş günü toplam teslimat süresi ve nihai toplam sipariş öncesinde kontrol edilmelidir.',
    'Kişisel ihtiyaç veya özel istek doğrultusunda hazırlanan mallarda cayma hakkı istisnası yalnızca mevzuattaki koşullar gerçekten oluşmuşsa uygulanır. Sadece beden seçimi ya da ölçü formu doldurulması tek başına tüm tüketici haklarını ortadan kaldırmaz. Ayıplı mal, yanlış üretim ve vaat edilen özelliklere aykırılık nedeniyle doğan haklar korunur. İade taşıyıcısı henüz belirlenmemiştir; belirtilmemiş taşıyıcı nedeniyle tüketiciye iade masrafı yüklenmez.',
  ] })
}
