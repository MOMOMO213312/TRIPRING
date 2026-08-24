import type { ServicePackageWithServices } from "./api";
import type { AdditionalServiceRow } from "../types/database";

/**
 * "Fare bundle" tiers shown on the deal-detail/booking pages (تذكرة فقط / Smart Trip /
 * Premium Trip). Backed by the real `service_packages` + `service_package_items` tables:
 * each tier has a fixed flat price (NOT a markup on the ticket price) and a real,
 * explicit set of bundled `additional_services` rows — no keyword guessing.
 */
export type PackageTier = "basic" | "smart" | "premium";

/** Labels/badges are still UI-only concerns (not stored in the DB), keyed by tier. */
const TIER_LABELS: Record<PackageTier, { label: string; badge?: string }> = {
  basic: { label: "تذكرة فقط" },
  smart: { label: "Smart Trip", badge: "الأكثر اختياراً" },
  premium: { label: "Premium Trip" },
};

export function packageLabel(pkg: ServicePackageWithServices): string {
  return TIER_LABELS[pkg.tier]?.label ?? pkg.name;
}

export function packageBadge(pkg: ServicePackageWithServices): string | undefined {
  return TIER_LABELS[pkg.tier]?.badge;
}

/** The package's price is its flat DB price (service_packages.price) — a fixed
 *  add-on bundle cost, NOT a markup/percentage of the ticket price. Callers that need
 *  a "ticket + bundle" total should add this to the deal's own price separately. */
export function packagePrice(pkg: ServicePackageWithServices): number {
  return pkg.price;
}

/** Services that come bundled for free with a given package (real DB relationship, not guessed). */
export function includedServicesFor(
  pkg: ServicePackageWithServices,
  _allServices: AdditionalServiceRow[],
): AdditionalServiceRow[] {
  return pkg.services;
}

export function findPackage(
  packages: ServicePackageWithServices[],
  tier: PackageTier | null,
): ServicePackageWithServices | undefined {
  return packages.find((p) => p.tier === tier);
}
