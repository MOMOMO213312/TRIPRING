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
    <div className="flex shrink-0 items-center gap-10 px-6">
      {quotes.map((q) => (
        <Link
          key={q.key + suffix}
          to={`/deals/${q.roundTripDeal!.id}`}
          className="font-latin flex shrink-0 flex-col items-start gap-0.5 whitespace-nowrap leading-none transition hover:opacity-70"
        >
          <span className="text-xs font-bold text-white">
            {q.from} / {q.to}
          </span>
          <span className="text-sm font-extrabold text-white">${q.roundTripDeal!.price}</span>
        </Link>
      ))}
    </div>
  );

  return (
    <div
      dir="ltr"
      className="ticker-viewport relative isolate flex h-12 w-full items-stretch overflow-hidden bg-gradient-to-r from-[#E8940A] to-[#B5680A] sm:h-14"
    >
      <div className="relative z-10 flex shrink-0 items-center gap-2 whitespace-nowrap border-e border-white/30 bg-[#A85A08] px-4 py-2.5 text-xs font-extrabold leading-none text-white">
        <span aria-hidden className="text-base">
          ↔️
        </span>
        ذهاب وعودة · ROUND-TRIP
      </div>
      <div className="ticker-track relative z-0 flex min-w-0 flex-1 items-center overflow-hidden py-2 leading-none">
        {row("a")}
        {row("b")}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-14 z-10 w-8 bg-gradient-to-r from-[#E8940A] to-transparent sm:left-16" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#B5680A] to-transparent" />
    </div>
  );
}
