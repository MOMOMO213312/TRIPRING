/**
 * Our Postgres RPCs (create_booking, apply_booking_services, create_booking_with_charge...)
 * raise two kinds of exceptions for expected business cases:
 *  - stable machine CODES (e.g. "DEAL_NOT_FOUND", "FX_QUOTE_INVALID") - translated below via
 *    i18next so the message matches whatever language the customer is browsing in.
 *  - a shrinking set of legacy Arabic-only messages not yet converted to codes (see the
 *    tripring-currency-phase3 backlog) - still detected and shown as-is via ARABIC_RE, but
 *    ALWAYS in Arabic regardless of the customer's selected language until converted.
 *
 * Everything else that can reach a `.catch()` - a dropped connection, a PostgREST schema
 * error like "JSON object requested, multiple (or no) rows returned", a generic "Failed to
 * fetch" - is a raw technical string that should never reach the customer, especially at
 * checkout. It falls through to the caller's own localized `fallback` string.
 */
import i18n from "../i18n";
import { Sentry } from "./sentry";

const ARABIC_RE = /[\u0600-\u06FF]/;

/** Every RPC error code we currently raise, translated in src/i18n/locales/{ar,en,tr}.json
 * under the "errors" key. Add new codes there, not here. */
const KNOWN_ERROR_CODES = [
  "CURRENCY_NOT_CHARGEABLE",
  "CURRENCY_NOT_AVAILABLE",
  "FX_QUOTE_INVALID",
  "FX_RATE_UNAVAILABLE",
  "FX_RATE_STALE",
  "PAYMENT_METHOD_NOT_AVAILABLE",
  "DEAL_NOT_FOUND",
  "DEAL_EXPIRED",
  "NEED_ONE_ADULT",
  "SEATS_UNAVAILABLE",
  "NEED_ONE_SERVICE",
  "BOOKING_NOT_FOUND",
  "BOOKING_CANCELLED",
  "TRIP_DEPARTED",
  "INVALID_AIRPORT_LEG",
  "SERVICE_UNAVAILABLE",
  "AIRPORT_LEG_REQUIRED",
  "SERVICE_NOT_ELIGIBLE",
  "SERVICE_ALREADY_ADDED",
  "SERVICE_DUPLICATED_IN_REQUEST",
] as const;

export function friendlyErrorMessage(e: unknown, fallback: string, context: string): string {
  const raw = e instanceof Error ? e.message : String(e);

  for (const code of KNOWN_ERROR_CODES) {
    if (raw.includes(code)) return i18n.t(`errors.${code}`);
  }

  // Legacy path: an RPC not yet converted to a code raised its message directly in Arabic.
  if (raw && ARABIC_RE.test(raw)) return raw;

  console.error(`[${context}]`, e);
  Sentry.captureException(e instanceof Error ? e : new Error(raw), { tags: { context } });
  return fallback;
}
