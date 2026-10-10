const configuredEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || 'rojhat1maman@gmail.com';
const configuredPhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() || '905454227919';

export function normalizeWhatsappNumber(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^00/, '');
  return /^[1-9]\d{9,14}$/.test(digits) ? digits : null;
}

export const contactEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail) ? configuredEmail : null;
export const whatsappNumber = normalizeWhatsappNumber(configuredPhone);
export const contactPhone = whatsappNumber ? `+${whatsappNumber}` : null;
export const contactPhoneLabel = whatsappNumber?.length === 12 && whatsappNumber.startsWith('90')
  ? `+90 ${whatsappNumber.slice(2, 5)} ${whatsappNumber.slice(5, 8)} ${whatsappNumber.slice(8, 10)} ${whatsappNumber.slice(10)}`
  : contactPhone;
export const contactAddress = 'BEYTEPE MAH. 1779/2 SK. NO: 1 ÇANKAYA/ ANKARA';
export const bankTransfer = {
  bankName: process.env.NEXT_PUBLIC_BANK_NAME?.trim() || '',
  accountName: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME?.trim() || '',
  iban: process.env.NEXT_PUBLIC_IBAN?.trim() || '',
};

export function whatsappUrl(message?: string) {
  if (!whatsappNumber) return null;
  return `https://wa.me/${whatsappNumber}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
