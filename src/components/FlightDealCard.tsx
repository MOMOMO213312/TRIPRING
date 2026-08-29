import { Link } from "react-router-dom";

import { useDealImage } from "../hooks/useCatalog";
import type { Catalog } from "../hooks/useCatalog";
import {
  airlineName,
  airportLabel,
  baggageBadgeLabel,
  dealTypeBadgeClass,
  dealTypeLabel,
  departureTimingLabel,
  isLowSeats,
  seatsLeftLabel,
  stopsMetaLabel,
} from "../lib/deal-utils";
import { formatPrice } from "../lib/utils";
import type { DealRow, DealType } from "../types/database";
import { DealCountdown } from "./DealCountdown";

// Homepage-only badge color override: dealTypeBadgeClass is shared with
// DealCard.tsx (used on /search and /deals, which stay on the blue theme),
// so "flash"/"special_fare" can't be recolored there without affecting
// those pages too. This card is only ever rendered on the homepage, so it
// swaps just those two to the homepage's orange accent.
const HOME_BADGE_OVERRIDE: Partial<Record<DealType, string>> = {
  flash: "bg-[#FF7A45]",
  special_fare: "bg-[#FF7A45]",
};

function homeBadgeClass(type: DealType): string {
  return HOME_BADGE_OVERRIDE[type] ?? dealTypeBadgeClass(type);
}

/**
 * Flight/deal card matching the reference layout exactly:
 * image (badge top-start, live countdown top-end) → route codes → cities →
 * date · stops → airline → price row (price, seats-left) at the bottom.
 */
export function FlightDealCard({ deal, catalog }: { deal: DealRow; catalog: Catalog }) {
  const imageUrl = useDealImage(deal.to_airport, catalog, deal.id);
  const lowSeats = isLowSeats(deal.available_seats);

  return (
    <Link
      to={`/deals/${deal.id}`}
      className="deal-card-lift group block w-[250px] shrink-0 overflow-hidden rounded-3xl border border-slate-200 bg-white sm:w-[280px]"
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
          className={`font-latin absolute start-2.5 top-2.5 rounded-md px-2 py-1 text-[11px] font-bold text-white shadow-sm ${homeBadgeClass(deal.deal_type)}`}
        >
          {dealTypeLabel(deal.deal_type)}
        </span>

        <div className="absolute end-2.5 top-2.5">
          <DealCountdown expiresAt={deal.expires_at} />
        </div>
      </div>

      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <span className="font-latin text-base font-extrabold text-slate-900">{deal.from_airport}</span>
          <span aria-hidden className="text-slate-300">
            →
          </span>
          <span className="font-latin text-base font-extrabold text-slate-900">{deal.to_airport}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {airportLabel(deal.from_airport, catalog.airports)} → {airportLabel(deal.to_airport, catalog.airports)}
        </p>

        <p className="mt-2 text-xs text-slate-600">
          {departureTimingLabel(deal.departure_date)}
          <span className="mx-1.5 text-slate-300">•</span>
          {stopsMetaLabel(deal.stops)}
        </p>

        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <span aria-hidden>✈️</span>
          {airlineName(deal.airline_code, catalog.airlines)}
        </p>

        {deal.refundable || baggageBadgeLabel(deal) ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {deal.refundable ? (
              <span className="rounded-full bg-[#F0FDF4] px-1.5 py-0.5 text-[10px] font-semibold text-[#16A34A]">
                قابلة للاسترداد
              </span>
            ) : null}
            {baggageBadgeLabel(deal) ? (
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-slate-500">
                <span aria-hidden>🧳</span>
                {baggageBadgeLabel(deal)}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex items-baseline gap-1.5">
            <span className="font-latin text-lg font-extrabold text-[#FF7A45]">
              {formatPrice(deal.price, deal.currency ?? "USD")}
            </span>
          </div>
          <span
            className={`shrink-0 text-[11px] font-semibold whitespace-nowrap ${lowSeats ? "text-red-600" : "text-slate-400"}`}
          >
            {seatsLeftLabel(deal.available_seats)}
          </span>
        </div>
      </div>
    </Link>
  );
}
