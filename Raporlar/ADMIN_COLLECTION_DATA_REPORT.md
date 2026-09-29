# Admin Collection Data Değişiklik Raporu

- `src/lib/admin/data.ts` içine `CollectionRow` type import'u ve aktif koleksiyonları sıralı okuyan `getCollections()` eklendi.
- `getProductEditorData(id)` artık koleksiyon listesini ve ürüne bağlı `product_collections.collection_id` değerlerini döndürüyor (`collections`, `selectedCollectionIds`). İki koleksiyon sorgusunun hataları da mevcut hata sonucuna dahil edildi.
- Doğrulama: `npx tsc --noEmit --incremental false` — başarılı (çıkış kodu 0).
- Başka bir kaynak dosyası değiştirilmedi. Bu rapor, istek doğrultusunda ayrıca oluşturuldu.
