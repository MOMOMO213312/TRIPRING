import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Modal } from "./ui/Modal";
import { buildRouteQuotes } from "../lib/routeQuotes";
import type { RouteQuote } from "../lib/routeQuotes";
import type { AirportRow, DealRow, RoutePriceReferenceRow } from "../types/database";

type Props = {
  deals: DealRow[];
  references: RoutePriceReferenceRow[];
  airports: AirportRow[];
};

/** Bloomberg-style ticker: one quote per route, live price vs market reference — click any item for details. */
export function FareBoard({ deals, references, airports }: Props) {
  const [active, setActive] = useState<RouteQuote | null>(null);
  const quotes = useMemo(() => buildRouteQuotes(references, deals, airports), [references, deals, airports]);

  if (quotes.length === 0) return null;

  const row = (suffix: string) => (
    <div className="flex shrink-0 items-center gap-8 px-4">
      {quotes.map((q) => (
        <button
          key={q.key + suffix}
          type="button"
          onClick={() => setActive(q)}
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
        </button>
      ))}
    </div>
  );

  return (
    <>
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

      <RouteDetailDialog quote={active} onClose={() => setActive(null)} />
    </>
  );
}

function RouteDetailDialog({ quote, onClose }: { quote: RouteQuote | null; onClose: () => void }) {
  return (
    <Modal open={!!quote} onClose={onClose} title={quote ? `${quote.fromCity} → ${quote.toCity}` : undefined}>
      {quote ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">سعر السوق المرجعي</p>
              <p className="font-latin mt-1 font-bold text-gray-800">
                ${quote.minPrice}–${quote.maxPrice}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">أفضل سعر حي الآن</p>
              <p className="font-latin mt-1 font-bold text-gray-800">
                {quote.bestDeal ? `$${quote.bestDeal.price}` : "لا يوجد عرض حالياً"}
              </p>
            </div>
          </div>

          {quote.changePercent != null ? (
            <p
              className={`rounded-lg px-3 py-2 text-center text-sm font-semibold ${
                quote.changePercent < 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {quote.changePercent < 0
                ? `أرخص من متوسط السوق بـ ${Math.abs(quote.changePercent)}%`
                : `أغلى من متوسط السوق بـ ${quote.changePercent}%`}
            </p>
          ) : null}

          {quote.liveDeals.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-bold text-gray-800">أرخص العروض الحية</p>
              <div className="space-y-2">
                {quote.liveDeals.slice(0, 3).map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <span className="font-latin font-bold text-gray-800">${d.price}</span>
                    <Link to={`/deals/${d.id}`} className="cta-primary px-3 py-1.5 text-xs">
                      عرض
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <Link
            to={`/search?to=${quote.to}`}
            onClick={onClose}
            className="block w-full rounded-xl border border-gray-200 py-2.5 text-center text-sm font-semibold text-gray-700 transition hover:border-[#2563EB] hover:text-[#2563EB]"
          >
            كل عروض {quote.toCity}
          </Link>
        </div>
      ) : null}
    </Modal>
  );
}
