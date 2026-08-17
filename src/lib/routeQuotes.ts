import { airportLabel } from "./deal-utils";
import type { AirportRow, DealRow, RoutePriceReferenceRow } from "../types/database";

export type RouteQuote = {
  key: string;
  from: string;
  to: string;
  fromCity: string;
  toCity: string;
  flightType: string | null;
  notes: string | null;
  minPrice: number;
  maxPrice: number;
  market: number;
  bestDeal: DealRow | null;
  liveDeals: DealRow[]; // all live deals on this route, cheapest first
  changePercent: number | null; // null when there's no live deal (shown as "MKT")
};

/**
 * Combines the static route_price_reference table with the currently-live deals
 * (already fetched on the homepage — no extra Supabase round-trip) to produce one
 * quote per route, each compared against its market average.
 */
export function buildRouteQuotes(
  references: RoutePriceReferenceRow[],
  deals: DealRow[],
  airports: AirportRow[],
): RouteQuote[] {
  return references.map((ref) => {
    const liveDeals = deals
      .filter((d) => d.from_airport === ref.from_airport && d.to_airport === ref.to_airport)
      .sort((a, b) => a.price - b.price);

    const bestDeal = liveDeals[0] ?? null;
    const market = (ref.min_price_usd + ref.max_price_usd) / 2;
    const changePercent = bestDeal ? Math.round(((bestDeal.price - market) / market) * 100) : null;

    return {
      key: ref.id,
      from: ref.from_airport,
      to: ref.to_airport,
      fromCity: airportLabel(ref.from_airport, airports),
      toCity: airportLabel(ref.to_airport, airports),
      flightType: ref.flight_type,
      notes: ref.notes,
      minPrice: ref.min_price_usd,
      maxPrice: ref.max_price_usd,
      market,
      bestDeal,
      liveDeals,
      changePercent,
    };
  });
}
