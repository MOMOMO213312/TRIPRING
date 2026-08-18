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

export type RouteQuoteByTripType = {
  key: string;
  from: string;
  to: string;
  fromCity: string;
  toCity: string;
  /** Cheapest live one-way deal on this route (return_date is null), if any. */
  oneWayDeal: DealRow | null;
  /** Cheapest live round-trip deal on this route (return_date is set), if any. */
  roundTripDeal: DealRow | null;
};

/**
 * Same idea as buildRouteQuotes, but splits the live deals on each route into
 * one-way (return_date === null) vs round-trip (return_date set) and returns
 * the cheapest of each — so a route can surface an OW price, an RT price, or
 * both, independently. Routes with neither are dropped, same as buildRouteQuotes.
 */
export function buildRouteQuotesByTripType(
  references: RoutePriceReferenceRow[],
  deals: DealRow[],
  airports: AirportRow[],
): RouteQuoteByTripType[] {
  return references
    .map((ref) => {
      const routeDeals = deals.filter(
        (d) => d.from_airport === ref.from_airport && d.to_airport === ref.to_airport,
      );

      const oneWayDeals = routeDeals.filter((d) => !d.return_date).sort((a, b) => a.price - b.price);
      const roundTripDeals = routeDeals.filter((d) => d.return_date).sort((a, b) => a.price - b.price);

      return {
        key: ref.id,
        from: ref.from_airport,
        to: ref.to_airport,
        fromCity: airportLabel(ref.from_airport, airports),
        toCity: airportLabel(ref.to_airport, airports),
        oneWayDeal: oneWayDeals[0] ?? null,
        roundTripDeal: roundTripDeals[0] ?? null,
      };
    })
    .filter((q) => q.oneWayDeal || q.roundTripDeal);
}
