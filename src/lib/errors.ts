/**
 * Error handling for Postgres RPC / trigger failures.
 *
 * Our SECURITY DEFINER functions and guard triggers no longer `RAISE EXCEPTION` with
 * human-readable (Arabic) text. They raise a stable UPPER_SNAKE_CASE **code**
 * (`BOOKING_NOT_FOUND`, `SEATS_INSUFFICIENT`, ...) and put any dynamic value in the
 * Postgres `DETAIL` field — either a plain value ("120", "QR") or a JSON object
 * (`{"available":2,"needed":3}`). The UI translates the code through the `errors`
 * i18n namespace (ar / en / tr) and interpolates the detail as parameters.
 *
 * Anything that isn't a known code — a dropped connection, a PostgREST schema error like
 * "JSON object requested, multiple (or no) rows returned", "Failed to fetch" — is a raw
 * technical string that must never reach the customer, so we log it and show the caller's
 * friendly fallback instead.
 */
import i18n from "../i18n";
import { Sentry } from "./sentry";

const CODE_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
const ARABIC_RE = /[\u0600-\u06FF]/;
const KEY_RE = /^[a-zA-Z]+:[\w.]+$/;

/** Error that keeps the Postgres code/detail alongside the message. */
export class AppError extends Error {
  code?: string;
  detail?: string;
  constructor(message: string, detail?: string | null, code?: string | null) {
    super(message);
    this.name = "AppError";
    this.detail = detail ?? undefined;
    this.code = code ?? undefined;
  }
}

type PgLike = { message: string; details?: string | null; code?: string | null };

/**
 * Wrap a supabase-js / PostgREST error so the DETAIL field survives.
 * Drop-in replacement for `new Error(error.message)`.
 */
export function dbError(error: PgLike): AppError {
  return new AppError(error.message, error.details, error.code);
}

function parseDetail(detail: unknown): Record<string, string> {
  if (detail == null || detail === "") return {};
  const s = String(detail).trim();
  const params: Record<string, string> = { detail: s };
  if (s.startsWith("{")) {
    try {
      const obj = JSON.parse(s) as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) params[k] = String(v);
    } catch {
      /* plain text detail */
    }
  }
  return params;
}

/** Resolve the caller-provided fallback: either an i18n key ("ns:path") or literal text. */
function resolveFallback(fallback: string): string {
  if (KEY_RE.test(fallback)) return i18n.t(fallback);
  // A hard-coded Arabic fallback must not be shown to an English/Turkish user.
  if (ARABIC_RE.test(fallback) && i18n.language !== "ar") return i18n.t("errors:_generic");
  return fallback;
}

/** Translate a known DB error code (case-insensitive). Returns null when unknown. */
export function translateErrorCode(code: string, detail?: unknown): string | null {
  const key = `errors:${code.toUpperCase()}`;
  if (!i18n.exists(key)) return null;
  return i18n.t(key, parseDetail(detail));
}

export function friendlyErrorMessage(e: unknown, fallback: string, context: string): string {
  const raw = e instanceof Error ? e.message : String(e);
  const detail = (e as { detail?: unknown; details?: unknown } | null)?.detail ?? (e as { details?: unknown } | null)?.details;

  const trimmed = raw.trim();
  if (CODE_RE.test(trimmed)) {
    const translated = translateErrorCode(trimmed, detail);
    if (translated) return translated; // expected business error — not worth reporting
  }

  // Legacy: RPCs that still raise a readable Arabic sentence are safe to show as-is — but only
  // to Arabic users.
  if (raw && ARABIC_RE.test(raw) && i18n.language === "ar") return raw;

  console.error(`[${context}]`, e);
  Sentry.captureException(e instanceof Error ? e : new Error(raw), { tags: { context } });
  return resolveFallback(fallback);
}
