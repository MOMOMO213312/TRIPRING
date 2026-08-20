import type { DealType, StopType } from "../types/database";
import type { AirlineRow, AirportRow, DealRow, RoutePriceReferenceRow } from "../types/database";

const DEAL_TYPE_LABELS: Record<DealType, string> = {
  flash: "عرض سريع",
  last_minute: "آخر لحظة",
  empty_seat: "مقعد فارغ",
  special_fare: "سعر خاص",
};

export function dealTypeLabel(type: DealType): string {
  return DEAL_TYPE_LABELS[type] ?? type;
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

export function savingsPercent(price: number, typical: number | null): number | null {
  if (!typical || typical <= price) return null;
  return Math.round(((typical - price) / typical) * 100);
}

export type ScoreTier = "excellent" | "good" | "fair";

/** Maps a raw deal_score (0-100) to a visual tier used by DealScoreRing/DealBadge. */
export function scoreTier(score: number | null): ScoreTier {
  if (score == null) return "fair";
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  return "fair";
}

export const SCORE_TIER_LABEL: Record<ScoreTier, string> = {
  excellent: "صفقة استثنائية",
  good: "صفقة ممتازة",
  fair: "صفقة جيدة",
};

export const SCORE_TIER_COLORS: Record<ScoreTier, { fg: string; bg: string; ring: string }> = {
  excellent: { fg: "#16A34A", bg: "#F0FDF4", ring: "#DCFCE7" },
  good: { fg: "#FF6B35", bg: "#FFEDE5", ring: "#FFD9C2" },
  fair: { fg: "#6B7280", bg: "#F9FAFB", ring: "#E5E7EB" },
};

export function dealQualityLabel(score: number | null): string {
  if (score == null) return "صفقة جيدة";
  if (score >= 90) return "صفقة استثنائية";
  if (score >= 80) return "صفقة ممتازة";
  return "صفقة جيدة";
}

/** Quality label tied to on-page rank (used in the top-5 "Best Opportunities" row). */
export function rankQualityLabel(rank: number): string {
  if (rank === 1) return "صفقة استثنائية";
  if (rank <= 3) return "صفقة رائعة";
  return "صفقة جيدة";
}

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
