import { useEffect, useState } from "react";

import { fetchFarePackageTiers } from "./api";
import type { AdditionalServiceRow, FarePackageTierRow } from "../types/database";

/**
 * "Fare bundle" tiers shown on the deal-detail page (تذكرة فقط / Smart Trip / Premium Trip).
 *
 * The source of truth for pricing (label + markup_percent + which tiers are
 * active/what order) is the `fare_package_tiers` table — never hardcode those
 * numbers here. What IS hardcoded here is purely presentational metadata that
 * has no column in the DB: the "الأكثر اختياراً" badge, the bundled
 * `additional_services` keys, and the bullet-point perks copy. `usePackageOptions`
 * merges the two: live numbers from Supabase + local display metadata by tier id.
 *
 * `FALLBACK_PACKAGE_OPTIONS` is only used before the live fetch resolves (or if
 * it fails) so the UI never blocks on network — it mirrors the DB's current
 * values but is not the source of truth once the fetch succeeds.
 */
export type PackageTier = "basic" | "smart" | "premium";
export type ServiceKey = "transfer" | "lounge" | "fast_track";

export interface PackageOption {
  id: PackageTier;
  label: string;
  badge?: string;
  markupPercent: number;
  includedServiceKeys: ServiceKey[];
  perks: string[];
}

const DISPLAY_META: Record<PackageTier, { badge?: string; includedServiceKeys: ServiceKey[]; perks: string[] }> = {
  basic: {
    includedServiceKeys: [],
    perks: ["تذكرة الطيران فقط"],
  },
  smart: {
    badge: "الأكثر اختياراً",
    includedServiceKeys: ["transfer"],
    perks: ["تذكرة الطيران", "حقيبة واحدة", "الانتقال من وإلى المطار", "دعم الرحلة"],
  },
  premium: {
    includedServiceKeys: ["transfer", "lounge", "fast_track"],
    perks: ["تذكرة الطيران", "حقيبة واحدة", "الانتقال من وإلى المطار", "صالة المطار (Lounge)", "Fast Track", "دعم الرحلة"],
  },
};

export const FALLBACK_PACKAGE_OPTIONS: PackageOption[] = [
  { id: "basic", label: "تذكرة فقط", markupPercent: 0, ...DISPLAY_META.basic },
  { id: "smart", label: "Smart Trip", markupPercent: 0.076, ...DISPLAY_META.smart },
  { id: "premium", label: "Premium Trip", markupPercent: 0.238, ...DISPLAY_META.premium },
];

/** @deprecated Use `usePackageOptions()` to get live values from `fare_package_tiers`. */
export const PACKAGE_OPTIONS = FALLBACK_PACKAGE_OPTIONS;

function isPackageTier(tier: string): tier is PackageTier {
  return tier === "basic" || tier === "smart" || tier === "premium";
}

function mergeTiers(rows: FarePackageTierRow[]): PackageOption[] {
  const merged = rows
    .filter((r): r is FarePackageTierRow & { tier: PackageTier } => isPackageTier(r.tier))
    .map((r) => ({
      id: r.tier,
      label: r.label,
      markupPercent: Number(r.markup_percent),
      ...(DISPLAY_META[r.tier] ?? { includedServiceKeys: [], perks: [r.label] }),
    }));
  return merged.length > 0 ? merged : FALLBACK_PACKAGE_OPTIONS;
}

// Module-level cache so every component calling the hook shares one fetch
// instead of each re-querying Supabase independently.
let cachedOptions: PackageOption[] | null = null;
let inFlight: Promise<PackageOption[]> | null = null;

async function loadPackageOptions(): Promise<PackageOption[]> {
  if (cachedOptions) return cachedOptions;
  if (!inFlight) {
    inFlight = fetchFarePackageTiers()
      .then((rows) => {
        cachedOptions = mergeTiers(rows);
        return cachedOptions;
      })
      .catch(() => FALLBACK_PACKAGE_OPTIONS);
  }
  return inFlight;
}

/**
 * Live package tiers, sourced from `fare_package_tiers`. Returns
 * `FALLBACK_PACKAGE_OPTIONS` synchronously on first render (no loading
 * flicker), then swaps in the live DB values once the fetch resolves.
 */
export function usePackageOptions(): PackageOption[] {
  const [options, setOptions] = useState<PackageOption[]>(cachedOptions ?? FALLBACK_PACKAGE_OPTIONS);

  useEffect(() => {
    let cancelled = false;
    loadPackageOptions().then((opts) => {
      if (!cancelled) setOptions(opts);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return options;
}

const SERVICE_KEYWORDS: Record<ServiceKey, string[]> = {
  transfer: ["انتقال", "نقل", "transfer", "shuttle"],
  lounge: ["صالة", "lounge"],
  fast_track: ["fast track", "فاست تراك", "سريع"],
};

/** Best-effort mapping from a real additional_services row to one of the known service keys. */
export function classifyService(service: AdditionalServiceRow): ServiceKey | null {
  const text = service.type.toLowerCase();
  for (const key of Object.keys(SERVICE_KEYWORDS) as ServiceKey[]) {
    if (SERVICE_KEYWORDS[key].some((kw) => text.includes(kw.toLowerCase()))) return key;
  }
  return null;
}

export function packagePrice(basePrice: number, pkg: PackageOption): number {
  return Math.round(basePrice * (1 + pkg.markupPercent));
}

/** Services that come bundled for free with a given package (matched from the real catalog). */
export function includedServicesFor(pkg: PackageOption, services: AdditionalServiceRow[]): AdditionalServiceRow[] {
  return services.filter((s) => {
    const key = classifyService(s);
    return key ? pkg.includedServiceKeys.includes(key) : false;
  });
}
