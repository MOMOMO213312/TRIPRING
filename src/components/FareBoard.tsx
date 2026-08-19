import { useMemo } from "react";
import { Link } from "react-router-dom";

import { buildRouteQuotesByTripType } from "../lib/routeQuotes";
import type { AirportRow, DealRow, RoutePriceReferenceRow } from "../types/database";

type TripType = "one-way" | "round-trip";

type Props = {
  deals: DealRow[];
  references: RoutePriceReferenceRow[];
  airports: AirportRow[];
  tripType: TripType;
};

const VARIANT: Record<
  TripType,
  { labelBg: string; caption: string; pick: (q: ReturnType<typeof buildRouteQuotesByTripType>[number]) => DealRow | null }
> = {
  "one-way": {
    labelBg: "bg-sky",
    caption: "ذهاب فقط · ONE-WAY",
    pick: (q) => q.oneWayDeal ?? null,
  },
  "round-trip": {
    labelBg: "bg-primary",
    caption: "ذهاب وعودة · ROUND-TRIP",
    pick: (q) => q.roundTripDeal ?? null,
  },
};

/** Single ticker component for both trip types. A route only appears when a
 *  live deal of that trip type (one-way: return_date === null, round-trip:
 *  return_date set) backs it, and clicking always goes straight to that exact
 *  deal — so the price shown here always matches the price on the page it
 *  links to. Rendered twice (once per tripType) so a customer can tell at a
 *  glance which board their trip belongs in, instead of hunting for an OW/RT
 *  badge inside a single mixed ticker. */
export function FareBoard({ deals, references, airports, tripType }: Props) {
  const variant = VARIANT[tripType];

  const quotes = useMemo(() => {
    const all = buildRouteQuotesByTripType(references, deals, airports);
    return all
      .map((q) => ({ q, deal: variant.pick(q) }))
      .filter((entry): entry is { q: (typeof all)[number]; deal: DealRow } => entry.deal !== null);
  }, [references, deals, airports, variant]);

  if (quotes.length === 0) return null;

  const row = (suffix: string) => (
    <div className="flex shrink-0 items-center gap-10 px-6">
      {quotes.map(({ q, deal }) => (
        <Link
          key={q.key + suffix}
          to={`/deals/${deal.id}`}
          className="font-latin flex shrink-0 items-center gap-2 whitespace-nowrap text-xs font-bold text-white transition hover:opacity-80"
        >
          {q.from} / {q.to}
          <span className="text-white/70">${deal.price}</span>
        </Link>
      ))}
    </div>
  );

  return (
    <div
      dir="ltr"
      className="ticker-viewport relative isolate flex h-10 w-full items-stretch overflow-hidden bg-navy sm:h-11"
    >
      <div
        className={`relative z-10 flex shrink-0 items-center gap-1.5 whitespace-nowrap border-e border-white/10 ${variant.labelBg} px-4 py-2.5 text-xs font-extrabold leading-none text-white`}
      >
        <span className="animate-pulse" aria-hidden>
          ●
        </span>
        {variant.caption}
      </div>
      <div className="ticker-track relative z-0 flex min-w-0 flex-1 items-center overflow-hidden py-2.5 leading-none">
        {row("a")}
        {row("b")}
      </div>
    </div>
  );
}
