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
  bestDeal: DealRow | null;
  liveDeals: DealRow[]; // all live deals on this route, cheapest first
};

/**
 * Combines the static route_price_reference table with the currently-live deals
 * (already fetched on the homepage — no extra Supabase round-trip) to produce one
 * quote per route. Only real, live deal prices are ever surfaced — no price is
 * shown unless it matches exactly what the customer will see on the page the
 * quote links to.
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

    return {
      key: ref.id,
      from: ref.from_airport,
      to: ref.to_airport,
      fromCity: airportLabel(ref.from_airport, airports),
      toCity: airportLabel(ref.to_airport, airports),
      flightType: ref.flight_type,
      notes: ref.notes,
      bestDeal,
      liveDeals,
    };
  });
}
