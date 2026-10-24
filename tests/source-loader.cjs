const fs=require('node:fs'); const path=require('node:path'); const Module=require('node:module'); const ts=require('typescript');
function loader(mocks = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = new Module(filename, module);
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    const standardRequire = loaded.require.bind(loaded);
    loaded.require = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === '@/context/LocaleContext') return {
        useLocale: () => ({ locale: 'tr', rate: null, fxAvailable: false,
          t: key => ({ checkout: 'Ödemeye geç',
            categories: 'Kategoriler', collections: 'Koleksiyonlar', all: 'Tümünü gör', bag: 'Alışveriş çantası', wishlist: 'Favorilerim',
            menu: 'Menüyü aç', closeMenu: 'Menüyü kapat', search: 'Ürün ara', account: 'Hesabım', favorites: 'Favoriler', cart: 'Sepet',
            productTotal: 'Ürünler toplamı', discount: 'Açılış indirimi', shipping: 'Kargo', total: 'Ödenecek toplam',
            currencyNote: 'USD tutarları güncel kura göre yaklaşık karşılıktır. Ödeme Türk lirası olarak alınır.',
            fxUnavailable: 'Güncel kur bilgisi alınamadı; fiyatlar Türk lirası olarak gösteriliyor.', paymentTry: 'Ödeme Türk lirası olarak alınacaktır.',
            firstName: 'Ad', lastName: 'Soyad', email: 'E-posta', phone: 'Telefon', address: 'Açık adres', city: 'İl', district: 'İlçe', postalCode: 'Posta kodu',
            addToBag: 'Sepete ekle', bagEmptyTitle: 'Sepetiniz boş', bagEmptyBody: 'Gözünüze takılan parçaları sepetinize ekleyerek başlayın.',
            checkoutLoading: 'Sepet yükleniyor…', checkoutTitle: 'Ödeme ve teslimat', orderRequest: 'Sipariş talebi', chosenItemsReady: 'Seçtiğiniz parçalar sizin için hazır.',
            stepInformation: 'Bilgiler', stepSummary: 'Özet', stepApproval: 'Onay', continueWithAccount: 'Hesabınızla devam edin', accountContinue: 'Hesabımla devam et',
            trackOrders: 'Siparişlerinizi ve belgelerinizi hesabınızdan takip edin.', loginForPayment: 'Kartla ödeme için hesabınıza giriş yapın.', customerDelivery: 'Müşteri ve teslimat bilgileri',
            addressPlaceholder: 'Mahalle, sokak, bina, daire…', orderNoteOptional: 'Sipariş notu (isteğe bağlı)', measurementsTitle: 'Beden ve özel ölçüler',
            measurementsHelp: 'Ölçülerinizi sipariş öncesinde girin.', privacyNotice: 'Kişisel verilerinizin işlenmesine ilişkin aydınlatma metni',
            reviewingQuote: 'Sipariş özeti doğrulanıyor…', checkingCartPrices: 'Sepet fiyatları kontrol ediliyor…', reviewSummary: 'Özeti incele',
            cartUpdated: 'Sepetinizdeki ürün fiyatları güncellendi. Güncel sipariş özetini inceleyin.', summaryApproval: 'Sipariş özeti ve onay',
            quoteInstruction: 'Sipariş özetini ve sözleşmeleri inceleyin.', bankHandoffNote: 'Bir sonraki adım Garanti BBVA’nın güvenli ödeme sayfasına geçiştir.',
            viewOrderTerms: 'Sözleşmeye esas sipariş bilgilerini görüntüle', documentVersion: 'içeriği', openLegal: 'sayfasını aç',
            bankRedirecting: 'Garanti BBVA’ya yönlendiriliyorsunuz…', goToBank: 'Garanti BBVA ödeme sayfasına geç', resumeTestOrder: 'Bekleyen test siparişine devam et',
            cardPayment: 'Kartla ödeme yap', saving: 'Kaydediliyor…', saveTransferRequest: 'Havale / WhatsApp sipariş talebini kaydet',
            requestSaved: 'Sipariş talebiniz kaydedildi', paymentNotTaken: 'Ödeme alınmadı; teyit için WhatsApp üzerinden iletişime geçin.',
            orderSummary: 'Sipariş özeti', orderHistory: 'Siparişlerim', orderIdLabel: 'Sipariş numarası', dateLabel: 'Tarih', orderStatusProcessing: 'Hazırlanıyor', orderStatusReviewing: 'İncelemede', orderPaymentDetails: 'Ödeme durumu ve sipariş özeti', items: 'ürün', sizeLabel: 'Ölçü', pieces: 'adet', customMeasurements: 'Özel ölçüler', measurementsUnspecified: 'Ölçü belirtilmedi',
            shippingConfirmed: 'Sipariş teyidinde', free: 'Ücretsiz', quotePending: 'Tutar, stok ve teslimat bedeli sunucuda doğrulanınca kesinleşir.',
            statusOrder: 'Sipariş durumu', orderNumber: 'Sipariş numarası', orderDetails: 'Sipariş ayrıntıları', orderUnavailable: 'Sipariş bilgisi görüntülenemiyor',
            statusChecking: 'Ödeme durumu kontrol ediliyor', paymentReceived: 'Ödemeniz alındı.', paymentReceivedBody: 'Ödemeniz doğrulandı. Siparişinizin ayrıntılarına hesabınızdan ulaşabilirsiniz.',
            paymentFailureBody: 'Siparişiniz alınmadı. Lütfen tekrar deneyin.', paymentUnknownBody: 'Ödeme sonucu henüz netleşmedi. Lütfen daha sonra tekrar kontrol edin.',
            verifiedCancelled: 'Siparişiniz iptal edildi', verifiedCancelledBody: 'Siparişiniz uygulamada iptal edildi olarak doğrulandı. Yeni bir alışverişe başlayabilirsiniz.',
            orderAccessUnavailable: 'Sipariş bilgilerine erişim doğrulanamadı.', orderLinks: 'Sonraki adımlar', orderPage: 'Sipariş ayrıntılarına git', myOrders: 'Siparişlerime git',
            getHelp: 'Yardım alın', discoverCollection: 'Koleksiyonu keşfet', paymentPending: 'Ödeme sonucu henüz netleşmedi. Lütfen daha sonra tekrar kontrol edin.', checkAgain: 'Tekrar kontrol et',
            measurementRequired: 'zorunlu', measurementOptional: 'isteğe bağlı', measurementValidationError: 'Ölçüleri tamamlayıp kontrol edin.',
            checkoutQuoteError: 'Sipariş özeti doğrulanamadı.', checkoutSaveError: 'Sipariş talebi kaydedilemedi.',
            checkoutConsentError: 'Sipariş özetini yeniden inceleyip sözleşmeleri kabul edin.', checkoutPaymentError: 'Ödeme başlatılamadı; sipariş özetini yeniden doğrulayın.' })[key] || key,
          money: amount => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount),
          minorMoney: minor => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(minor / 100),
        }), LocaleProvider: ({ children }) => children,
      };
      if (name === 'server-only') return {};
      if (name.startsWith('@/') || name.startsWith('./')) {
        const base = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : path.resolve(path.dirname(filename), name);
        const target = ['.ts', '.tsx', ''].map(ext => base + ext).find(file => fs.existsSync(file) && fs.statSync(file).isFile());
        if (target) return load(target);
      }
      return standardRequire(name);
    };
    cache.set(filename, loaded);
    loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, filename);
    return loaded.exports;
  }
  return load;
}
module.exports = { loader };
