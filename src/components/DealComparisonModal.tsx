import { Fragment } from "react";
import { Link } from "react-router-dom";

import {
  airlineName,
  formatRouteCities,
  stopsMetaLabel,
} from "../lib/deal-utils";
import { cn, formatPrice } from "../lib/utils";
import type { Catalog } from "../hooks/useCatalog";
import type { DealRow } from "../types/database";
import { Button } from "./ui/Button";

type Props = {
  open: boolean;
  onClose: () => void;
  deals: DealRow[];
  catalog: Catalog;
  onRemove: (dealId: string) => void;
};

/** One comparison row: a label plus a per-deal cell renderer. */
type Row = {
  label: string;
  cell: (deal: DealRow) => React.ReactNode;
  /** Highlights the cell(s) holding the best value in the row, when there's a clear winner. */
  bestDealId?: (deals: DealRow[]) => string | null;
};

function durationLabel(deal: DealRow): string {
  const minutes = deal.flight_duration_minutes ?? (deal.duration_hours ? deal.duration_hours * 60 : null);
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} س ${m} د` : `${h} ساعة`;
}

export function DealComparisonModal({ open, onClose, deals, catalog, onRemove }: Props) {
  if (!open || deals.length === 0) return null;

  const rows: Row[] = [
    {
      label: "السعر",
      cell: (d) => (
        <span className="font-latin text-lg font-extrabold text-[#0C7BB3]">
          {formatPrice(d.price, d.currency ?? "USD")}
        </span>
      ),
      bestDealId: (ds) => ds.reduce((min, d) => (d.price < min.price ? d : min)).id,
    },
    {
      label: "شركة الطيران",
      cell: (d) => <span className="text-sm text-slate-700">{airlineName(d.airline_code, catalog.airlines)}</span>,
    },
    {
      label: "التوقف",
      cell: (d) => <span className="text-sm text-slate-700">{stopsMetaLabel(d.stops)}</span>,
      bestDealId: (ds) => ds.find((d) => d.stops === "direct")?.id ?? null,
    },
    {
      label: "مدة الرحلة",
      cell: (d) => <span className="text-sm text-slate-700">{durationLabel(d)}</span>,
    },
    {
      label: "الأمتعة",
      cell: (d) => <span className="text-sm text-slate-700">{d.baggage_kg ? `${d.baggage_kg} كجم` : "—"}</span>,
    },
    {
      label: "قابلة للاسترداد",
      cell: (d) =>
        d.refundable == null ? (
          <span className="text-slate-400">—</span>
        ) : d.refundable ? (
          <span className="font-semibold text-[#16A34A]">✓ نعم</span>
        ) : (
          <span className="text-slate-500">✕ لا</span>
        ),
      bestDealId: (ds) => ds.find((d) => d.refundable === true)?.id ?? null,
    },
    {
      label: "المقاعد المتاحة",
      cell: (d) => <span className="text-sm text-slate-700">{d.available_seats}</span>,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 className="font-bold text-slate-900">مقارنة العروض</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        <div className="overflow-auto p-4">
          <div
            className="grid min-w-[560px] gap-x-4"
            style={{ gridTemplateColumns: `120px repeat(${deals.length}, 1fr)` }}
          >
            {/* Header row: route + remove button per deal */}
            <div />
            {deals.map((d) => (
              <div key={d.id} className="space-y-1.5 border-b border-slate-100 pb-3 text-center">
                <button
                  type="button"
                  onClick={() => onRemove(d.id)}
                  className="text-[11px] text-slate-400 hover:text-red-500"
                >
                  إزالة ✕
                </button>
                <p className="font-bold text-slate-900">{formatRouteCities(d, catalog.airports)}</p>
              </div>
            ))}

            {rows.map((row) => {
              const bestId = row.bestDealId?.(deals) ?? null;
              return (
                <Fragment key={row.label}>
                  <div className="flex items-center border-b border-slate-50 py-3 text-xs font-medium text-slate-500">
                    {row.label}
                  </div>
                  {deals.map((d) => (
                    <div
                      key={`${row.label}-${d.id}`}
                      className={cn(
                        "flex items-center justify-center border-b border-slate-50 py-3 text-center",
                        bestId === d.id && "rounded-lg bg-[#F0FDF4]",
                      )}
                    >
                      {row.cell(d)}
                    </div>
                  ))}
                </Fragment>
              );
            })}

            <div />
            {deals.map((d) => (
              <div key={`${d.id}-cta`} className="pt-3">
                <Link to={`/deals/${d.id}`}>
                  <Button fullWidth variant="outline" className="text-sm">
                    عرض التفاصيل
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
