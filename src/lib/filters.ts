import type { AirlineRow, DealRow, StopType } from "../types/database";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export type DurationBucket = "short" | "medium" | "long";
export type TravelClassFilter = "economy" | "premium_economy" | "business" | "first";
export type DataStatus = "verified" | "needs_check" | "limited";

// Filters shown directly on the page: destination/date/budget are handled
// as their own page-level state (not here) because they hit the server
// query. Everything below is applied client-side to the fetched page.
export type AdvancedFilters = {
  stops: StopType[]; // empty = any — primary filter, kept here so FilterPanel/page share one shape
  minBaggage: number | null; // primary filter (23 / 32 / null)
  // "المزيد من الفلاتر"
  airlines: string[]; // empty = any
  departureTimes: TimeOfDay[];
  arrivalTimes: TimeOfDay[];
  durationBuckets: DurationBucket[];
  travelClasses: TravelClassFilter[];
  // حالة البيانات — multi-select, empty = show all
  dataStatus: DataStatus[];
};

export const EMPTY_FILTERS: AdvancedFilters = {
  stops: [],
  minBaggage: null,
  airlines: [],
  departureTimes: [],
  arrivalTimes: [],
  durationBuckets: [],
  travelClasses: [],
  dataStatus: [],
};

export function countActiveFilters(f: AdvancedFilters): number {
  let n = 0;
  if (f.stops.length) n++;
  if (f.minBaggage != null) n++;
  if (f.airlines.length) n++;
  if (f.departureTimes.length) n++;
  if (f.arrivalTimes.length) n++;
  if (f.durationBuckets.length) n++;
  if (f.travelClasses.length) n++;
  if (f.dataStatus.length) n++;
  return n;
}

/** Only counts the filters that live inside "المزيد من الفلاتر" (for the badge on that button). */
export function countAdvancedOnlyFilters(f: AdvancedFilters): number {
  let n = 0;
  if (f.airlines.length) n++;
  if (f.departureTimes.length) n++;
  if (f.arrivalTimes.length) n++;
  if (f.durationBuckets.length) n++;
  if (f.travelClasses.length) n++;
  return n;
}

function timeOfDay(time: string | null): TimeOfDay | null {
  if (!time) return null;
  const hour = Number.parseInt(time.slice(0, 2), 10);
  if (Number.isNaN(hour)) return null;
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 24) return "evening";
  return "night";
}

function durationBucket(deal: DealRow): DurationBucket | null {
  const minutes = deal.flight_duration_minutes ?? (deal.duration_hours ? deal.duration_hours * 60 : null);
  if (minutes == null) return null;
  if (minutes < 300) return "short"; // < 5h
  if (minutes <= 600) return "medium"; // 5-10h
  return "long"; // > 10h
}

function normalizedTravelClass(deal: DealRow): TravelClassFilter | null {
  const raw = (deal.travel_class ?? "").toLowerCase().replace(/\s|-/g, "_");
  if (!raw) return null;
  if (raw.includes("first")) return "first";
  if (raw.includes("business")) return "business";
  if (raw.includes("premium")) return "premium_economy";
  if (raw.includes("economy")) return "economy";
  return null;
}

/** Hours remaining until a deal's expires_at, or null if unparsable. */
export function hoursUntil(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(diffMs)) return null;
  return diffMs / 3600000;
}

/** Hours since this deal's price was last checked (real freshness signal — null when never checked, not guessed). */
export function hoursSinceChecked(deal: DealRow): number | null {
  if (!deal.price_checked_at) return null;
  const diffMs = Date.now() - new Date(deal.price_checked_at).getTime();
  if (Number.isNaN(diffMs)) return null;
  return diffMs / 3600000;
}

const VERIFIED_WITHIN_HOURS = 24;
const LIMITED_SEATS_THRESHOLD = 5;
const LIMITED_EXPIRES_WITHIN_HOURS = 24;

/** All "حالة البيانات" statuses that genuinely apply to this deal — a deal can be e.g. both "needs_check" and "limited". */
export function dataStatuses(deal: DealRow): DataStatus[] {
  const statuses: DataStatus[] = [];
  const hoursSince = hoursSinceChecked(deal);
  if (hoursSince != null && hoursSince <= VERIFIED_WITHIN_HOURS) statuses.push("verified");
  else statuses.push("needs_check");

  const hoursLeft = hoursUntil(deal.expires_at);
  const lowSeats = deal.available_seats > 0 && deal.available_seats <= LIMITED_SEATS_THRESHOLD;
  const expiringSoon = hoursLeft != null && hoursLeft >= 0 && hoursLeft <= LIMITED_EXPIRES_WITHIN_HOURS;
  if (lowSeats || expiringSoon) statuses.push("limited");

  return statuses;
}

export function applyAdvancedFilters(deals: DealRow[], filters: AdvancedFilters): DealRow[] {
  return deals.filter((deal) => {
    if (filters.stops.length && !filters.stops.includes(deal.stops)) return false;
    if (filters.minBaggage != null && (deal.baggage_kg ?? 0) < filters.minBaggage) return false;
    if (filters.airlines.length && !filters.airlines.includes(deal.airline_code ?? "")) return false;

    if (filters.departureTimes.length) {
      const bucket = timeOfDay(deal.departure_time);
      if (!bucket || !filters.departureTimes.includes(bucket)) return false;
    }
    if (filters.arrivalTimes.length) {
      const bucket = timeOfDay(deal.arrival_time);
      if (!bucket || !filters.arrivalTimes.includes(bucket)) return false;
    }
    if (filters.durationBuckets.length) {
      const bucket = durationBucket(deal);
      if (!bucket || !filters.durationBuckets.includes(bucket)) return false;
    }
    if (filters.travelClasses.length) {
      const cls = normalizedTravelClass(deal);
      if (!cls || !filters.travelClasses.includes(cls)) return false;
    }
    if (filters.dataStatus.length) {
      const statuses = dataStatuses(deal);
      if (!statuses.some((s) => filters.dataStatus.includes(s))) return false;
    }
    return true;
  });
}

/** Airline codes actually present in the current result set, for a dynamic filter list. */
export function airlinesInDeals(deals: DealRow[], airlines: AirlineRow[]): AirlineRow[] {
  const codes = new Set(deals.map((d) => d.airline_code).filter(Boolean) as string[]);
  return airlines.filter((a) => codes.has(a.code));
}
