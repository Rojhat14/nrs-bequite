import { bankTransfer } from '@/lib/storefront-config'

export default function BankTransferInfo() {
  return <div className="space-y-2 text-xs leading-6 text-nrs-ink/65 break-words">
    <p>Ödeme yöntemi: Havale / EFT</p>
    {bankTransfer.iban ? <>
      {bankTransfer.bankName && <p>Banka: {bankTransfer.bankName}</p>}
      {bankTransfer.accountName && <p>Hesap sahibi: {bankTransfer.accountName}</p>}
      <p>IBAN: <span className="select-all">{bankTransfer.iban}</span></p>
      <p>Ödemeden önce siparişinizi ve tutarı WhatsApp üzerinden teyit edin.</p>
    </> : <p>IBAN bilgisi sipariş onayı sırasında WhatsApp üzerinden paylaşılacaktır.</p>}
    <p>WhatsApp&apos;ta sipariş mesajınızı göndererek sipariş talebinizi iletebilirsiniz. Talep, ödeme veya kesin sipariş onayı değildir; fiyat ve stok teyit edilir.</p>
  </div>
}
