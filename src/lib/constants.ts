// Platform-wide WhatsApp number, used as a fallback whenever a specific
// agency has no whatsapp/phone on file, and on pages not tied to one agency
// (ticket resale, promo pages). Single source of truth — do not hardcode
// this number anywhere else.
export const PLATFORM_WHATSAPP = import.meta.env.VITE_PLATFORM_WHATSAPP || "+201220534968";
