import Link from 'next/link';

export default function PaymentStatusPage() {
  return (
    <main className="min-h-screen bg-nrs-canvas px-6 pb-12 pt-[calc(var(--nrs-header-height)+3rem)]">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <h1 className="font-serif text-3xl">Online ödeme kullanılamıyor</h1>
        <p className="text-nrs-ink/60">Bu sayfa bir ödeme veya sipariş onayı değildir. Siparişiniz hakkında bilgi almak için bizimle iletişime geçebilirsiniz.</p>
        <Link href="/contact" className="inline-block bg-nrs-charcoal ring-1 ring-inset ring-nrs-ivory/25 px-8 py-4 text-nrs-ivory">İletişime geç</Link>
        <Link href="/checkout" className="block text-sm underline">Sepetime dön</Link>
      </div>
    </main>
  );
}
