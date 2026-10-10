import { DOCUMENTS_V1_1, SELLER_V1_1 } from './v1-1'
// Preserve previously accepted archives. Contract/pre-information remain v1.1.
export const SELLER_V1_2 = SELLER_V1_1
export const DOCUMENTS_V1_2 = structuredClone(DOCUMENTS_V1_1)
for (const slug of ['kvkk', 'gizlilik-politikasi']) {
  DOCUMENTS_V1_2[slug].sections.push({ title: 'Siparişe bağlı beden ve ölçü bilgileri', paragraphs: [
    'Özel ölçü paylaşmayı seçerseniz göğüs, bel, basen, omuz, kol, ürün ve iç bacak boyu bilgileriniz ilgili ürün ve sipariş talebi için değerlendirilir. Bu yasal sayfa yayını, otomatik sipariş veya ölçü veritabanı kaydını kullanıma açmaz. Amaç sipariş talebini değerlendirmek, uygun üretimi ve müşteri desteğini sağlamaktır. Standart beden siparişinde özel ölçü girmek zorunlu değildir; sağlık bilgisi istenmez. Sözleşmenin kurulması ve ifası için gerekli olan ölçüler bu amaçla sınırlı işlenir; sözleşme onayı reklam veya sağlık verisi işleme rızası değildir.',
    'Sipariş ve ölçü kayıtlarının fiili erişim yetkileri ve saklama uygulamaları veri sorumlusunca doğrulanmalıdır; bu metin teknik erişim kontrollerinin tamamlandığına ilişkin bir güvence oluşturmaz. WhatsApp bağlantısını seçerseniz mesajda yer alan adres ve ölçü bilgileri WhatsApp üzerinden iletilir. Mesajı göndermeden önce gözden geçirebilirsiniz. Sipariş ve sözleşme kayıtlarının saklama ve aktarım koşulları bu metindeki diğer açıklamalara tabidir.',
  ] })
}

for (const section of DOCUMENTS_V1_2['kvkk'].sections) {
  section.paragraphs = section.paragraphs.map(text => text.startsWith('Meta Pixel reklam ölçümü isteğe bağlı ayrı izinle çalışır; sözleşme kabulü')
    ? 'Meta Pixel reklam ölçümü isteğe bağlı ayrı izinle çalışır; sözleşme kabulü açık rıza yerine geçmez. Kayıtlı sipariş altyapısı ayrıca kullanıma açıldığında, sözleşme sürümü, kabul zamanı ve ticari özetin kaydı sözleşmenin kurulması/ifası, yasal kayıt yükümlülükleri ve hakların korunması amaçlarıyla değerlendirilir. Bu ilk yasal sayfa yayını otomatik sözleşme kabul kaydı oluşturmaz.' : text)
}
