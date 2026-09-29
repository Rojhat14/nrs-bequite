# NRS Hesap Menüsü UI Raporu

## İncelenen mevcut yapı

- `src/components/Navigation.tsx`: storefront header, desktop/mobile navigation, hesap tetikleyicileri.
- `src/components/AccountModal.tsx`: mevcut Supabase login/register akışı.
- `src/context/AuthContext.tsx`: kullanıcı/profil state'i ve mevcut sign-out akışı (değiştirilmedi).
- `src/lib/auth/requireAdmin.ts` ve `src/app/admin/(protected)/layout.tsx`: server-side admin doğrulaması (değiştirilmedi).
- `nrs_is_active_admin()` RPC ve `admin_users` RLS: hesap menüsünde admin linkini koşullu göstermek için var olan güvenli kaynak.

## Değişen dosyalar

- `src/components/Navigation.tsx`
- `src/components/AccountModal.tsx`
- `src/app/profile/components/OrderHistory.tsx` (Siparişlerim bağlantı hedefi)
- `src/app/profile/components/WishlistGrid.tsx` (Favorilerim bağlantı hedefi)

## Davranış ve görünüm

- Giriş yapmamış kullanıcı `Giriş Yap` butonunu görür; mevcut AccountModal login/register akışı açılır.
- Giriş yapmış kullanıcı outlined profil ikonunu ve adı; ad yoksa e-posta kullanıcı adını görür. Dropdown Profilim, Siparişlerim, Favorilerim ve Çıkış Yap bağlantılarını sunar.
- Admin linki yalnızca mevcut `nrs_is_active_admin()` RPC `true` döndürürse görünür. Bu yalnızca görünürlük kontrolüdür; `/admin` erişimi server-side `requireAdmin()` ile korunmaya devam eder.
- Mobil header'da hesap kontrolü bulunur; dropdown viewport genişliğini aşmayacak ölçüde konumlanır. Mobil menüde Hesabım/Giriş Yap ve admin için Admin Paneli bağlantısı da vardır.
- Dropdown dışarı tıklama ve Escape ile kapanır; tetikleyici `aria-expanded`, `aria-haspopup`, `aria-controls` kullanır. Escape kapanışında odak tetikleyiciye döner. Link ve butonlar klavye ile kullanılabilir. Dropdown ve modal animasyonları reduced-motion tercihine uyar.
- AccountModal görsel dili NRS nötr paletine yaklaştırıldı; Supabase login/register çağrıları değiştirilmedi.

## Doğrulama

- `npx tsc --noEmit --incremental false`: başarılı.
- `npm run build`: ilk son kontrolde prerender sırasında geçici `.next` vendor chunk hatası verdi; hemen tekrar çalıştırıldığında başarılı tamamlandı.
- Guest/normal kullanıcı/admin durumları gerçek tarayıcıda ve canlı Supabase oturumlarıyla manuel olarak çalıştırılmadı. Normal kullanıcı için `/admin` koruması mevcut `requireAdmin()` kodunda duruyor.
