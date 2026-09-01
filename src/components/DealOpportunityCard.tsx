import { useNavigate } from "react-router-dom";

import { getAgencyWhatsApp } from "../lib/api";
import {
  airlineName,
  baggageBadgeLabel,
  dealTypeBadgeClass,
  dealTypeLabel,
  departureTimingLabel,
  formatRouteCities,
  seatsLeftLabel,
  stopsMetaLabel,
} from "../lib/deal-utils";
import { cn, formatPrice, whatsAppLink, WhatsAppIcon } from "../lib/utils";
import type { AgencyRow, AirlineRow, AirportRow, DealRow } from "../types/database";
import { DealCountdown } from "./DealCountdown";
import { DealScoreRing } from "./DealScoreRing";
import { Button } from "./ui/Button";

type Props = {
  deal: DealRow;
  airports: AirportRow[];
  airlines: AirlineRow[];
  agencies: AgencyRow[];
  imageUrl?: string | null;
  /** Real price-drop within the last 7 days, from deal_price_history — undefined/null when there's none on file. */
  priceDrop?: { percent: number; amount: number } | null;
  comparing?: boolean;
  onToggleCompare?: (dealId: string) => void;
};

export function DealOpportunityCard({
  deal,
  airports,
  airlines,
  agencies,
  imageUrl,
  priceDrop,
  comparing,
  onToggleCompare,
}: Props) {
  const airline = airlines.find((a) => a.code === deal.airline_code);
  const toAirport = airports.find((a) => a.code === deal.to_airport);
  const agency = agencies.find((a) => a.id === deal.agency_id);
  const waPhone = getAgencyWhatsApp(deal, agencies);
  const waMessage = `مرحباً، أريد حجز العرض: ${formatRouteCities(deal, airports)} — ${deal.price} ${deal.currency ?? "USD"}`;
  const hasScore = deal.deal_score != null;
  const navigate = useNavigate();

  return (
    <article
      onClick={() => navigate(`/deals/${deal.id}`)}
      className="opportunity-card-lift relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <div className="relative h-[150px] w-full bg-slate-100">
        <div className="absolute start-3 top-3 z-10">
          <span
            className={cn(
              "font-latin rounded-md px-2 py-1 text-[11px] font-bold text-white shadow-sm",
              dealTypeBadgeClass(deal.deal_type),
            )}
          >
            {dealTypeLabel(deal.deal_type)}
          </span>
        </div>
        <div className="absolute end-3 top-3 z-10 flex flex-col items-end gap-1.5">
          {onToggleCompare ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleCompare(deal.id);
              }}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur-sm transition",
                comparing ? "bg-[#0C7BB3] text-white" : "bg-white/95 text-slate-700 hover:bg-white",
              )}
            >
              {comparing ? "✓ في المقارنة" : "قارن"}
            </button>
          ) : null}
          <DealCountdown expiresAt={deal.expires_at} />
        </div>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={toAirport?.city ?? deal.to_airport}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400">
            <span className="text-4xl">✈</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-latin text-lg font-extrabold text-slate-900">{deal.from_airport}</span>
            <span aria-hidden className="text-slate-300">
              ✈
            </span>
            <span className="font-latin text-lg font-extrabold text-slate-900">{deal.to_airport}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">{formatRouteCities(deal, airports)}</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          {airline?.logo_url ? (
            <img src={airline.logo_url} alt="" className="size-5 rounded object-contain" />
          ) : (
            <span className="font-latin flex size-5 items-center justify-center rounded bg-slate-100 text-[9px] font-bold text-slate-600">
              {deal.airline_code ?? "—"}
            </span>
          )}
          <span className="font-medium">{airlineName(deal.airline_code, airlines)}</span>
          {agency?.is_active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E5F4FB] px-1.5 py-0.5 text-[10px] font-semibold text-[#0C7BB3]">
              موثّق
            </span>
          ) : null}
        </div>

        <p className="text-xs text-slate-500">
          {departureTimingLabel(deal.departure_date)}
          <span className="mx-1.5 text-slate-300">•</span>
          {stopsMetaLabel(deal.stops)}
        </p>

        {/* Score ring + price sit side by side as the card's focal row —
            the ring only renders when deal_score is actually set (most of
            the current catalog doesn't have one yet), so the row collapses
            to just the price rather than showing an empty/fake ring. */}
        <div className="mt-1 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="min-w-0">
            <p className="font-latin text-xl font-extrabold text-[#0C7BB3]">
              {formatPrice(deal.price, deal.currency ?? "USD")}
            </p>
            {priceDrop ? (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#16A34A]">
                <span aria-hidden>↓</span>
                انخفض {priceDrop.percent}% خلال آخر 7 أيام
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-slate-400">
                {seatsLeftLabel(deal.available_seats)}
              </p>
            )}
          </div>
          {hasScore ? <DealScoreRing score={deal.deal_score as number} /> : null}
        </div>

        {deal.refundable || baggageBadgeLabel(deal) ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {deal.refundable ? (
              <span className="rounded-full bg-[#F0FDF4] px-1.5 py-0.5 text-[10px] font-semibold text-[#16A34A]">
                قابلة للاسترداد
              </span>
            ) : null}
            {baggageBadgeLabel(deal) ? (
              <span className="text-[10px] font-medium text-slate-500">🧳 {baggageBadgeLabel(deal)}</span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 pt-1">
          {deal.available_seats <= 0 ? (
            <Button fullWidth variant="primary" disabled onClick={(e) => e.stopPropagation()}>
              نفدت المقاعد
            </Button>
          ) : null}
          <a
            href={whatsAppLink(waPhone, waMessage)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
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
