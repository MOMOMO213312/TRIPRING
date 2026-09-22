// Platform-wide WhatsApp number, used as a fallback whenever a specific
// agency has no whatsapp/phone on file, and on pages not tied to one agency
// (ticket resale, promo pages). Single source of truth — do not hardcode
// this number anywhere else.
export const PLATFORM_WHATSAPP = import.meta.env.VITE_PLATFORM_WHATSAPP || "+201220534968";

/**
 * Language of the messages the customer sends TO an agency (WhatsApp deep-links). The agency
 * team reads them, not the customer, so they are written in the agency's working language
 * rather than in whatever language the customer happens to browse the site in.
 */
export const AGENCY_MESSAGE_LANG = "ar" as const;
