/**
 * Currency math + formatting (pure functions — no React, no network).
 *
 * The single source of truth for exchange rates is the database
 * (`v_currency_rates`, fed by the fx refresh job and the official pegs). Everything
 * here works off a `RateTable` built from that view, pivoting through USD exactly like
 * the SQL helpers `convert_currency()` / `to_usd()` do, so what the customer sees
 * on screen and what the server later charges are computed the same way.
 */

export type CurrencyInfo = {
  code: string;
  name_ar: string;
  name_en: string;
  symbol_ar: string;
  symbol_en: string;
  decimals: number;
  /** Units of this currency per 1 USD. `null` = no trustworthy rate available. */
  rate_per_usd: number | null;
  /** Percentage TripRing adds on top of the mid-market rate when it actually charges in this currency. */
  fx_spread_pct: number;
  /** True when the payment side can really collect money in this currency (else display-only). */
  is_chargeable: boolean;
  /** True when the stored rate is older than the freshness limit — treat as indicative only. */
  is_stale: boolean;
  rate_source: string | null;
  rate_fetched_at: string | null;
  sort_order: number;
};

export type RateTable = Record<string, CurrencyInfo>;

/** Currency shown when the visitor hasn't picked one (Egypt-first launch market). */
export const DEFAULT_DISPLAY_CURRENCY = "EGP";

/**
 * Used only until the live table arrives (or if it can't be fetched). Deliberately limited to USD and
 * the officially pegged Gulf currencies — those can't move, so hardcoding them is safe. Floating
 * currencies (EGP, KWD, MAD) get `rate_per_usd: null`, which makes conversion return `null` and the UI
 * fall back to the price's own currency instead of showing an invented number.
 */
const fallback = (
  code: string,
  name_ar: string,
  name_en: string,
  symbol_ar: string,
  symbol_en: string,
  decimals: number,
  rate_per_usd: number | null,
  is_chargeable: boolean,
  sort_order: number,
): CurrencyInfo => ({
  code,
  name_ar,
  name_en,
  symbol_ar,
  symbol_en,
  decimals,
  rate_per_usd,
  fx_spread_pct: 0,
  is_chargeable,
  is_stale: rate_per_usd == null,
  rate_source: rate_per_usd == null ? null : "peg",
  rate_fetched_at: null,
  sort_order,
});

export const FALLBACK_CURRENCIES: CurrencyInfo[] = [
  fallback("USD", "دولار أمريكي", "US Dollar", "$", "$", 2, 1, true, 1),
  fallback("EGP", "جنيه مصري", "Egyptian Pound", "ج.م", "EGP", 2, null, true, 2),
  fallback("SAR", "ريال سعودي", "Saudi Riyal", "ر.س", "SAR", 2, 3.75, false, 3),
  fallback("AED", "درهم إماراتي", "UAE Dirham", "د.إ", "AED", 2, 3.6725, false, 4),
  fallback("KWD", "دينار كويتي", "Kuwaiti Dinar", "د.ك", "KWD", 3, null, false, 5),
  fallback("QAR", "ريال قطري", "Qatari Riyal", "ر.ق", "QAR", 2, 3.64, false, 6),
  fallback("BHD", "دينار بحريني", "Bahraini Dinar", "د.ب", "BHD", 3, 0.376, false, 7),
  fallback("OMR", "ريال عماني", "Omani Rial", "ر.ع", "OMR", 3, 0.3845, false, 8),
  fallback("JOD", "دينار أردني", "Jordanian Dinar", "د.أ", "JOD", 3, 0.709, false, 9),
  fallback("MAD", "درهم مغربي", "Moroccan Dirham", "د.م", "MAD", 2, null, false, 10),
];

export function buildRateTable(list: CurrencyInfo[]): RateTable {
  const table: RateTable = {};
  for (const c of list) table[c.code] = c;
  return table;
}

/** Amount in `from` → `to`, pivoting through USD. `null` when either side has no usable rate. */
export function convertAmount(amount: number, from: string, to: string, table: RateTable): number | null {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return amount;
  const fr = table[f]?.rate_per_usd;
  const tr = table[t]?.rate_per_usd;
  if (!fr || !tr) return null;
  return (amount / fr) * tr;
}

export function toUsd(amount: number, from: string, table: RateTable): number | null {
  return convertAmount(amount, from, "USD", table);
}

/**
 * What a customer pays when the deal currency (`base`) is charged in `charge` — mirrors `create_fx_quote()`:
 * mid-market rate × (1 + the larger of the two currencies' spreads). Used for the *estimate* shown before
 * the customer confirms; the real amount always comes from the rate locked server-side at booking time.
 */
export function estimateCharge(amount: number, base: string, charge: string, table: RateTable): number | null {
  const b = base.toUpperCase();
  const c = charge.toUpperCase();
  if (b === c) return roundTo(amount, table[c]?.decimals ?? 2);
  const mid = convertAmount(amount, b, c, table);
  if (mid == null) return null;
  const spread = Math.max(table[b]?.fx_spread_pct ?? 0, table[c]?.fx_spread_pct ?? 0);
  return roundTo(mid * (1 + spread / 100), table[c]?.decimals ?? 2);
}

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/**
 * Digits shown on a price tag. Whole numbers for currencies where one unit is small (EGP, SAR, USD…),
 * two decimals for the high-value dinars/rial (1 KWD ≈ 3.2 USD) where rounding to a whole unit would hide real money.
 * `exact` uses the currency's own precision instead — for money that will actually be charged.
 */
function fractionDigits(code: string, table: RateTable | undefined, exact: boolean): number {
  const info = table?.[code];
  if (exact) return info?.decimals ?? 2;
  const rate = info?.rate_per_usd;
  return rate != null && rate < 1 ? 2 : 0;
}

/** Prices always use Latin numerals (product convention), whatever the UI language. */
export function formatMoney(
  amount: number,
  code: string,
  options: { table?: RateTable; exact?: boolean } = {},
): string {
  const upper = code.toUpperCase();
  const digits = fractionDigits(upper, options.table, options.exact ?? false);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: upper,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    // Unknown/invalid ISO code — never throw from a render path.
    return `${upper} ${amount.toLocaleString("en-US", { maximumFractionDigits: digits })}`;
  }
}

/** Left-to-right mark keeps the "≈" on the left of the figure inside RTL (Arabic) paragraphs. */
export const APPROX_PREFIX = "\u200E≈ ";
