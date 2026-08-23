import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { hoursUntil } from "../lib/filters";
import { formatPrice } from "../lib/utils";
import type { AirportRow, DealRow } from "../types/database";

/** Picks the best real "flash"-style deal to headline the hero corner card:
 *  prefers an actual discount (original_price > price) and, among those, the
 *  soonest expiring — falls back to the soonest-expiring active deal if none
 *  has a discount on file. Never fabricates a discount that isn't real. */
function pickFlashDeal(deals: DealRow[]): DealRow | null {
  const withDiscount = deals.filter((d) => d.original_price != null && d.original_price > d.price);
  const pool = withDiscount.length > 0 ? withDiscount : deals;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime())[0];
}

export function HeroFlashDealCard({ deals, airports }: { deals: DealRow[]; airports: AirportRow[] }) {
  const deal = useMemo(() => pickFlashDeal(deals), [deals]);
  const [hoursLeft, setHoursLeft] = useState<number | null>(() => (deal ? hoursUntil(deal.expires_at) : null));

  useEffect(() => {
    if (!deal) return;
    setHoursLeft(hoursUntil(deal.expires_at));
    const id = setInterval(() => setHoursLeft(hoursUntil(deal.expires_at)), 1000);
    return () => clearInterval(id);
  }, [deal]);

  if (!deal) return null;

  const totalSeconds = hoursLeft != null && hoursLeft > 0 ? Math.floor(hoursLeft * 3600) : 0;
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");

  const fromCity = airports.find((a) => a.code === deal.from_airport)?.city ?? deal.from_airport;
  const toCity = airports.find((a) => a.code === deal.to_airport)?.city ?? deal.to_airport;
  const discountPct =
    deal.original_price && deal.original_price > deal.price
      ? Math.round((1 - deal.price / deal.original_price) * 100)
      : null;

  return (
    <div className="w-[240px] rounded-2xl bg-[#0F172A]/95 p-4 text-white shadow-2xl backdrop-blur-sm sm:w-[260px]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-bold text-[#FF7A45]">
          <span aria-hidden>🔥</span> عرض سريع
        </span>
        {totalSeconds > 0 ? (
          <div dir="ltr" className="font-latin flex items-center gap-0.5 text-[11px] font-bold text-white/90">
            <TimeBox value={h} />:<TimeBox value={m} />:<TimeBox value={s} />
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm font-extrabold">
        <span className="font-latin">{deal.from_airport}</span>
        <span aria-hidden className="text-white/40">
          →
        </span>
        <span className="font-latin">{deal.to_airport}</span>
      </div>
      <p className="mt-0.5 flex items-center justify-between text-[11px] text-white/60">
        <span>{fromCity}</span>
        <span>{toCity}</span>
      </p>

      <div className="mt-3 flex items-end justify-between border-t border-white/10 pt-3">
        <div>
          <p className="text-[10px] text-white/50">يبدأ من</p>
          <p className="font-latin text-xl font-extrabold text-white">{formatPrice(deal.price, deal.currency ?? "USD")}</p>
        </div>
        {discountPct ? (
          <span className="rounded-full bg-[#FF7A45]/20 px-2 py-1 text-[11px] font-bold text-[#FF7A45]">
            خصم {discountPct}%
          </span>
        ) : null}
      </div>

      <Link
        to={`/deals/${deal.id}`}
        className="mt-3 block w-full rounded-xl bg-[#FF7A45] py-2.5 text-center text-sm font-bold text-white transition hover:bg-[#F0642F]"
      >
        احجز الآن
      </Link>
    </div>
  );
}

function TimeBox({ value }: { value: string }) {
  return <span className="rounded bg-white/10 px-1.5 py-0.5">{value}</span>;
}
