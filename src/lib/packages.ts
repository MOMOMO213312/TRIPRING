import type { AdditionalServiceRow } from "../types/database";

/**
 * "Fare bundle" tiers shown on the deal-detail page (تذكرة فقط / Smart Trip / Premium Trip).
 * There's no dedicated bundles table in the schema, so each tier is expressed as:
 *  - a markup percentage over the deal's base ticket price (covers non-itemized
 *    perks like priority support), and
 *  - a set of real `additional_services` rows that come bundled for free.
 * This keeps everything else (booking payload, totals) working off the existing
 * `additional_services` table instead of inventing new backend concepts.
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

export const PACKAGE_OPTIONS: PackageOption[] = [
  {
    id: "basic",
    label: "تذكرة فقط",
    markupPercent: 0,
    includedServiceKeys: [],
    perks: ["تذكرة الطيران فقط"],
  },
  {
    id: "smart",
    label: "Smart Trip",
    badge: "الأكثر اختياراً",
    markupPercent: 0.076,
    includedServiceKeys: ["transfer"],
    perks: ["تذكرة الطيران", "حقيبة واحدة", "الانتقال من وإلى المطار", "دعم الرحلة"],
  },
  {
    id: "premium",
    label: "Premium Trip",
    markupPercent: 0.238,
    includedServiceKeys: ["transfer", "lounge", "fast_track"],
    perks: ["تذكرة الطيران", "حقيبة واحدة", "الانتقال من وإلى المطار", "صالة المطار (Lounge)", "Fast Track", "دعم الرحلة"],
  },
];

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
