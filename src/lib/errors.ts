/**
 * Some of our Postgres RPCs (create_booking, etc.) intentionally
 * `RAISE EXCEPTION` with a friendly Arabic message for expected business
 * cases — "العرض غير متاح", "عدد المقاعد المتاحة (2) أقل من المطلوب (3)",
 * "الاسم مطلوب" — and those are safe (in fact meant) to show directly.
 *
 * Everything else that can reach a `.catch()` — a dropped connection, a
 * PostgREST schema error like "JSON object requested, multiple (or no)
 * rows returned", a generic "Failed to fetch" — is a raw technical string
 * that should never reach the customer, especially at checkout.
 *
 * Heuristic: if the thrown message contains Arabic script, it's one of our
 * deliberate RPC exceptions and safe to surface as-is. Otherwise fall back
 * to a friendly generic message and log the real error for debugging.
 * (See audit: raw DB/network errors were leaking onto the deal-detail,
 * booking, and price-alert screens.)
 */
import { Sentry } from "./sentry";

const ARABIC_RE = /[\u0600-\u06FF]/;

/**
 * Stable machine codes raised by the currency/payment RPCs (create_fx_quote, create_booking_with_charge,
 * apply_booking_services…). They are not Arabic, so without this map they would fall through to the generic
 * fallback and the customer would never learn WHY checkout failed.
 */
const BOOKING_ERROR_CODES: Record<string, string> = {
  CURRENCY_NOT_CHARGEABLE: "العملة دي مش متاحة للدفع حاليًا — اختار عملة تانية للدفع.",
  CURRENCY_NOT_AVAILABLE: "العملة المختارة مش متاحة حاليًا — اختار عملة تانية.",
  FX_QUOTE_INVALID: "سعر الصرف انتهت صلاحيته — اضغط \"تأكيد الحجز\" تاني وهنحسب لك السعر بسعر الصرف الحالي.",
  FX_RATE_UNAVAILABLE: "مقدرناش نحسب سعر الصرف دلوقتي — جرّب تدفع بنفس عملة العرض أو حاول بعد شوية.",
  FX_RATE_STALE: "أسعار الصرف بتتحدّث حاليًا — حاول تاني بعد دقايق.",
  PAYMENT_METHOD_NOT_AVAILABLE: "طريقة الدفع دي مش متاحة بالعملة المختارة — اختار طريقة تانية.",
};

export function friendlyErrorMessage(e: unknown, fallback: string, context: string): string {
  const raw = e instanceof Error ? e.message : String(e);
  for (const [code, message] of Object.entries(BOOKING_ERROR_CODES)) {
    if (raw.includes(code)) return message;
  }
  if (raw && ARABIC_RE.test(raw)) return raw;
  console.error(`[${context}]`, e);
  Sentry.captureException(e instanceof Error ? e : new Error(raw), { tags: { context } });
  return fallback;
}
