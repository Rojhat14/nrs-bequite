import { DOCUMENTS_V1, SELLER_V1, type LegalDocument } from './v1'
export const SELLER_V1_1 = SELLER_V1
export const DOCUMENTS_V1_1: Record<string, LegalDocument> = structuredClone(DOCUMENTS_V1)
const delivery = 'Taşıyıcı, hazırlık ve teslimat süreleri sipariş öncesinde bildirilir. İşletmenin kesinleştirmediği bir süre veya ücret taahhüt edilmez. Standart mal satışlarında mevzuattaki azami 30 günlük ifa süresi korunur. Kişiye özel hazırlanan ürünlerde daha uzun süre taraflarca önceden kararlaştırılabilir.'
const shipping = 'Sepette kargo kaleminin 0 TL olması tüm gönderimlerin ücretsiz olduğu taahhüdü değildir. WhatsApp/havale talebinde kargo ve nihai toplam sipariş teyidinden önce bildirilir. Online ödeme kullanıma açıldığında sunucuda doğrulanmış sipariş özetinde kesin teslimat bedeli ve nihai toplam gösterilir. Teslimat bedeli ve koşulları kesinleşmeden online tahsilat başlatılmaz; önceden bildirilmeyen ek bedel talep edilmez.'
for (const doc of Object.values(DOCUMENTS_V1_1)) {
  for (const section of doc.sections) {
    section.paragraphs = section.paragraphs.map(text => {
      if (text.startsWith('Standart ürünlerde hazırlık süresi')) return delivery
      if (text.startsWith('Sitedeki sepet şu anda kargo bedeli hesaplamaz')) return shipping
      if (text.startsWith('Mevcut sitede online kart tahsilatı kapalıdır.')) return 'Online kartla ödeme yalnızca ödeme özelliği ve doğrulanmış sağlayıcı kullanıma açıldığında sunulur. Ödeme öncesinde nihai özet, sözleşme ve ön bilgilendirme sunulur; zorunlu onay ve ödeme yükümlülüğünü açıkça belirten butonla işlem başlatılır. Bankanın doğrulanmış sonucu alınmadan sipariş ödendi sayılmaz. WhatsApp bağlantısı iletişim/sipariş talebidir; ödeme veya kesin sipariş onayı oluşturmaz. Havale/EFT bilgileri ve nihai tutar sipariş teyidinde paylaşılır.'
      if (text.startsWith('Online kartla ödeme şu anda kapalıdır.')) return 'Online kartla ödeme yalnızca kullanıma açıldığında sunulur; kesin ödeme yöntemi ve tutar sipariş özetinde gösterilir. WhatsApp sipariş talebi ödeme işlemi değildir. Havale/EFT işlemi sipariş ve tutar teyidinden sonra paylaşılan bilgilerle yapılır.'
      return text
    })
  }
}
DOCUMENTS_V1_1['gizlilik-politikasi'].sections = DOCUMENTS_V1_1['gizlilik-politikasi'].sections.filter(section => !/çerez|ödeme/i.test(section.title))
DOCUMENTS_V1_1['gizlilik-politikasi'].sections.push(
  { title: 'Ödeme işlemleri', paragraphs: ['Online ödeme kapalıyken banka çağrısı yapılmaz. Kullanıma açılan sağlayıcının gerçek altyapısı ve veri işleme koşulları ayrıca açıklanır. Site bu checkout altyapısında kart numarası veya CVV istemez/kaydetmez; müşteriyi doğrulanmış sağlayıcının ödeme ekranına yönlendirmek üzere hazırlanmıştır. Ödeme referansı, tutar, para birimi ve doğrulanmış sonuç siparişle ilişkilendirilir. Sağlayıcı belli değilken veri konumu veya saklama süresi hakkında iddia yapılmaz.'] },
  { title: 'Çerezler ve reklam tercihleri', paragraphs: ['Supabase oturum çerezleri ve tarayıcıdaki sepet kayıtları hizmetin çalışması için kullanılır. Meta Pixel (Meta) reklam ölçümü için yalnızca ayrı reklam izni verildikten sonra yüklenir; varsayılan kapalıdır. Reddetmek alışverişi engellemez. Çerez tercihleri düğmesiyle izin değiştirilebilir veya geri alınabilir. Tercih kaydı bu tarayıcıda 180 gün saklanır. İzin geri alındığında yeni reklam olayları durdurulur; önceden gerçekleşen aktarım geri alınamaz. Sağlayıcının çerez süreleri, bölgesel işleme ve aktarım şartları işletmenin gerçek hizmet sözleşmesi/veri envanteriyle ayrıca kesinleştirilmelidir. Sözleşme onayı reklam izni değildir.'] })
DOCUMENTS_V1_1['kvkk'].sections.push({ title: 'Reklam tercihi ve hukuki kayıt', paragraphs: ['Meta Pixel reklam ölçümü isteğe bağlı ayrı izinle çalışır; sözleşme kabulü açık rıza yerine geçmez. Sipariş sözleşmesi sürümü, kabul zamanı ve ticari özeti, sözleşmenin kurulması/ifası ile yasal kayıt yükümlülükleri ve hakların tesisi, kullanılması veya korunması amaçlarıyla kaydedilir. Bu altyapıya IP veya user-agent alanı eklenmemiştir.'] })
