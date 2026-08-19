import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useDealImage } from "../hooks/useCatalog";
import type { Catalog } from "../hooks/useCatalog";
import { getTypicalPrice } from "../lib/api";
import {
  airlineName,
  airportLabel,
  dealTypeLabel,
  departureTimingLabel,
  isLowSeats,
  savingsPercent,
  seatsLeftLabel,
  stopsMetaLabel,
} from "../lib/deal-utils";
import { hoursUntil } from "../lib/filters";
import type { DealRow, DealType } from "../types/database";

/** Badge color per deal type — mirrors the "Flash Deal / Hot Deal / Last Minute /
 *  Best Value" ribbon colors in the reference design. */
const TYPE_BADGE_STYLE: Record<DealType, string> = {
  flash: "bg-[#DB2F2B]",
  last_minute: "bg-[#0F172A]",
  empty_seat: "bg-[#9F1246]",
  special_fare: "bg-[#299FD1]",
};

/**
 * Flight/deal card matching the reference layout exactly:
 * image (badge top-start, live countdown top-end) → route codes → cities →
 * date · stops → airline → price row (price, strikethrough, savings badge,
 * seats-left) at the bottom.
 */
export function FlightDealCard({ deal, catalog }: { deal: DealRow; catalog: Catalog }) {
  const imageUrl = useDealImage(deal.to_airport, catalog, deal.id);
  const typical = getTypicalPrice(deal, catalog.references);
  const strikePrice = deal.original_price ?? typical;
  const savings = savingsPercent(deal.price, strikePrice);
  const lowSeats = isLowSeats(deal.available_seats);

  return (
    <Link
      to={`/deals/${deal.id}`}
      className="deal-card-lift group block w-[250px] shrink-0 overflow-hidden rounded-3xl border border-gray-200 bg-white sm:w-[280px]"
    >
      <div className="relative h-[130px] w-full overflow-hidden sm:h-[145px]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={airportLabel(deal.to_airport, catalog.airports)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-slate-400">
            <span className="text-3xl">✈</span>
          </div>
        )}

        <span
          className={`font-latin absolute start-2.5 top-2.5 rounded-md px-2 py-1 text-[11px] font-bold text-white shadow-sm ${TYPE_BADGE_STYLE[deal.deal_type]}`}
        >
          {dealTypeLabel(deal.deal_type)}
        </span>

        <CardCountdown expiresAt={deal.expires_at} />
      </div>

      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <span className="font-latin text-base font-extrabold text-gray-900">{deal.from_airport}</span>
          <span aria-hidden className="text-gray-300">
            →
          </span>
          <span className="font-latin text-base font-extrabold text-gray-900">{deal.to_airport}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-gray-500">
          {airportLabel(deal.from_airport, catalog.airports)} → {airportLabel(deal.to_airport, catalog.airports)}
        </p>

        <p className="mt-2 text-xs text-gray-600">
          {departureTimingLabel(deal.departure_date)}
          <span className="mx-1.5 text-gray-300">•</span>
          {stopsMetaLabel(deal.stops)}
        </p>

        <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
          <span aria-hidden>✈️</span>
          {airlineName(deal.airline_code, catalog.airlines)}
        </p>

        <div className="mt-3 flex items-end justify-between gap-2 border-t border-gray-100 pt-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-latin text-lg font-extrabold text-gray-900">${deal.price}</span>
            {strikePrice ? (
              <span className="font-latin text-xs text-gray-400 line-through">${strikePrice}</span>
            ) : null}
            {savings ? (
              <span className="font-latin rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-bold text-green-600">
                -{savings}%
              </span>
            ) : null}
          </div>
          <span
            className={`shrink-0 text-[11px] font-semibold whitespace-nowrap ${lowSeats ? "text-red-600" : "text-gray-400"}`}
          >
            {seatsLeftLabel(deal.available_seats)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function CardCountdown({ expiresAt }: { expiresAt: string }) {
  const [hoursLeft, setHoursLeft] = useState(() => hoursUntil(expiresAt));

  useEffect(() => {
    setHoursLeft(hoursUntil(expiresAt));
    const id = setInterval(() => setHoursLeft(hoursUntil(expiresAt)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const label = useMemo(() => {
    if (hoursLeft == null || hoursLeft <= 0) return null;
    const totalSeconds = Math.floor(hoursLeft * 3600);
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [hoursLeft]);

  if (!label) return null;

  return (
    <span
      dir="ltr"
      className="font-latin absolute end-2.5 top-2.5 flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-1 text-[10px] font-bold text-gray-800 shadow-sm backdrop-blur-sm"
    >
      <span aria-hidden>⏱</span>
      {label}
    </span>
  );
}
