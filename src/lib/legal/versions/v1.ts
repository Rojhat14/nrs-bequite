// Published archive: never edit accepted v1.0 text. Add a new archive/version instead.
export const SELLER_V1 = {
  name: 'NRS BOUTQUE LUMINOUS TEKSTİL KONFEKSİYON VE SANAYİ TİCARET LİMİTED ŞİRKETİ',
  taxNumber: '6321569628', taxOffice: 'Doğanbey',
  address: 'Beytepe Mah. 1779/2 Sk. No: 1 Çankaya / Ankara',
  establishedAt: '23.02.2026', activity: 'Dış giyim eşyası imalatı',
  email: 'rojhat1maman@gmail.com', phone: '+90 545 422 79 19',
} as const

export interface LegalSection { title: string; paragraphs: string[] }
export interface LegalDocument { title: string; sections: LegalSection[] }
const section = (title: string, ...paragraphs: string[]): LegalSection => ({ title, paragraphs })
const contact = `${SELLER_V1.email} e-posta adresinden veya ${SELLER_V1.phone} telefon numarasından bize ulaşabilirsiniz.`
const withdrawal = 'Standart ürünlerde tüketici, teslimden itibaren 14 gün içinde gerekçe göstermeden ve cezai şart ödemeden cayabilir. Teslimden önce de cayma bildirimi yapılabilir. Bildirimin süre içinde e-posta gibi yazılı veya kalıcı veri saklayıcısı aracılığıyla iletilmesi yeterlidir; önceden onay alınması şart değildir.'
const exceptions = 'Tüketicinin özel isteği veya kişisel ihtiyacı doğrultusunda hazırlanan ürünler, Mesafeli Sözleşmeler Yönetmeliği kapsamındaki cayma hakkı istisnasına girebilir. Standart beden veya stoktaki bir modelin seçilmesi tek başına kişiye özel üretim sayılmaz. İstisna uygulanacak ürünün özelleştirmesi sipariş öncesinde açıkça bildirilir. Sağlık veya hijyen nedeniyle iadeye elverişli olmayan ürünlerde istisna ancak ilgili mevzuattaki koruyucu unsurun açılması gibi koşullar gerçekleşirse uygulanır. Ayıplı mala ilişkin haklar saklıdır.'
const returns = 'Cayma bildiriminizden itibaren 14 gün içinde ürünü geri gönderin; NRS ürünü kendisi geri almayı teklif ederse bu gönderme yükümlülüğü uygulanmaz. İade taşıyıcısı ve gönderim bilgileri iletişim kanallarımızdan paylaşılır. Ön bilgilendirmede belirtilen taşıyıcıyla iadede veya iade taşıyıcısı belirtilmemişse tüketiciye iade masrafı yüklenmez. Belirtilen taşıyıcının bulunduğunuz yerde şubesi yoksa ek masraf talep edilmeden ürünün alınması sağlanır.'
const refund = 'Cayma halinde mevzuat kapsamındaki teslimat giderleri dahil tahsil edilen ödemeler, satın almada kullanılan ödeme aracına uygun şekilde, tüketiciye masraf yüklenmeden tek seferde iade edilir. Malın belirtilen taşıyıcıya tesliminden; farklı taşıyıcı kullanıldığında satıcıya ulaşmasından itibaren en geç 14 gün içinde geri ödeme yapılır. Henüz teslim edilmemiş siparişlerde süre cayma bildiriminin ulaşmasıyla başlar. Tüketicinin emredici hakları korunur.'
const defective = 'Ayıplı malda tüketici, 6502 sayılı Kanunun koşulları çerçevesinde sözleşmeden dönme, ayıp oranında bedel indirimi, ücretsiz onarım veya ayıpsız misliyle değiştirme haklarını kullanabilir. Cayma hakkı istisnası, özel üretim olması veya ambalajın açılması ayıplı mala ilişkin hakları ortadan kaldırmaz.'
const shipping = 'Sitedeki sepet şu anda kargo bedeli hesaplamaz; hesaplanan kargo kalemi 0 TL olsa da bu, tüm gönderimlerin ücretsiz olduğu taahhüdü değildir. WhatsApp/havale siparişlerinde varsa teslimat bedeli, taşıyıcı ve nihai toplam sipariş teyidinden ve ödemeden önce açıkça bildirilir. Önceden bildirilmeyen ek bedel talep edilmez. Online kartla ödeme şu anda kullanılamaz.'
const delivery = 'Standart ürünlerde hazırlık süresi genellikle 1–3, yurt içi kargo süresi genellikle 2–5 iş günüdür; bunlar tahmini sürelerdir. Siparişe ilişkin taahhüt edilen süre ayrıca bildirilir. Standart mal satışlarında yasal azami 30 günlük ifa süresi korunur. Kişiye özel hazırlanan ürünlerde daha uzun süre taraflarca önceden kararlaştırılabilir. Uluslararası teslimat koşulları sipariş öncesinde ayrıca görüşülür.'
const disputes = 'Şikayetlerinizi iletişim adresimize iletebilirsiniz. Yürürlükteki parasal sınır ve görev kurallarına göre tüketici hakem heyetlerine veya tüketici mahkemelerine başvuru hakları saklıdır. Kanunen gerekli hallerde dava öncesi arabuluculuk uygulanır. Bu metin tüketicinin yetkili başvuru mercilerini sınırlandırmaz.'

export const DOCUMENTS_V1: Record<string, LegalDocument> = {
  'mesafeli-satis-sozlesmesi': { title: 'Mesafeli Satış Sözleşmesi', sections: [
    section('Taraflar', 'Bu sözleşmenin tarafları aşağıda bilgileri verilen satıcı ile sipariş özetinde kimlik ve teslimat bilgileri belirtilen alıcıdır. Tüketici işlemlerinde 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliğinin emredici hükümleri uygulanır.'),
    section('Satıcı bilgileri', `${SELLER_V1.name}. Vergi kimlik numarası: ${SELLER_V1.taxNumber}. Vergi dairesi: ${SELLER_V1.taxOffice}. Adres: ${SELLER_V1.address}.`, `İşe başlama: ${SELLER_V1.establishedAt}. Faaliyet: ${SELLER_V1.activity}. ${contact}`),
    section('Alıcı bilgileri', 'Ad-soyad, iletişim ve teslimat adresi siparişe özgü özette yer alır. Bu genel sayfa tek başına belirli bir siparişin kurulduğunu veya ödendiğini göstermez.'),
    section('Sözleşmenin konusu', 'Alıcının seçtiği giyim ürünlerinin uzaktan satışı ve teslimi ile tarafların hak ve yükümlülükleridir. Sipariş özeti ve ön bilgilendirme formu sözleşmenin ayrılmaz parçalarıdır.'),
    section('Ürün bilgileri', 'Ürün adı, kodu, temel özellikleri, varsa beden/özelleştirme ve adet sipariş özetinde gösterilir. Özel üretim niteliği ve teslim süresi sipariş verilmeden önce açıklanır.'),
    section('Ürün fiyatı', 'Birim satış fiyatları ve toplam fiyat tüketiciye tüm vergiler dahil bildirilir. Varsa indirim ayrı gösterilir; sipariş teyidindeki bedel esas alınır.'),
    section('Toplam sipariş tutarı', 'Ürün bedelleri, varsa indirim ve önceden bildirilen teslimat giderlerinden oluşur. Siparişe özgü nihai toplam ödeme öncesinde gösterilmelidir; belirsiz bedelle online tahsilat başlatılmaz.'),
    section('Kargo/teslimat bedeli', shipping),
    section('Ödeme', 'Mevcut sitede online kart tahsilatı kapalıdır. WhatsApp bağlantısı iletişim/sipariş talebi gönderir; ödeme veya kesin sipariş onayı oluşturmaz. Havale/EFT bilgileri ve nihai tutar sipariş teyidinde paylaşılır. Ödeme yöntemi ve siparişin kurulma şartları tüketiciye ayrıca bildirilir.'),
    section('Teslimat', delivery, 'Teslim edilemeyen siparişlerde tüketicinin fesih ve geri ödeme hakları saklıdır. İfanın imkansızlaşması halinde tüketiciye 3 gün içinde bildirim yapılır ve tahsil edilen tutarlar bildirimden itibaren 14 gün içinde iade edilir. Stokta bulunmama tek başına imkansızlaşma sayılmaz. Satıcının belirttiği taşıyıcıyla teslimata kadar kayıp ve hasar sorumluluğu satıcıdadır.'),
    section('Cayma hakkı', withdrawal, contact),
    section('Cayma hakkı istisnaları', exceptions),
    section('İade', returns, refund, 'Ürünün işleyişine ve özelliklerine uygun olağan inceleme kullanımı cayma hakkını ortadan kaldırmaz. Etiket ve orijinal ambalajın korunması tavsiye edilir; bunların bulunmaması tek başına yasal hakkın reddi nedeni değildir.'),
    section('Ayıplı ürün', defective),
    section('Kişisel veriler', 'Sipariş için gerekli bilgiler KVKK Aydınlatma Metninde açıklanan amaç ve hukuki sebeplerle işlenir. Sözleşme kabulü pazarlama izni veya genel kişisel veri işleme açık rızası değildir.'),
    section('Elektronik kayıtlar', 'Siparişe ilişkin kabul zamanı, sözleşme ve ön bilgilendirme sürümleri ile sipariş özeti elektronik olarak kaydedilebilir. Kayıtlar tüketicinin ispat ve itiraz haklarını kaldırmaz; satıcı kayıtları tek ve kesin delil olarak dayatılamaz. Kayıtlı belgeler müşteri hesabından veya iletişim kanalıyla talep edilerek erişilebilir.'),
    section('Uyuşmazlıklar', disputes),
    section('Yürürlük', 'Siparişe özgü ön bilgilendirme ve sözleşme tüketiciye sunulup sipariş teyit edildiğinde ilgili işlem için geçerli olur. Bu genel metni açmak, WhatsApp talebi göndermek veya ödeme özelliği kapalıyken sayfayı görüntülemek sözleşme kabulü ya da ödeme anlamına gelmez. Emredici mevzuata aykırı yorum uygulanmaz.'),
  ] },
  'on-bilgilendirme-formu': { title: 'Ön Bilgilendirme Formu', sections: [
    section('Satıcı bilgileri', `${SELLER_V1.name}. Vergi kimlik numarası: ${SELLER_V1.taxNumber}; vergi dairesi: ${SELLER_V1.taxOffice}. Adres: ${SELLER_V1.address}. ${contact}`),
    section('Ürünün temel özellikleri', 'Ürün adı, kodu, temel özellikleri, beden, adet ve varsa kişiye özel hazırlama bilgisi sipariş özetinde yer alır. Genel sayfa belirli bir siparişin bilgileri yerine geçmez.'),
    section('Ürün fiyatı ve KDV dahil toplam fiyat', 'Tüketiciye birim fiyatlar ve toplam bedel tüm vergiler dahil sunulur. Sipariş özeti ürün toplamını, varsa indirimi ve teslimat giderini ayrı gösterir. Ödeme öncesi nihai bedel açıkça teyit edilir.'),
    section('İndirim', 'Varsa indirim sepet özetinde ayrı belirtilir. İndirim sonrası ödenecek ürün tutarı ve nihai toplam, tüketicinin değerlendirmesine sunulur.'),
    section('Kargo/teslimat bedeli', shipping),
    section('Ödeme yöntemi', 'Online kartla ödeme şu anda kapalıdır. WhatsApp sipariş talebi ödeme işlemi değildir. Havale/EFT işlemi ancak sipariş ve tutar teyidinden sonra paylaşılan bilgilerle yapılır; talep gönderilmesi tahsilat veya kesin sipariş onayı olarak gösterilmez.'),
    section('Teslimat koşulları', delivery, 'Teslimat adresi, taahhüt edilen süre ve taşıyıcı sipariş öncesinde belirlenir. İmkansızlaşma ve süresinde ifa etmeme durumlarında tüketicinin yasal fesih ve geri ödeme hakları saklıdır.'),
    section('Cayma hakkı', withdrawal, contact),
    section('Cayma hakkının istisnaları', exceptions),
    section('İade süreci', returns, refund),
    section('Ayıplı mal ve şikayet/başvuru bilgileri', defective, disputes, contact),
    section('Bilgilendirmenin teyidi', 'Online ödeme açıldığında bu form ve sözleşme ödeme öncesinde sunulur; kabul bilgisi siparişe bağlanır. Mevcut WhatsApp talebi için zorunlu online ödeme onayı aranmaz. Aydınlatma ve pazarlama izinleri sözleşme teyidinden ayrıdır.'),
  ] },
  'iade-ve-degisim': { title: 'İade ve Değişim Koşulları', sections: [
    section('İade koşulları ve cayma hakkı', withdrawal, 'Ürünün etiketlerini, aksesuarlarını ve ambalajını mümkünse koruyun. Ürünün niteliğine uygun olağan incelemesi cayma hakkını ortadan kaldırmaz; ambalaj veya etiket eksikliği tek başına ret gerekçesi değildir.'),
    section('Standart ürünler ve kişiye özel üretim', exceptions),
    section('Değişim işlemleri', 'Beden veya model değişimi için iletişime geçebilirsiniz. Değişim stok durumuna göre değerlendirilir; anlaşmalı değişim hizmeti cayma ve ayıplı mal haklarının yerine geçmez.'),
    section('İade süreci', `Sipariş numaranız ve iade talebinizle ${SELLER_V1.email} adresine yazabilirsiniz. Sipariş numarası yoksa işlemi belirlemeye yeterli bilgileri paylaşın. Cayma hakkını kullanmak için satıcının onayını beklemek gerekmez.`, returns),
    section('Geri ödeme', refund),
    section('Ayıplı veya yanlış ürün', defective, 'Sorunu iletişim kanallarımızdan bildirin; değerlendirme için gerekli ürün ve sipariş bilgilerini paylaşabilirsiniz. Tüketicinin mevzuat kapsamındaki masrafları satıcı tarafından karşılanır.'),
    section('İletişim ve başvuru', contact, disputes),
  ] },
  'iptal-kosullari': { title: 'İptal Koşulları', sections: [
    section('İptal talebinin iletilmesi', `Siparişinizin hazırlanmasına veya kişiye özel üretime başlanmadan önce iptal talebinizi sipariş bilgileriyle ${SELLER_V1.email} adresine iletin. ${SELLER_V1.phone} numarasından da destek alabilirsiniz. Cayma bildiriminizi e-posta gibi kalıcı bir ortamda iletmeniz işlemin takibini kolaylaştırır.`),
    section('Standart ürünler', 'Hazırlığa veya kargoya başlanmış olması standart ürünlerde tek başına cayma hakkını kaldırmaz. Teslim öncesinde ve teslimden itibaren 14 gün içinde mevzuat kapsamındaki cayma hakkınızı kullanabilirsiniz.'),
    section('Özel üretim', exceptions, 'Üretime başlanmış olması tüm ürünler için genel bir iptal yasağı oluşturmaz. Ürünün gerçekten özel istek/kişisel ihtiyaç doğrultusunda hazırlanması ve mevzuattaki istisna koşulları değerlendirilir. Üretime başlamadan önce iletilen iptal talepleri operasyon durumu gözetilerek işleme alınır; emredici haklar korunur.'),
    section('İptal ve bedel iadesi', 'Talebin durumu iletişim bilgileriniz üzerinden bildirilir. Henüz teslim edilmemiş siparişte cayma halinde tahsil edilen tutarlar cayma bildiriminin ulaşmasından itibaren en geç 14 gün içinde, ödeme aracına uygun ve ek masrafsız iade edilir. Mevzuattaki diğer fesih ve ayıplı mal hakları saklıdır.'),
    section('İletişim', contact),
  ] },
  'gizlilik-politikasi': { title: 'Gizlilik Politikası', sections: [
    section('Toplanan bilgiler', 'Hesap ve profil işlemlerinde ad-soyad, e-posta ve telefon; sipariş süreçlerinde teslimat adresi, ürün, tutar, durum ve işlem kayıtları işlenebilir. Sepet ve favori tercihleri tarayıcıda veya hesapla ilişkili kayıtlarda tutulur. WhatsApp bağlantısını kullanırsanız hazırlanan mesajı WhatsApp ortamında siz gönderirsiniz.'),
    section('Kullanım amaçları ve sipariş işlemleri', 'Bilgiler hesap hizmetleri, sipariş taleplerini yanıtlama, teslimat, müşteri desteği, yasal yükümlülükler ve hakların korunması için kullanılır. Ayrıntılı hukuki sebepler KVKK Aydınlatma Metninde açıklanır. Sözleşme kabulü reklam iletişimi izni değildir; bülten aboneliği şu anda açık değildir.'),
    section('Ödeme işlemleri', 'Online kart ödeme özelliği kapalıdır; mevcut ödeme oluşturma ve callback uçları kullanılamıyor yanıtı verir. Bu aşamada sitede çalışan bir kart tahsilat entegrasyonu bulunmaz. İleride kullanılacak sağlayıcı, veri alanları ve saklama davranışı entegrasyon doğrulandıktan sonra açıklanacaktır. Havale/EFT için ödeme teyidi ve sipariş bilgileri iletişim yoluyla işlenebilir.'),
    section('Kargo/teslimat', 'Siparişin ifası için gereken alıcı adı, adres ve iletişim bilgileri teslimatı gerçekleştirecek taşıyıcıyla gerekli ölçüde paylaşılabilir. Mevcut kod belirli bir kargo sağlayıcısı entegrasyonu içermemektedir.'),
    section('Teknik veriler', 'Oturum, tarayıcı depolaması ve erişimle ilgili teknik veriler hizmetin çalışması için kullanılabilir. Barındırma ve harici hizmetler bağlantı sırasında IP adresi ve tarayıcı bilgileri gibi teknik verileri işleyebilir. NRS sözleşme kabul kaydına IP veya user-agent alanı eklememiştir; bu, tüm altyapıda teknik veri işlenmediği anlamına gelmez.'),
    section('Çerezler ve tarayıcı depolaması', 'Supabase kimlik doğrulama oturumu çerezlerle, sepet tercihleri tarayıcının yerel depolamasıyla yönetilir. Site ayrıca Meta Pixel betiği yükler ve sayfa görüntüleme olayları gönderir. Mevcut uygulamada ayrı reklam/analitik çerez tercih ekranı bulunmaz. Tarayıcı ayarlarından çerez ve depolama tercihlerinizi yönetebilirsiniz; bu ayarlar gerekli açık rıza mekanizmasının yerine geçmez.'),
    section('Hizmet sağlayıcılar ve aktarım', 'Hesap ve veritabanı hizmetinde Supabase; sayfa görüntüleme ölçümünde Meta; iletişim talebinde kullanıcı tercih ederse WhatsApp kullanılır. Görseller ve yazı tipleri ilgili altyapılarla sunulur. Hizmetlere bağlantı ve veri iletimi yurt dışı aktarım içerebilir. Aktarımın hukuki dayanağı ve hizmetlerin veri bölgeleri veri sorumlusu tarafından doğrulanmalıdır; bu metin uygun aktarım güvencesi sağlandığı iddiasında bulunmaz.'),
    section('Veri güvenliği', 'Erişim yetkileri ve teknik tedbirler riskler doğrultusunda yönetilmelidir. İnternet üzerinden iletim için mutlak güvenlik garantisi verilmez. Hesap şifrenizi paylaşmayın; şüpheli işlemleri bize bildirin.'),
    section('Saklama', 'Veriler amaç ve ilgili yasal saklama yükümlülükleri için gereken süreyle sınırlı tutulur. İşlem kayıtları ve sözleşme sürümleri mevzuat ve uyuşmazlık süreleri dikkate alınarak saklanır; dayanak ortadan kalktığında silme, yok etme veya anonimleştirme uygulanır. Hizmet sağlayıcı kayıtlarının fiili süreleri ayrıca veri envanterinde belirlenmelidir.'),
    section('İletişim', `${SELLER_V1.name}. ${SELLER_V1.address}. ${contact}`),
  ] },
  kvkk: { title: 'KVKK Aydınlatma Metni', sections: [
    section('Veri sorumlusu', `${SELLER_V1.name}; vergi kimlik numarası ${SELLER_V1.taxNumber}, vergi dairesi ${SELLER_V1.taxOffice}. Adres: ${SELLER_V1.address}. ${contact}`),
    section('İşlenen kişisel veriler', 'Kimlik/iletişim: ad-soyad, e-posta, telefon ve teslimat adresi. Müşteri işlem verileri: profil, favori, sipariş ürünleri, tutar, teslimat/ödeme durumu, destek yazışmaları, sözleşme kabul zamanı ve belge sürümleri. Teknik veriler: oturum çerezleri, tarayıcı depolaması ve hizmetlere erişim verileri. Sözleşme kayıtlarında IP/user-agent toplanmaz. Meta Pixel sayfa görüntüleme ölçümü ayrı bir teknik veri işleme faaliyetidir.'),
    section('İşleme amaçları', 'Hesap ve favori hizmetlerini sunmak; sipariş talebini değerlendirmek, sözleşmeyi kurmak ve ifa etmek; teslimat ve müşteri desteği sağlamak; mevzuat yükümlülüklerini yerine getirmek ve hak taleplerini yönetmek. Meta Pixel sayfa görüntüleme ölçümü reklam/ölçüm amacı taşır ve sözleşme için zorunlu veri işleme ile birleştirilmez.'),
    section('Hukuki sebepler', 'Sözleşmenin kurulması/ifası için gerekli kimlik, iletişim ve sipariş verileri KVKK 5/2-c; kanuni yükümlülüklere ilişkin kayıtlar 5/2-a ve ç; uyuşmazlık ve hakların korunması için gerekli kayıtlar 5/2-e kapsamında işlenebilir. Zorunlu teknik güvenlik işlemleri, temel haklar gözetilerek koşulları mevcutsa 5/2-f kapsamında değerlendirilir. Bu dayanaklar tüm verilere sınırsız izin vermez. Reklam/ölçüm veya ticari iletişim için gerektiğinde ayrı, özgür ve belirli açık rıza alınmalıdır. Bu aydınlatma metni açık rıza beyanı değildir.'),
    section('Veri toplama yöntemleri', 'Site hesap/profil formları, sepet ve sipariş ekranları; tüketicinin gönderdiği e-posta, telefon/WhatsApp iletişimi; çerezler ve tarayıcı depolaması yoluyla elektronik veya iletişim kanallarında toplanır. Online kart tahsilatı şu anda çalışmamaktadır.'),
    section('Aktarım yapılabilecek taraflar/alıcı grupları', 'Gerekli ölçüde teknik altyapı ve veritabanı sağlayıcıları (mevcut sistemde Supabase), teslimat için taşıyıcılar, hukuki/mali yükümlülükler için yetkili kurumlar ve meslek hizmeti sağlayıcıları alıcı grupları olabilir. Mevcut sitede Meta Pixel ve kullanıcının başlattığı WhatsApp iletişimi de bulunur. Yurt içi aktarımlarda KVKK 8, yurt dışı aktarımlarda 9 kapsamındaki koşullar sağlanmalıdır. Sağlayıcı bölgeleri, aktarım mekanizmaları ve reklam ölçümü rıza yönetimi ayrıca doğrulanmalıdır; bu metin açık rıza veya aktarım güvencesi yerine geçmez.'),
    section('Saklama', 'Her veri kategorisi işlem amacı, yasal yükümlülük ve hak arama sürelerinin gerektirdiği kadar saklanır. Gereksiz veri toplanmaz. Süre sonunda uygun silme/yok etme/anonimleştirme süreçleri uygulanmalıdır. Somut saklama süreleri ve sağlayıcı uygulamaları veri sorumlusunun envanteriyle tamamlanmalıdır.'),
    section('İlgili kişinin hakları', 'KVKK 11 kapsamında verinizin işlenip işlenmediğini ve işlenmişse ayrıntılarını öğrenebilir; amaç ve amaca uygunluğu, yurt içi/yurt dışı alıcıları sorabilirsiniz. Yanlış veya eksik verinin düzeltilmesini, kanuni koşullarda silinmesini/yok edilmesini ve bu işlemlerin alıcılara bildirilmesini isteyebilirsiniz. Yalnız otomatik analizle aleyhinize doğan sonuçlara itiraz ve hukuka aykırı işleme nedeniyle zararın giderilmesini talep haklarınız vardır.'),
    section('Başvuru yöntemi', `Başvurunuzu kimliğinizi ve talebinizi belirlemeye yeterli bilgilerle şirket adresine yazılı olarak veya daha önce bildirdiğiniz ve sistemimizde kayıtlı e-posta adresinizden ${SELLER_V1.email} adresine iletebilirsiniz. İlgili tebliğdeki diğer geçerli yöntemler saklıdır. Gereksiz kişisel veri veya belge göndermeyin; kimlik doğrulaması gerektiğinde talep kapsamına uygun değerlendirilir. Başvurular en geç 30 gün içinde cevaplandırılır; kanuni başvuru ve Kurula şikayet hakları saklıdır.`),
  ] },
  'kullanim-kosullari': { title: 'Kullanım Koşulları', sections: [
    section('Site kullanımı', 'NRS sitesi ürünleri incelemek, hesap/favori hizmetlerini kullanmak ve sipariş talebi iletmek için sunulur. Siteyi hukuka uygun kullanın; hizmetlerin çalışmasını veya başkalarının erişimini engellemeyin.'),
    section('Kullanıcı sorumlulukları', 'İşlem için verdiğiniz bilgilerin doğruluğunu gözetin. Başkasına ait kimlik, hesap veya iletişim bilgileriyle yetkisiz işlem yapmayın. Bu koşullar tüketicinin emredici haklarını kaldırmaz.'),
    section('Hesap güvenliği', 'Şifrenizi koruyun ve üçüncü kişilerle paylaşmayın. Yetkisiz erişim şüphesinde iletişime geçin. Kullanıcıya tüm güvenlik riskleri ve satıcının sorumluluğu koşulsuz olarak yüklenmez.'),
    section('Fikri mülkiyet', 'Site tasarımı, marka, görsel ve içerikler ilgili hak sahiplerine aittir. Kanunen izin verilen kullanımlar dışında izinsiz ticari çoğaltma veya dağıtım yapılamaz.'),
    section('Ürün bilgileri', 'Temel ürün özellikleri ve fiyatlar ürün ekranlarında sunulur. Ekran ayarları renk görünümünü etkileyebilir; bu açıklama ürünün vaat edilen özelliklerine veya ayıplı mala ilişkin sorumluluğu kaldırmaz. Nihai sipariş bilgileri işlem öncesinde teyit edilir.'),
    section('Site içeriği', 'Genel bilgi sayfaları siparişe özgü özetin yerine geçmez. Online kart ödeme şu anda kullanılamaz; WhatsApp talebi tahsilat veya kesin sipariş onayı değildir.'),
    section('Teknik kesintiler', 'Bakım veya teknik sorunlar nedeniyle erişim kesilebilir. Mevcut siparişlere ve tüketici haklarına ilişkin yükümlülükler devam eder; teknik kesinti gerekçesiyle bunlar ortadan kaldırılmaz.'),
    section('Değişiklikler', 'Metinler ileriye dönük güncellenebilir. Önceden kurulmuş sözleşmeler ve kabul edilmiş belge sürümleri geriye dönük değiştirilmez; tüketicinin yasal hakları saklıdır.'),
    section('İletişim', `${SELLER_V1.name}. ${SELLER_V1.address}. ${contact}`),
  ] },
  'kargo-ve-teslimat': { title: 'Kargo ve Teslimat', sections: [
    section('Hazırlık ve teslimat süreci', delivery),
    section('Kargo ücretleri', shipping),
    section('Teslimat adresi ve takip', 'Teslimatın doğru yapılabilmesi için adres ve iletişim bilgilerinizi kontrol edin. Sipariş kargoya verildiğinde mevcut iletişim kanalınızdan taşıyıcı ve takip bilgileri paylaşılır. Adres değişikliğini mümkün olan en kısa sürede bildirin.'),
    section('Gecikme, kayıp ve hasar', 'Satıcının belirttiği taşıyıcıyla teslimata kadar kayıp ve hasar sorumluluğu satıcıya aittir. Gecikme veya hasarı iletişim kanallarımıza bildirebilirsiniz; tutanak olmaması tek başına yasal haklarınızı kaldırmaz. Süresinde ifa etmeme, imkansızlaşma ve ayıplı mala ilişkin mevzuat hakları korunur.'),
    section('Uluslararası gönderimler', 'Teslimat olanağı, süre, teslimat bedeli ve varsa diğer maliyetler siparişten önce ayrıca bildirilir ve teyit edilir. Sitede otomatik uluslararası kargo bedeli hesaplaması bulunmaz.'),
    section('İletişim', contact),
  ] },
}
