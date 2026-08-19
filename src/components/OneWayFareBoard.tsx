import { useMemo } from "react";
import { Link } from "react-router-dom";

import { buildRouteQuotesByTripType } from "../lib/routeQuotes";
import type { AirportRow, DealRow, RoutePriceReferenceRow } from "../types/database";

type Props = {
  deals: DealRow[];
  references: RoutePriceReferenceRow[];
  airports: AirportRow[];
};

/** Dedicated ticker for ONE-WAY fares only. A route only appears here when a
 *  live one-way deal (return_date === null) backs it, and clicking always
 *  goes straight to that exact deal — so the price shown here always matches
 *  the price on the page it links to. Sits next to RoundTripFareBoard so a
 *  customer can tell at a glance which board their trip type belongs in,
 *  instead of hunting for an OW/RT badge inside a single mixed ticker. */
export function OneWayFareBoard({ deals, references, airports }: Props) {
  const quotes = useMemo(
    () => buildRouteQuotesByTripType(references, deals, airports).filter((q) => q.oneWayDeal),
    [references, deals, airports],
  );

  if (quotes.length === 0) return null;

  const row = (suffix: string) => (
    <div className="flex shrink-0 items-center gap-10 px-6">
      {quotes.map((q) => (
        <Link
          key={q.key + suffix}
          to={`/deals/${q.oneWayDeal!.id}`}
          className="font-latin flex shrink-0 items-center gap-2 whitespace-nowrap text-xs font-bold text-white transition hover:opacity-80"
        >
          {q.from} / {q.to}
          <span className="text-white/70">${q.oneWayDeal!.price}</span>
        </Link>
      ))}
    </div>
  );

  return (
    <div dir="ltr" className="ticker-viewport flex items-stretch overflow-hidden bg-[#0F172A]">
      <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap border-e border-white/10 bg-[#0EA5E9] px-4 py-2.5 text-xs font-extrabold text-white">
        <span className="animate-pulse" aria-hidden>
          ●
        </span>
        ذهاب فقط · ONE-WAY
      </div>
      <div className="ticker-track flex items-center py-2.5">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}
