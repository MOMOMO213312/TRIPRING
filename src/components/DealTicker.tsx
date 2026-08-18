import { useMemo } from "react";
import { Link } from "react-router-dom";

import { buildRouteQuotes } from "../lib/routeQuotes";
import type { AirportRow, DealRow, RoutePriceReferenceRow } from "../types/database";

type Props = {
  deals: DealRow[];
  references: RoutePriceReferenceRow[];
  airports: AirportRow[];
};

/** Same ticker look as FareBoard, but each item is a direct link to its deal page —
 *  like tapping a flight card — instead of opening a details dialog. */
export function DealTicker({ deals, references, airports }: Props) {
  const quotes = useMemo(() => buildRouteQuotes(references, deals, airports), [references, deals, airports]);
  const withLiveDeal = quotes.filter((q) => q.bestDeal);

  if (withLiveDeal.length === 0) return null;

  const row = (suffix: string) => (
    <div className="flex shrink-0 items-center gap-8 px-4">
      {withLiveDeal.map((q) => (
        <Link
          key={q.key + suffix}
          to={`/deals/${q.bestDeal!.id}`}
          className="font-latin flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-gray-800 transition hover:text-[#EA580C]"
        >
          {q.from} / {q.to}
          <span className="text-gray-500">${q.bestDeal!.price}</span>
        </Link>
      ))}
    </div>
  );

  return (
    <div dir="ltr" className="ticker-viewport mt-4 flex items-center overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex shrink-0 items-center gap-1.5 self-stretch bg-[#0F172A] px-4 py-2.5 text-xs font-extrabold text-white">
        <span className="animate-pulse text-orange-400" aria-hidden>
          ●
        </span>
        LIVE DEALS
      </div>
      <div className="ticker-track flex py-2.5">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}
