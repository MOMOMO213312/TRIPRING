import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import i18n from "../i18n";
import { fetchFarePackageTiers } from "./api";
import type { AdditionalServiceRow, FarePackageTierRow } from "../types/database";

/**
 * "Fare bundle" tiers shown on the deal-detail page (Ticket only / Smart Trip / Premium Trip).
 *
 * The source of truth for pricing (label + markup_percent + which tiers are
 * active/what order) is the `fare_package_tiers` table — never hardcode those
 * numbers here. What IS hardcoded here is purely presentational metadata that
 * has no column in the DB: the "most popular" badge, the bundled
 * `additional_services` keys, and the bullet-point perks copy. `usePackageOptions`
 * merges the two: live numbers from Supabase + local display metadata by tier id.
 *
 * `FALLBACK_TIERS` is only used before the live fetch resolves (or if
 * it fails) so the UI never blocks on network — it mirrors the DB's current
 * values but is not the source of truth once the fetch succeeds.
 */
export type PackageTier = "basic" | "smart" | "premium";
export type ServiceKey = "transfer" | "lounge" | "fast_track" | "insurance";

export interface PackageOption {
  id: PackageTier;
  label: string;
  badge?: string;
  markupPercent: number;
  includedServiceKeys: ServiceKey[];
  perks: string[];
}

/**
 * Presentational metadata with no DB column. The human-readable text (label,
 * badge, perks) lives in the `packages` i18n namespace, keyed by tier id.
 */
const DISPLAY_META: Record<PackageTier, { hasBadge: boolean; includedServiceKeys: ServiceKey[] }> = {
  basic: { hasBadge: false, includedServiceKeys: [] },
  smart: { hasBadge: true, includedServiceKeys: ["transfer"] },
  premium: { hasBadge: false, includedServiceKeys: ["transfer", "lounge", "fast_track", "insurance"] },
};

/** Tier data before localisation: live numbers from the DB plus (optionally) the DB's own label. */
type BaseTier = { id: PackageTier; dbLabel?: string; markupPercent: number };

// Only used before the live fetch resolves (or if it fails) — mirrors the DB's current values.
const FALLBACK_TIERS: BaseTier[] = [
  { id: "basic", markupPercent: 0 },
  { id: "smart", markupPercent: 0.076 },
  { id: "premium", markupPercent: 0.238 },
];

/**
 * Builds a display-ready tier in the active language. For Arabic the label stays
 * whatever `fare_package_tiers.label` says (the DB is the source of truth there);
 * English/Turkish use the translation for that tier id.
 */
function localiseTier(base: BaseTier): PackageOption {
  const meta = DISPLAY_META[base.id];
  const perks = i18n.t(`packages:tier.${base.id}.perks`, { returnObjects: true });
  const useDbLabel = i18n.language.startsWith("ar") && !!base.dbLabel;
  return {
    id: base.id,
    label: useDbLabel ? (base.dbLabel as string) : i18n.t(`packages:tier.${base.id}.label`),
    badge: meta.hasBadge ? i18n.t(`packages:tier.${base.id}.badge`) : undefined,
    markupPercent: base.markupPercent,
    includedServiceKeys: meta.includedServiceKeys,
    perks: Array.isArray(perks) ? (perks as string[]) : [],
  };
}

function isPackageTier(tier: string): tier is PackageTier {
  return tier === "basic" || tier === "smart" || tier === "premium";
}

function mergeTiers(rows: FarePackageTierRow[]): BaseTier[] {
  const merged = rows
    .filter((r): r is FarePackageTierRow & { tier: PackageTier } => isPackageTier(r.tier))
    .map((r) => ({ id: r.tier, dbLabel: r.label, markupPercent: Number(r.markup_percent) }));
  return merged.length > 0 ? merged : FALLBACK_TIERS;
}

// Module-level cache so every component calling the hook shares one fetch
// instead of each re-querying Supabase independently.
let cachedTiers: BaseTier[] | null = null;
let inFlight: Promise<BaseTier[]> | null = null;

async function loadTiers(): Promise<BaseTier[]> {
  if (cachedTiers) return cachedTiers;
  if (!inFlight) {
    inFlight = fetchFarePackageTiers()
      .then((rows) => {
        cachedTiers = mergeTiers(rows);
        return cachedTiers;
      })
      .catch(() => FALLBACK_TIERS);
  }
  return inFlight;
}

/**
 * Live package tiers, sourced from `fare_package_tiers`, localised to the active
 * UI language. Returns the fallback tiers synchronously on first render (no
 * loading flicker), then swaps in the live DB values once the fetch resolves.
 */
export function usePackageOptions(): PackageOption[] {
  const { i18n: inst } = useTranslation("packages");
  const [tiers, setTiers] = useState<BaseTier[]>(cachedTiers ?? FALLBACK_TIERS);

  useEffect(() => {
    let cancelled = false;
    loadTiers().then((t) => {
      if (!cancelled) setTiers(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-localise whenever the language changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => tiers.map(localiseTier), [tiers, inst.language]);
}

const SERVICE_KEYWORDS: Record<ServiceKey, string[]> = {
  // "shuttle" and "airport_transfer" both mean the same trip leg — kept under
  // one key so a catalog with both rows renders as a single included line.
  transfer: ["انتقال", "نقل", "transfer", "shuttle", "airport_transfer"],
  lounge: ["صالة", "lounge"],
  fast_track: ["fast track", "فاست تراك", "سريع", "fast_track"],
  insurance: ["تأمين", "insurance", "travel_insurance"],
};

/** Best-effort mapping from a real additional_services row to one of the known service keys. */
export function classifyService(service: AdditionalServiceRow): ServiceKey | null {
  const text = service.type.toLowerCase();
  for (const key of Object.keys(SERVICE_KEYWORDS) as ServiceKey[]) {
    if (SERVICE_KEYWORDS[key].some((kw) => text.includes(kw.toLowerCase()))) return key;
  }
  return null;
}

/**
 * Collapses catalog rows that classify to the same ServiceKey (e.g. a
 * "shuttle" row and an "airport_transfer" row both mean "transfer") into one
 * displayed row — picking the cheapest to represent the group — so the
 * customer never sees the same real-world service listed twice.
 */
export function dedupeByKey(services: AdditionalServiceRow[]): AdditionalServiceRow[] {
  const seen = new Map<ServiceKey, AdditionalServiceRow>();
  const unclassified: AdditionalServiceRow[] = [];
  for (const s of services) {
    const key = classifyService(s);
    if (!key) {
      unclassified.push(s);
      continue;
    }
    const existing = seen.get(key);
    if (!existing || s.price < existing.price) seen.set(key, s);
  }
  return [...seen.values(), ...unclassified];
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
