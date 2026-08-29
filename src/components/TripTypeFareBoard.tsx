import { useMemo } from "react";
import { Link } from "react-router-dom";

import { buildRouteQuotesByTripType } from "../lib/routeQuotes";
import { formatPrice } from "../lib/utils";
import type { AirportRow, DealRow, RoutePriceReferenceRow } from "../types/database";

type Props = {
  deals: DealRow[];
  references: RoutePriceReferenceRow[];
  airports: AirportRow[];
};

/** Same Bloomberg-style ticker as FareBoard/DealTicker, but shows the one-way
 *  and round-trip prices for each route side by side (OW / RT badges) instead
 *  of a single blended "cheapest overall" price. Purely additive — does not
 *  replace FareBoard or DealTicker, which keep showing the single best price. */
export function TripTypeFareBoard({ deals, references, airports }: Props) {
  const quotes = useMemo(() => buildRouteQuotesByTripType(references, deals, airports), [references, deals, airports]);

  if (quotes.length === 0) return null;

  const row = (suffix: string) => (
    <div className="flex shrink-0 items-center gap-8 px-4">
      {quotes.map((q) => (
        <div key={q.key + suffix} className="flex shrink-0 items-center gap-3 whitespace-nowrap">
          <span className="font-latin text-xs font-bold text-white">
            {q.from} / {q.to}
          </span>
          {q.oneWayDeal && (
            <Link
              to={`/deals/${q.oneWayDeal.id}`}
              className="font-latin flex items-center gap-1 text-xs font-bold text-white transition hover:opacity-80"
            >
              <span className="rounded bg-white/15 px-1 py-0.5 text-[10px] font-extrabold text-[#F3A6A3]">OW</span>
              <span className="text-white/70">{formatPrice(q.oneWayDeal.price, q.oneWayDeal.currency ?? "USD")}</span>
            </Link>
          )}
          {q.roundTripDeal && (
            <Link
              to={`/deals/${q.roundTripDeal.id}`}
              className="font-latin flex items-center gap-1 text-xs font-bold text-white transition hover:opacity-80"
            >
              <span className="rounded bg-white/15 px-1 py-0.5 text-[10px] font-extrabold text-[#F3A6A3]">RT</span>
              <span className="text-white/70">
                {formatPrice(q.roundTripDeal.price, q.roundTripDeal.currency ?? "USD")}
              </span>
            </Link>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div dir="ltr" className="ticker-viewport flex items-center overflow-hidden bg-[#0F172A]">
      <div className="flex shrink-0 items-center gap-1.5 bg-[#0C7BB3] px-4 py-2.5 text-xs font-extrabold text-white">
        <span className="animate-pulse" aria-hidden>
          ●
        </span>
        OW / RT BOARD
      </div>
      <div className="ticker-track flex py-2.5">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}
