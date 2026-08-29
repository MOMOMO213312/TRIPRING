import type { AdditionalServiceRow } from "../types/database";

/**
 * "الباقات" — ready-made bundles of standalone airport services (transfer, lounge,
 * fast track, meet & assist, baggage, parking...), sold as one product at one price.
 *
 * This is deliberately independent from `lib/packages.ts` (the Basic/Smart/Premium
 * *fare* tiers shown when booking a specific flight deal). Service packages here are
 * airport-service bundles a customer can buy on the Explore page even if their ticket
 * was booked entirely outside TripRing — there is no dedicated bundles table in the
 * schema, so each package is expressed as a set of matched `additional_services` rows
 * (by keyword) plus a bundle discount, same pattern as the fare-tier packages.
 */

export type PackageServiceKey =
  | "transfer"
  | "lounge"
  | "fast_track"
  | "meet_assist"
  | "baggage"
  | "parking"
  | "insurance";

export const SERVICE_KEY_LABELS: Record<PackageServiceKey, string> = {
  transfer: "الانتقال من وإلى المطار",
  lounge: "صالة المطار (Lounge)",
  fast_track: "Fast Track",
  meet_assist: "استقبال ومرافقة (Meet & Assist)",
  baggage: "خدمات الأمتعة",
  parking: "موقف سيارات المطار",
  insurance: "تأمين السفر",
};

export const SERVICE_KEY_ICONS: Record<PackageServiceKey, string> = {
  transfer: "🚐",
  lounge: "🛋️",
  fast_track: "⚡",
  meet_assist: "🤝",
  baggage: "🧳",
  parking: "🅿️",
  insurance: "🛡️",
};

/**
 * Recommended-by-default keys: pre-checked in the selector (still removable),
 * unlike other add-ons which start unchecked. Insurance is the highest-margin
 * ancillary, so it opts customers in rather than making them find it.
 */
export const RECOMMENDED_SERVICE_KEYS: PackageServiceKey[] = ["insurance"];

const SERVICE_KEYWORDS: Record<PackageServiceKey, string[]> = {
  // NOTE: "shuttle" and "transfer"/"انتقال"/"نقل" intentionally share this
  // one key. Distinct catalog rows using either wording (e.g. "shuttle" vs
  // "airport_transfer") both resolve here so they render as ONE line in the
  // UI instead of two duplicate "included" rows for the same trip leg.
  transfer: ["انتقال", "نقل", "transfer", "shuttle", "airport_transfer"],
  lounge: ["صالة", "lounge"],
  fast_track: ["fast track", "فاست تراك", "fast-track", "fast_track"],
  meet_assist: ["meet", "assist", "استقبال", "مرافقة", "meet_assist"],
  baggage: ["أمتعة", "حقيبة", "baggage"],
  parking: ["parking", "باركينج", "موقف"],
  insurance: ["تأمين", "insurance", "travel_insurance"],
};

/** Fallback price (USD) used only when a matching real service isn't in the live catalog yet. */
const FALLBACK_PRICE: Record<PackageServiceKey, number> = {
  transfer: 10,
  lounge: 25,
  fast_track: 15,
  meet_assist: 20,
  baggage: 12,
  parking: 8,
  insurance: 12,
};

/**
 * Arabic display label for a real catalog service. `additional_services.name`
 * already holds a proper Arabic label per row (e.g. "تأمين سفر شامل") — this
 * just falls back to the raw `type` slug for any older row where `name`
 * wasn't filled in, so nothing ever renders blank.
 */
export function serviceDisplayLabel(service: AdditionalServiceRow): string {
  return service.name?.trim() || service.type;
}

export function classifyPackageService(service: AdditionalServiceRow): PackageServiceKey | null {
  const text = `${service.type} ${service.name}`.toLowerCase();
  for (const key of Object.keys(SERVICE_KEYWORDS) as PackageServiceKey[]) {
    if (SERVICE_KEYWORDS[key].some((kw) => text.includes(kw.toLowerCase()))) return key;
  }
  return null;
}

/** Cheapest real service matching a given key, if the live catalog has one. */
function cheapestForKey(key: PackageServiceKey, services: AdditionalServiceRow[]): AdditionalServiceRow | null {
  const matches = services.filter((s) => classifyPackageService(s) === key);
  if (matches.length === 0) return null;
  return matches.reduce((min, s) => (s.price < min.price ? s : min), matches[0]);
}

export type ServicePackageId = "vip" | "arrival" | "departure" | "family" | "business" | "custom";

export interface ServicePackageDef {
  id: ServicePackageId;
  title: string;
  subtitle: string;
  icon: string;
  badge?: string;
  includedKeys: PackageServiceKey[];
  /** Extra discount applied on top of summing the included services' prices. */
  discountPercent: number;
  isCustom?: boolean;
}

export const SERVICE_PACKAGES: ServicePackageDef[] = [
  {
    id: "vip",
    title: "VIP Airport Package",
    subtitle: "كل خدمات المطار في باقة واحدة شاملة",
    icon: "👑",
    badge: "الأشمل",
    includedKeys: ["transfer", "lounge", "fast_track", "meet_assist", "insurance"],
    discountPercent: 0.15,
  },
  {
    id: "arrival",
    title: "Arrival Package",
    subtitle: "استقبال VIP وانتقال مريح من المطار",
    icon: "🛬",
    includedKeys: ["meet_assist", "transfer"],
    discountPercent: 0.1,
  },
  {
    id: "departure",
    title: "Departure Package",
    subtitle: "انتقال للمطار مع Fast Track عند السفر",
    icon: "🛫",
    includedKeys: ["transfer", "fast_track"],
    discountPercent: 0.1,
  },
  {
    id: "family",
    title: "Family Package",
    subtitle: "انتقال يناسب العائلة مع خدمات الأمتعة",
    icon: "👨‍👩‍👧‍👦",
    includedKeys: ["transfer", "baggage", "meet_assist", "insurance"],
    discountPercent: 0.12,
  },
  {
    id: "business",
    title: "Business Traveler Package",
    subtitle: "صالة VIP وFast Track وانتقال خاص",
    icon: "💼",
    badge: "الأكثر طلباً",
    includedKeys: ["lounge", "fast_track", "transfer"],
    discountPercent: 0.15,
  },
  {
    id: "custom",
    title: "Custom Package",
    subtitle: "اختر الخدمات اللي تناسبك وكوّن باقتك بنفسك",
    icon: "🧩",
    includedKeys: [],
    discountPercent: 0.1,
    isCustom: true,
  },
];

export interface ResolvedPackageItem {
  key: PackageServiceKey;
  label: string;
  icon: string;
  price: number;
  service: AdditionalServiceRow | null;
}

/** Resolves a package's included keys against the live catalog (falling back to estimate prices). */
export function resolvePackageItems(
  keys: PackageServiceKey[],
  services: AdditionalServiceRow[],
): ResolvedPackageItem[] {
  return keys.map((key) => {
    const service = cheapestForKey(key, services);
    return {
      key,
      label: SERVICE_KEY_LABELS[key],
      icon: SERVICE_KEY_ICONS[key],
      price: service?.price ?? FALLBACK_PRICE[key],
      service,
    };
  });
}

export function packageSubtotal(items: ResolvedPackageItem[]): number {
  return items.reduce((sum, i) => sum + i.price, 0);
}

export function packageFinalPrice(items: ResolvedPackageItem[], discountPercent: number): number {
  const subtotal = packageSubtotal(items);
  return Math.round(subtotal * (1 - discountPercent) * 100) / 100;
}
