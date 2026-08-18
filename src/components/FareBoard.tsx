import { useMemo } from "react";
import { Link } from "react-router-dom";

import { buildRouteQuotes } from "../lib/routeQuotes";
import type { AirportRow, DealRow, RoutePriceReferenceRow } from "../types/database";

type Props = {
  deals: DealRow[];
  references: RoutePriceReferenceRow[];
  airports: AirportRow[];
};

/** Bloomberg-style ticker: one quote per route, live price vs market reference.
 *  Clicking a quote goes straight to its deal page (same destination as the
 *  LIVE DEALS ticker) — or to the route's search results when there's no
 *  live deal to link to yet. */
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
          <span className="text-white/70">${q.bestDeal ? q.bestDeal.price : q.minPrice}</span>
          {q.changePercent == null ? (
            <span className="text-white/50">— MKT</span>
          ) : q.changePercent < 0 ? (
            <span className="text-emerald-400">↓ {Math.abs(q.changePercent)}%</span>
          ) : (
            <span className="text-red-400">↑ {q.changePercent}%</span>
          )}
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
