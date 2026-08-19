import { useMemo } from "react";
import { Link } from "react-router-dom";

import { buildRouteQuotesByTripType } from "../lib/routeQuotes";
import type { AirportRow, DealRow, RoutePriceReferenceRow } from "../types/database";

type Props = {
  deals: DealRow[];
  references: RoutePriceReferenceRow[];
  airports: AirportRow[];
};

/** Dedicated ticker for ROUND-TRIP fares only. A route only appears here when
 *  a live round-trip deal (return_date set) backs it, and clicking always
 *  goes straight to that exact deal. Sibling of OneWayFareBoard — together
 *  they replace the old single mixed OW/RT ticker with two clearly labeled
 *  boards, so a customer going CAI→RUH one-way finds it in the one-way board
 *  and a customer going CAI→RUH round-trip finds it in this one. */
export function RoundTripFareBoard({ deals, references, airports }: Props) {
  const quotes = useMemo(
    () => buildRouteQuotesByTripType(references, deals, airports).filter((q) => q.roundTripDeal),
    [references, deals, airports],
  );

  if (quotes.length === 0) return null;

  const row = (suffix: string) => (
    <div className="flex shrink-0 items-center gap-8 px-4">
      {quotes.map((q) => (
        <Link
          key={q.key + suffix}
          to={`/deals/${q.roundTripDeal!.id}`}
          className="font-latin flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-white transition hover:opacity-80"
        >
          {q.from} / {q.to}
          <span className="text-white/70">${q.roundTripDeal!.price}</span>
        </Link>
      ))}
    </div>
  );

  return (
    <div dir="ltr" className="ticker-viewport flex items-center overflow-hidden bg-[#0f172a]">
      <div className="flex shrink-0 items-center gap-1.5 bg-[#EA580C] px-4 py-2.5 text-xs font-extrabold text-white">
        <span className="animate-pulse" aria-hidden>
          ●
        </span>
        ذهاب وعودة · ROUND-TRIP
      </div>
      <div className="ticker-track flex py-2.5">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}
