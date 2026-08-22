import type { AirlineRow, DealRow, DealType, StopType } from "../types/database";

export type AdvancedFilters = {
  stops: StopType[]; // empty = any
  airlines: string[]; // empty = any
  minBaggage: number | null; // 23 / 32 / null
  dealType: DealType | "any";
  expiresWithinHours: number | null; // 12 / 24 / 48 / null (any)
  refundableOnly: boolean;
  changeableOnly: boolean;
};

export const EMPTY_FILTERS: AdvancedFilters = {
  stops: [],
  airlines: [],
  minBaggage: null,
  dealType: "any",
  expiresWithinHours: null,
  refundableOnly: false,
  changeableOnly: false,
};

export function countActiveFilters(f: AdvancedFilters): number {
  let n = 0;
  if (f.stops.length) n++;
  if (f.airlines.length) n++;
  if (f.minBaggage != null) n++;
  if (f.dealType !== "any") n++;
  if (f.expiresWithinHours != null) n++;
  if (f.refundableOnly) n++;
  if (f.changeableOnly) n++;
  return n;
}

export function applyAdvancedFilters(deals: DealRow[], filters: AdvancedFilters): DealRow[] {
  return deals.filter((deal) => {
    if (filters.stops.length && !filters.stops.includes(deal.stops)) return false;
    if (filters.airlines.length && !filters.airlines.includes(deal.airline_code ?? "")) return false;
    if (filters.minBaggage != null && (deal.baggage_kg ?? 0) < filters.minBaggage) return false;
    if (filters.dealType !== "any" && deal.deal_type !== filters.dealType) return false;
    if (filters.refundableOnly && deal.refundable !== true) return false;
    if (filters.changeableOnly && deal.changeable !== true) return false;
    if (filters.expiresWithinHours != null) {
      const hoursLeft = hoursUntil(deal.expires_at);
      if (hoursLeft == null || hoursLeft < 0 || hoursLeft > filters.expiresWithinHours) return false;
    }
    return true;
  });
}

/** Airline codes actually present in the current result set, for a dynamic filter list. */
export function airlinesInDeals(deals: DealRow[], airlines: AirlineRow[]): AirlineRow[] {
  const codes = new Set(deals.map((d) => d.airline_code).filter(Boolean) as string[]);
  return airlines.filter((a) => codes.has(a.code));
}

/** Hours remaining until a deal's expires_at, or null if unparsable. */
export function hoursUntil(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(diffMs)) return null;
  return diffMs / 3600000;
}
