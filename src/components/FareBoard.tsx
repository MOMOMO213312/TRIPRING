import { useMemo } from "react";
import { Link } from "react-router-dom";

import { buildRouteQuotes } from "../lib/routeQuotes";
import type { AirportRow, DealRow, RoutePriceReferenceRow } from "../types/database";

type Props = {
  deals: DealRow[];
  references: RoutePriceReferenceRow[];
  airports: AirportRow[];
};

/** Bloomberg-style ticker: one quote per route. Price is shown only when a real
 *  live deal backs it — clicking goes straight to that deal page, so the price
 *  in the ticker always matches the price on the page it links to. Routes with
 *  no live deal yet show just the route name and link to search results. */
export function FareBoard({ deals, references, airports }: Props) {
  const quotes = useMemo(() => buildRouteQuotes(references, deals, airports), [references, deals, airports]);

  if (quotes.length === 0) return null;

  const row = (suffix: string) => (
    <div className="flex shrink-0 items-center gap-8 px-4">
      {quotes.map((q) => (
        <Link
          key={q.key + suffix}
          to={q.bestDeal ? `/deals/${q.bestDeal.id}` : `/search?to=${q.to}`}
          className="font-latin flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-white transition hover:opacity-80"
        >
          {q.from} / {q.to}
          {q.bestDeal && <span className="text-white/70">${q.bestDeal.price}</span>}
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
        FARE BOARD
      </div>
      <div className="ticker-track flex py-2.5">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}
