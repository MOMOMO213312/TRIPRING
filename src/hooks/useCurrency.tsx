import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  APPROX_PREFIX,
  DEFAULT_DISPLAY_CURRENCY,
  FALLBACK_CURRENCIES,
  buildRateTable,
  convertAmount,
  estimateCharge,
  formatMoney,
  toUsd,
} from "../lib/currency";
import type { CurrencyInfo, RateTable } from "../lib/currency";
import { supabase } from "../lib/supabase";

const CHOICE_KEY = "tripring.currency";
const CACHE_KEY = "tripring.fx.v1";
const CACHE_TTL_MS = 30 * 60 * 1000;

type CurrencyContextValue = {
  /** ISO code the visitor is browsing prices in. */
  currency: string;
  setCurrency: (code: string) => void;
  /** All active currencies, in display order (drives the switcher). */
  currencies: CurrencyInfo[];
  rates: RateTable;
  /** False until the live rate table arrived (prices still render — from cache/pegs/native currency). */
  ratesLoaded: boolean;
  /** Amount in `from` → display currency, or `null` when no rate is available. */
  convert: (amount: number, from: string) => number | null;
  /** Amount in `from` → any target currency (not just the display one), or `null` without a rate. */
  convertTo: (amount: number, from: string, to: string) => number | null;
  /** Display-currency amount → USD (used to filter/sort on the server's `price_usd`). */
  displayToUsd: (amount: number) => number | null;
  /** USD → display currency. */
  usdToDisplay: (amountUsd: number) => number | null;
  /**
   * Format a price for the visitor: converted to the display currency and prefixed with "≈" when a
   * conversion happened; shown in its own currency (never guessed) when no rate is available.
   */
  fmt: (amount: number, from?: string | null) => string;
  /** Format in a given currency with no conversion — for amounts that are already final (e.g. what will be charged). */
  fmtIn: (amount: number, code: string, exact?: boolean) => string;
  /** What the customer would pay in `charge` for an amount priced in `base` (spread included) — estimate only. */
  estimate: (amount: number, base: string, charge: string) => number | null;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

type CachedRates = { savedAt: number; list: CurrencyInfo[] };

function readCache(): CurrencyInfo[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRates;
    if (!Array.isArray(parsed.list) || parsed.list.length === 0) return null;
    // An expired cache is still better than nothing for first paint; the fresh fetch replaces it right away.
    return parsed.list;
  } catch {
    return null;
  }
}

function cacheIsFresh(): boolean {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as CachedRates;
    return Date.now() - parsed.savedAt < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

function writeCache(list: CurrencyInfo[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), list } satisfies CachedRates));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

async function fetchCurrencyRates(): Promise<CurrencyInfo[]> {
  const { data, error } = await supabase
    .from("v_currency_rates")
    .select(
      "code,name_ar,name_en,symbol_ar,symbol_en,decimals,rate_per_usd,fx_spread_pct,is_chargeable,is_stale,rate_source,rate_fetched_at,sort_order",
    )
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  // Same convention as lib/*.ts: the hand-written Database type can't drive select() inference, so cast the rows.
  const rows = (data ?? []) as unknown as CurrencyInfo[];
  return rows.map((r) => ({
    ...r,
    // numeric columns can arrive as strings depending on the client path
    decimals: Number(r.decimals),
    rate_per_usd: r.rate_per_usd == null ? null : Number(r.rate_per_usd),
    fx_spread_pct: Number(r.fx_spread_pct ?? 0),
    sort_order: Number(r.sort_order),
  }));
}

function readChoice(): string | null {
  try {
    return localStorage.getItem(CHOICE_KEY);
  } catch {
    return null;
  }
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<CurrencyInfo[]>(() => readCache() ?? FALLBACK_CURRENCIES);
  const [ratesLoaded, setRatesLoaded] = useState(false);
  const [choice, setChoice] = useState<string>(() => readChoice() ?? DEFAULT_DISPLAY_CURRENCY);

  useEffect(() => {
    let cancelled = false;
    // Skip the network round-trip when we refreshed within the last half hour (rates only move every ~6h).
    if (cacheIsFresh() && readCache()) {
      setRatesLoaded(true);
      return;
    }
    fetchCurrencyRates()
      .then((fresh) => {
        if (cancelled || fresh.length === 0) return;
        setList(fresh);
        writeCache(fresh);
        setRatesLoaded(true);
      })
      .catch((e) => {
        // Non-fatal: cache/pegs keep working and unconvertible prices stay in their own currency.
        console.error("[CurrencyProvider] failed to load exchange rates:", e);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rates = useMemo(() => buildRateTable(list), [list]);

  // A saved choice can point at a currency that was later deactivated — fall back rather than break.
  const currency = rates[choice] ? choice : DEFAULT_DISPLAY_CURRENCY;

  const setCurrency = useCallback((code: string) => {
    setChoice(code);
    try {
      localStorage.setItem(CHOICE_KEY, code);
    } catch {
      /* private mode etc. — the choice just won't persist */
    }
  }, []);

  const value = useMemo<CurrencyContextValue>(() => {
    const convert = (amount: number, from: string) => convertAmount(amount, from, currency, rates);
    return {
      currency,
      setCurrency,
      currencies: list,
      rates,
      ratesLoaded,
      convert,
      convertTo: (amount, from, to) => convertAmount(amount, from, to, rates),
      displayToUsd: (amount) => toUsd(amount, currency, rates),
      usdToDisplay: (amountUsd) => convertAmount(amountUsd, "USD", currency, rates),
      fmt: (amount, from) => {
        const source = (from ?? "USD").toUpperCase();
        if (source === currency) return formatMoney(amount, currency, { table: rates });
        const converted = convertAmount(amount, source, currency, rates);
        if (converted == null) return formatMoney(amount, source, { table: rates });
        return APPROX_PREFIX + formatMoney(converted, currency, { table: rates });
      },
      fmtIn: (amount, code, exact = false) => formatMoney(amount, code, { table: rates, exact }),
      estimate: (amount, base, charge) => estimateCharge(amount, base, charge, rates),
    };
  }, [currency, setCurrency, list, rates, ratesLoaded]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside <CurrencyProvider>");
  return ctx;
}
