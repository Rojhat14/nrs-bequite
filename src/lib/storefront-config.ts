const configuredEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() ?? '';
const configuredPhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, '') ?? '';

export const contactEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail) ? configuredEmail : null;
export const whatsappNumber = /^\d{10,15}$/.test(configuredPhone) ? configuredPhone : null;
