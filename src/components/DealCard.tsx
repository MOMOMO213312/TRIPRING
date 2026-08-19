import { Link } from "react-router-dom";

import { getAgencyWhatsApp, getTypicalPrice } from "../lib/api";
import {
  airlineName,
  departureTimingLabel,
  formatRouteCities,
  rankBadgeStyle,
  rankQualityLabel,
  savingsPercent,
  seatsLeftLabel,
  stopsMetaLabel,
} from "../lib/deal-utils";
import { cn, formatPrice, whatsAppLink, WhatsAppIcon } from "../lib/utils";
import type { AgencyRow, AirlineRow, AirportRow, DealRow, RoutePriceReferenceRow } from "../types/database";
import { DealBadge } from "./DealBadge";
import { DealScoreRing } from "./DealScoreRing";
import { Button } from "./ui/Button";

type Props = {
  deal: DealRow;
  airports: AirportRow[];
  airlines: AirlineRow[];
  agencies: AgencyRow[];
  references: RoutePriceReferenceRow[];
  imageUrl?: string | null;
  rank?: number;
  compact?: boolean;
};

export function DealCard({
  deal,
  airports,
  airlines,
  agencies,
  references,
  imageUrl,
  rank,
  compact,
}: Props) {
  const typical = getTypicalPrice(deal, references);
  const savings = savingsPercent(deal.price, typical);
  const airline = airlines.find((a) => a.code === deal.airline_code);
  const toAirport = airports.find((a) => a.code === deal.to_airport);
  const agency = agencies.find((a) => a.id === deal.agency_id);
  const waPhone = getAgencyWhatsApp(deal, agencies);
  const waMessage = `مرحباً، أريد حجز العرض: ${formatRouteCities(deal, airports)} — ${deal.price} ${deal.currency ?? "USD"}`;
  const rankStyle = rank ? rankBadgeStyle(rank) : null;

  return (
    <article
      className={cn(
        "deal-card-lift relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white",
        compact && "min-w-[320px] shrink-0",
      )}
    >
      <div className={cn("relative bg-slate-100", compact ? "h-[110px]" : "h-[160px]")}>
        {rank && rankStyle ? (
          <div className="absolute start-3 top-3 z-10 flex items-center gap-2">
            <span
              className="font-latin flex size-7 items-center justify-center rounded-full text-xs font-bold shadow-sm"
              style={{ backgroundColor: rankStyle.bg, color: rankStyle.text }}
            >
              {rank}
            </span>
            <span className="rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-slate-800 shadow-sm backdrop-blur-sm">
              {rankQualityLabel(rank)}
            </span>
          </div>
        ) : null}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={toAirport?.city ?? deal.to_airport}
            className="h-full w-full rounded-t-xl object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-t-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
            <span className="text-4xl">✈</span>
          </div>
        )}
      </div>

      <div className={cn("flex flex-1 flex-col gap-3", compact ? "p-3" : "p-4")}>
        <div>
          <h3 className="text-lg font-bold text-slate-900">{formatRouteCities(deal, airports)}</h3>
          <div className="mt-2 flex items-center gap-2">
            {airline?.logo_url ? (
              <img src={airline.logo_url} alt="" className="size-6 rounded object-contain" />
            ) : (
              <span className="font-latin flex size-6 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-600">
                {deal.airline_code ?? "—"}
              </span>
            )}
            <span className="text-sm font-medium text-slate-700">
              {airlineName(deal.airline_code, airlines)}
            </span>
            {agency?.is_active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FFEDE5] px-2 py-0.5 text-[11px] font-semibold text-[#FF6B35]">
                <VerifiedIcon className="size-3" />
                موثّق
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-latin text-2xl font-extrabold text-[#FF6B35]">
              {formatPrice(deal.price, deal.currency ?? "USD")}
            </p>
            {typical && typical > deal.price ? (
              <p className="font-latin mt-0.5 text-sm text-slate-400 line-through">
                Typical {formatPrice(typical, deal.currency ?? "USD")}
              </p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {savings ? (
                <DealBadge tone="savings" icon="📉">
                  وفّر {savings}%
                </DealBadge>
              ) : null}
              {deal.stops === "direct" ? <DealBadge tone="good" icon="✈️">مباشرة</DealBadge> : null}
            </div>
          </div>
          {deal.deal_score != null ? <DealScoreRing score={deal.deal_score} showLabel /> : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="size-3.5" />
            {departureTimingLabel(deal.departure_date)}
          </span>
          <span className="inline-flex items-center gap-1">
            <PlaneIcon className="size-3.5" />
            {stopsMetaLabel(deal.stops)}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1",
              deal.available_seats > 0 && deal.available_seats <= 5 && "font-semibold text-amber-700",
            )}
          >
            <SeatIcon className="size-3.5" />
            {seatsLeftLabel(deal.available_seats)}
          </span>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          {deal.available_seats > 0 ? (
            <Link to={`/book/${deal.id}`}>
              <Button fullWidth variant="primary">
                احجز الآن
              </Button>
            </Link>
          ) : (
            <Button fullWidth variant="primary" disabled>
              نفدت المقاعد
            </Button>
          )}
          <a href={whatsAppLink(waPhone, waMessage)} target="_blank" rel="noreferrer">
            <Button fullWidth variant="outline" className="gap-2 border-slate-300 text-slate-800">
              <WhatsAppIcon className="size-4 text-[#25D366]" />
              احجز عبر واتساب
            </Button>
          </a>
        </div>
      </div>
    </article>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function PlaneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function SeatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function VerifiedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 1l2.39 1.34L15 2l.61 2.66L18 6l-1.34 2.39L18 10l-1.34 2.61L18 14l-2.61.61L15 18l-2.61-.61L10 19l-2.39-1.61L5 18l-.61-3.39L2 14l1.34-2.39L2 10l1.34-2.61L2 6l2.39-.34L5 2l2.61 1.34L10 1z"
        clipRule="evenodd"
      />
      <path d="M8.5 13.5l-2-2 1-1 1 1 3.5-3.5 1 1z" fill="white" />
    </svg>
  );
}
