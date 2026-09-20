import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchFarePackageTiers } from "./api";
import i18n from "../i18n";
import type { AdditionalServiceRow, FarePackageTierRow } from "../types/database";

/**
 * "Fare bundle" tiers shown on the deal-detail page (Ticket only / Smart Trip / Premium Trip).
 *
 * The source of truth for pricing (markup_percent + which tiers are active/what order) is the
 * `fare_package_tiers` table — never hardcode those numbers here. What IS local is purely
 * presentational metadata that has no column in the DB: the "most popular" badge, the bundled
 * `additional_services` keys, and the perk bullets. Every user-facing string (label, badge,
 * perks) lives in the `booking` i18n namespace and is resolved at render time.
 *
 * IMPORTANT: the module-level cache below stores ONLY language-independent data
 * (id / markup / included services). Localised text is derived from it in
 * `usePackageOptions()`, so switching the UI language updates the labels immediately
 * instead of freezing whatever language was active when the first fetch resolved.
 *
 * `FALLBACK_TIERS` is only used before the live fetch resolves (or if it fails) so the UI never
 * blocks on network — it mirrors the DB's current values but is not the source of truth once
 * the fetch succeeds.
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

/** Language-independent part of a package option. */
interface PackageTierData {
  id: PackageTier;
  markupPercent: number;
  includedServiceKeys: ServiceKey[];
}

/** Presentational metadata per tier; perks are i18n key segments under booking:packages.perk.*. */
const DISPLAY_META: Record<PackageTier, { popular?: boolean; includedServiceKeys: ServiceKey[]; perkKeys: string[] }> = {
  basic: {
    includedServiceKeys: [],
    perkKeys: ["ticketOnly"],
  },
  smart: {
    popular: true,
    includedServiceKeys: ["transfer"],
    perkKeys: ["ticket", "oneBag", "transfer", "support"],
  },
  premium: {
    includedServiceKeys: ["transfer", "lounge", "fast_track", "insurance"],
    perkKeys: ["ticket", "oneBag", "transfer", "lounge", "fastTrack", "insurance", "support"],
  },
};

const FALLBACK_TIERS: PackageTierData[] = [
  { id: "basic", markupPercent: 0, includedServiceKeys: DISPLAY_META.basic.includedServiceKeys },
  { id: "smart", markupPercent: 0.076, includedServiceKeys: DISPLAY_META.smart.includedServiceKeys },
  { id: "premium", markupPercent: 0.238, includedServiceKeys: DISPLAY_META.premium.includedServiceKeys },
];

/** Resolve a tier's label / badge / perks in the CURRENT UI language. */
function localizeTier(tier: PackageTierData): PackageOption {
  const meta = DISPLAY_META[tier.id];
  return {
    ...tier,
    label: i18n.t(`booking:packages.${tier.id}.label`),
    badge: meta.popular ? i18n.t("booking:packages.badge.popular") : undefined,
    perks: meta.perkKeys.map((k) => i18n.t(`booking:packages.perk.${k}`)),
  };
}

function isPackageTier(tier: string): tier is PackageTier {
  return tier === "basic" || tier === "smart" || tier === "premium";
}

function mergeTiers(rows: FarePackageTierRow[]): PackageTierData[] {
  const merged = rows
    .filter((r): r is FarePackageTierRow & { tier: PackageTier } => isPackageTier(r.tier))
    .map((r) => ({
      id: r.tier,
      markupPercent: Number(r.markup_percent),
      includedServiceKeys: DISPLAY_META[r.tier].includedServiceKeys,
    }));
  return merged.length > 0 ? merged : FALLBACK_TIERS;
}

// Module-level cache so every component calling the hook shares one fetch
// instead of each re-querying Supabase independently.
let cachedTiers: PackageTierData[] | null = null;
let inFlight: Promise<PackageTierData[]> | null = null;

async function loadPackageTiers(): Promise<PackageTierData[]> {
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
 * Live package tiers, sourced from `fare_package_tiers`. Returns the fallback tiers
 * synchronously on first render (no loading flicker), then swaps in the live DB values once
 * the fetch resolves. Text is localised per render and follows the active UI language.
 */
export function usePackageOptions(): PackageOption[] {
  const { i18n: i18nInstance } = useTranslation("booking");
  const [tiers, setTiers] = useState<PackageTierData[]>(cachedTiers ?? FALLBACK_TIERS);

  useEffect(() => {
    let cancelled = false;
    loadPackageTiers().then((t) => {
      if (!cancelled) setTiers(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => tiers.map(localizeTier), [tiers, i18nInstance.resolvedLanguage]);
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
