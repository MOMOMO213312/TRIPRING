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
const ARABIC_RE = /[\u0600-\u06FF]/;

export function friendlyErrorMessage(e: unknown, fallback: string, context: string): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (raw && ARABIC_RE.test(raw)) return raw;
  console.error(`[${context}]`, e);
  return fallback;
}
