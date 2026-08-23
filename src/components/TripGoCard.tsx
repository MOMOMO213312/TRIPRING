import { Link } from "react-router-dom";

import { useDealImage } from "../hooks/useCatalog";
import type { Catalog } from "../hooks/useCatalog";
import { defaultTransfer, tripGoTotal } from "../lib/tripgo";
import {
  airlineName,
  airportLabel,
  baggageBadgeLabel,
  stopsMetaLabel,
} from "../lib/deal-utils";
import { formatDate, formatPrice, formatTime } from "../lib/utils";
import type { AdditionalServiceRow, DealRow } from "../types/database";

/**
 * The primary TripGo product card — deliberately built so the transfer is as
 * visually prominent as the flight itself, never a small "+ add-on" line.
 * Order: route → flight facts → Transfer Included block → total → CTA.
 */
export function TripGoCard({
  deal,
  catalog,
  services,
}: {
  deal: DealRow;
  catalog: Catalog;
  services: AdditionalServiceRow[];
}) {
  const imageUrl = useDealImage(deal.to_airport, catalog, deal.id);
  const transfer = defaultTransfer(services);
  const currency = deal.currency ?? "USD";
  const total = tripGoTotal(deal.price, transfer?.price ?? 0);

  return (
    <Link
      to={`/tripgo/${deal.id}`}
      className="tripgo-card-lift group block overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="relative h-36 w-full overflow-hidden sm:h-40">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={airportLabel(deal.to_airport, catalog.airports)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#0F172A] to-[#1E3A8A] text-white">
            <span className="text-3xl">✈️</span>
          </div>
        )}
        <span className="absolute start-3 top-3 flex items-center gap-1 rounded-full bg-gradient-to-r from-[#0C7BB3] to-[#1E3A8A] px-2.5 py-1 text-[11px] font-bold text-white shadow">
          🚐 TripGo
        </span>
      </div>

      <div className="p-4 sm:p-5">
        {/* Route */}
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {airportLabel(deal.from_airport, catalog.airports).split(" (")[0]} →{" "}
          {airportLabel(deal.to_airport, catalog.airports).split(" (")[0]}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="font-latin text-xl font-extrabold text-slate-900">{deal.from_airport}</span>
          <span aria-hidden className="text-slate-300">
            →
          </span>
          <span className="font-latin text-xl font-extrabold text-slate-900">{deal.to_airport}</span>
        </div>

        {/* Flight facts */}
        <div className="mt-3 flex items-center justify-between">
          <span className="font-latin text-sm font-bold text-slate-800">{formatTime(deal.departure_time)}</span>
          <span aria-hidden className="mx-2 h-px flex-1 bg-slate-200" />
          <span className="font-latin text-sm font-bold text-slate-800">{formatTime(deal.arrival_time)}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {airlineName(deal.airline_code, catalog.airlines)}
          <span className="mx-1.5 text-slate-300">·</span>
          {stopsMetaLabel(deal.stops)}
          {deal.duration_hours ? (
            <>
              <span className="mx-1.5 text-slate-300">·</span>
              {deal.duration_hours}س
            </>
          ) : null}
          {baggageBadgeLabel(deal) ? (
            <>
              <span className="mx-1.5 text-slate-300">·</span>🧳 {baggageBadgeLabel(deal)}
            </>
          ) : null}
        </p>
        <p className="mt-1 text-[11px] text-slate-400">{formatDate(deal.departure_date)}</p>

        {/* Transfer Included — the core of the TripGo product, not an add-on */}
        <div className="mt-4 rounded-2xl border border-[#16A34A]/25 bg-[#F0FDF4] p-3">
          <p className="flex items-center gap-1.5 text-sm font-extrabold text-[#16A34A]">
            <span aria-hidden>✓</span> Airport Transfer Included
          </p>
          <div className="mt-1.5 space-y-1 text-xs text-slate-700">
            <p className="flex items-center gap-1.5">
              <span aria-hidden>🚐</span> Pickup → Airport
            </p>
            <p className="flex items-center gap-1.5">
              <span aria-hidden>🚐</span> Airport → Destination
            </p>
          </div>
        </div>

        {/* Price */}
        <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-4">
          <div>
            <p className="font-latin text-2xl font-extrabold text-[#0C7BB3]">{formatPrice(total, currency)}</p>
            <p className="text-[11px] font-semibold text-slate-500">Flight + Transfer / للمسافر</p>
          </div>
          <span className="rounded-xl bg-[#0F172A] px-4 py-2.5 text-sm font-bold text-white transition group-hover:bg-[#1E3A8A]">
            احجز TripGo
          </span>
        </div>
      </div>
    </Link>
  );
}
