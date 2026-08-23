import type { DealType, StopType } from "../types/database";
import type { AirlineRow, AirportRow, DealRow, RoutePriceReferenceRow } from "../types/database";
import { dataStatuses, type DataStatus } from "./filters";

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  flash: "عرض سريع",
  last_minute: "آخر لحظة",
  empty_seat: "مقعد فارغ",
  special_fare: "سعر خاص",
};

export function dealTypeLabel(type: DealType): string {
  return DEAL_TYPE_LABELS[type] ?? type;
}

/** Badge color per deal type — shared between the homepage rail card and the main deal card. */
const DEAL_TYPE_BADGE_STYLE: Record<DealType, string> = {
  flash: "bg-[#0C7BB3]",
  last_minute: "bg-[#0F172A]",
  empty_seat: "bg-[#9F1246]",
  special_fare: "bg-[#0C7BB3]",
};

export function dealTypeBadgeClass(type: DealType): string {
  return DEAL_TYPE_BADGE_STYLE[type] ?? "bg-[#0C7BB3]";
}

export function formatRoute(deal: DealRow): string {
  return `${deal.from_airport} → ${deal.to_airport}`;
}

export function formatRouteCities(deal: DealRow, airports: AirportRow[]): string {
  const from = airports.find((a) => a.code === deal.from_airport);
  const to = airports.find((a) => a.code === deal.to_airport);
  const fromName = from?.city_en ?? from?.city ?? deal.from_airport;
  const toName = to?.city_en ?? to?.city ?? deal.to_airport;
  return `${fromName} → ${toName}`;
}

export function airportLabel(code: string, airports: AirportRow[]): string {
  const ap = airports.find((a) => a.code === code);
  return ap ? `${ap.city} (${code})` : code;
}

export type TripScope = "domestic" | "international";

const DOMESTIC_COUNTRY = "مصر";

/** Whether a deal's destination is inside Egypt (domestic) or abroad (international). */
export function dealTripScope(deal: DealRow, airports: AirportRow[]): TripScope {
  const to = airports.find((a) => a.code === deal.to_airport);
  return to?.country === DOMESTIC_COUNTRY ? "domestic" : "international";
}

export function airlineName(code: string | null, airlines: AirlineRow[]): string {
  if (!code) return "—";
  return airlines.find((a) => a.code === code)?.name ?? code;
}

/** Visual style for the plain rank-position number badge (#1, #2…) — no quality claim attached. */
export function rankBadgeStyle(rank: number): { bg: string; text: string } {
  if (rank === 1) return { bg: "#F59E0B", text: "#ffffff" };
  return { bg: "#16A34A", text: "#ffffff" };
}

export function stopsMetaLabel(stops: StopType): string {
  if (stops === "direct") return "بدون توقف";
  if (stops === "one_stop") return "توقف واحد";
  return "توقفات متعددة";
}

export function departureTimingLabel(departureDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dep = new Date(departureDate + "T00:00:00");
  const diffDays = Math.round((dep.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "غداً";
  if (diffDays > 1 && diffDays <= 7) return `بعد ${diffDays} أيام`;
  return departureDate;
}

export function seatsLeftLabel(seats: number): string {
  if (seats <= 0) return "نفدت المقاعد";
  return `${seats} مقعد متبقي`;
}

export function isLowSeats(seats: number): boolean {
  return seats > 0 && seats <= 5;
}

export function getRouteReference(
  deal: DealRow,
  references: RoutePriceReferenceRow[],
): RoutePriceReferenceRow | undefined {
  return references.find(
    (r) => r.from_airport === deal.from_airport && r.to_airport === deal.to_airport,
  );
}

/** @deprecated use stopsMetaLabel */
export function stopsLabel(stops: StopType): string {
  return stopsMetaLabel(stops);
}

/** Formats layover_minutes as "س / د" — returns null when there's nothing to show. */
export function layoverLabel(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} دقيقة`;
  if (m === 0) return `${h} ساعة`;
  return `${h} س ${m} د`;
}

/** True when a deal has any of the flight-identity fields worth their own card. */
export function hasFlightIdentity(deal: DealRow): boolean {
  return Boolean(
    deal.flight_number || deal.aircraft_type || deal.arrival_date || deal.layover_minutes,
  );
}

/** True when a deal has any fare-conditions fields (refund/change policy, fare family, rules). */
export function hasFareConditions(deal: DealRow): boolean {
  return Boolean(
    deal.fare_family ||
      deal.refundable != null ||
      deal.changeable != null ||
      deal.fare_rules,
  );
}

/** True when a deal has richer baggage detail beyond the legacy single baggage_kg field. */
export function hasBaggageDetail(deal: DealRow): boolean {
  return Boolean(deal.cabin_baggage_kg || deal.checked_bags_count != null || deal.extra_baggage_price);
}

/** True when a deal has a base-fare/taxes breakdown worth showing under the headline price. */
export function hasPriceBreakdown(deal: DealRow): boolean {
  return Boolean(deal.base_fare != null && deal.taxes_fees != null);
}

/** Short baggage label for compact card display — prefers checked-bag detail, falls back to legacy baggage_kg. */
export function baggageBadgeLabel(deal: DealRow): string | null {
  if (deal.checked_bags_count != null && deal.baggage_kg) {
    return `${deal.checked_bags_count}× ${deal.baggage_kg} كجم`;
  }
  if (deal.baggage_kg) return `${deal.baggage_kg} كجم`;
  if (deal.cabin_baggage_kg) return `كابينة ${deal.cabin_baggage_kg} كجم`;
  return null;
}

/**
 * Narrows a route's known departure dates to a ±windowDays span around the
 * customer's chosen date. Only returns dates that actually have a deal on
 * file — never fabricates days with no data, since the catalog is entered
 * manually and has real gaps.
 */
export function flexibleDateWindow<T extends { date: string }>(
  entries: T[],
  centerDate: string,
  windowDays = 3,
): T[] {
  const center = new Date(centerDate + "T00:00:00").getTime();
  return entries.filter((e) => {
    const diffDays = Math.abs((new Date(e.date + "T00:00:00").getTime() - center) / 86400000);
    return diffDays <= windowDays;
  });
}

const DATA_STATUS_META: Record<DataStatus, { icon: string; label: string }> = {
  verified: { icon: "🟢", label: "تم التحقق مؤخرًا" },
  needs_check: { icon: "🟡", label: "يحتاج تحقق" },
  limited: { icon: "🔥", label: "فرصة محدودة" },
};

/** "🟢/🟡/🔥" data-status badges shown on a card — built only from real, checkable fields (price_checked_at, seats, expiry). */
export function dataStatusBadges(deal: DealRow): { icon: string; label: string; status: DataStatus }[] {
  return dataStatuses(deal).map((status) => ({ ...DATA_STATUS_META[status], status }));
}

export type DealReason = { icon: "down" | "seats" | "nonstop" | "fresh" | "score"; text: string };

/**
 * "Opportunity Explanation" — plain-language reasons this deal is worth
 * looking at, built only from real deal/price-history data (no invented
 * signals). Mirrors the checklist under the Deal Score ring in the agreed
 * detail-page design.
 */
export function dealReasons(
  deal: DealRow,
  history: { old_price: number; new_price: number; changed_at: string }[],
): DealReason[] {
  const reasons: DealReason[] = [];

  const lastDrop = [...history].sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
  )[0];
  if (lastDrop && lastDrop.new_price < lastDrop.old_price) {
    const diff = Math.round(lastDrop.old_price - lastDrop.new_price);
    reasons.push({ icon: "down", text: `انخفض السعر ${diff} ${deal.currency ?? "USD"} مؤخرًا` });
  }

  if (deal.available_seats > 0 && deal.available_seats <= 6) {
    reasons.push({ icon: "seats", text: `توفر جيد لكن محدود (${deal.available_seats} مقاعد متبقية)` });
  } else if (deal.available_seats > 6) {
    reasons.push({ icon: "seats", text: "توفر مقاعد جيد" });
  }

  if (deal.stops === "direct") {
    reasons.push({ icon: "nonstop", text: "رحلة مباشرة بدون توقف" });
  }

  const updated = new Date(deal.updated_at).getTime();
  const minutesAgo = Math.max(0, Math.round((Date.now() - updated) / 60000));
  const freshnessText =
    minutesAgo < 1
      ? "تم التحقق الآن"
      : minutesAgo < 60
        ? `تم التحقق منذ ${minutesAgo} دقيقة`
        : `تم التحقق منذ ${Math.round(minutesAgo / 60)} ساعة`;
  reasons.push({ icon: "fresh", text: freshnessText });

  return reasons;
}
