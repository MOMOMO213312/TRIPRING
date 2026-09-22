import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import {
  airlineName,
  formatRouteCities,
  stopsMetaLabel,
} from "../lib/deal-utils";
import { cn } from "../lib/utils";
import type { TFunction } from "i18next";

import type { Catalog } from "../hooks/useCatalog";
import type { DealRow } from "../types/database";
import { Button } from "./ui/Button";
import { useCurrency } from "../hooks/useCurrency";
import { comparablePrice } from "../lib/deal-utils";

type Props = {
  open: boolean;
  onClose: () => void;
  deals: DealRow[];
  catalog: Catalog;
  onRemove: (dealId: string) => void;
};

/** One comparison row: a label plus a per-deal cell renderer. */
type Row = {
  /** Stable id; the label is search:compare.row.<id>. */
  id: string;
  cell: (deal: DealRow) => React.ReactNode;
  /** Highlights the cell(s) holding the best value in the row, when there's a clear winner. */
  bestDealId?: (deals: DealRow[]) => string | null;
};

function durationLabel(deal: DealRow, t: TFunction): string {
  const minutes = deal.flight_duration_minutes ?? (deal.duration_hours ? deal.duration_hours * 60 : null);
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? t("compare.durationHM", { h, m }) : t("compare.durationH", { h });
}

export function DealComparisonModal({ open, onClose, deals, catalog, onRemove }: Props) {
  const { t } = useTranslation("search");
  const { fmt } = useCurrency();
  if (!open || deals.length === 0) return null;

  const rows: Row[] = [
    {
      id: "price",
      cell: (d) => (
        <span className="font-latin text-lg font-extrabold text-[#0C7BB3]">
          {fmt(d.price, d.currency ?? "USD")}
        </span>
      ),
      bestDealId: (ds) => ds.reduce((min, d) => (comparablePrice(d) < comparablePrice(min) ? d : min)).id,
    },
    {
      id: "airline",
      cell: (d) => <span className="text-sm text-slate-700">{airlineName(d.airline_code, catalog.airlines)}</span>,
    },
    {
      id: "stops",
      cell: (d) => <span className="text-sm text-slate-700">{stopsMetaLabel(d.stops)}</span>,
      bestDealId: (ds) => ds.find((d) => d.stops === "direct")?.id ?? null,
    },
    {
      id: "duration",
      cell: (d) => <span className="text-sm text-slate-700">{durationLabel(d, t)}</span>,
    },
    {
      id: "baggage",
      cell: (d) => <span className="text-sm text-slate-700">{d.baggage_kg ? t("deals:baggage.kg", { kg: d.baggage_kg }) : "—"}</span>,
    },
    {
      id: "refundable",
      cell: (d) =>
        d.refundable == null ? (
          <span className="text-slate-400">—</span>
        ) : d.refundable ? (
          <span className="font-semibold text-[#16A34A]">{t("compare.yes")}</span>
        ) : (
          <span className="text-slate-500">{t("compare.no")}</span>
        ),
      bestDealId: (ds) => ds.find((d) => d.refundable === true)?.id ?? null,
    },
    {
      id: "seats",
      cell: (d) => <span className="text-sm text-slate-700">{d.available_seats}</span>,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h2 className="font-bold text-slate-900">{t("compare.title")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={t("actions.close", { ns: "common" })}
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
                  {t("compare.remove")}
                </button>
                <p className="font-bold text-slate-900">{formatRouteCities(d, catalog.airports)}</p>
              </div>
            ))}

            {rows.map((row) => {
              const bestId = row.bestDealId?.(deals) ?? null;
              return (
                <Fragment key={row.id}>
                  <div className="flex items-center border-b border-slate-50 py-3 text-xs font-medium text-slate-500">
                    {t(`compare.row.${row.id}`)}
                  </div>
                  {deals.map((d) => (
                    <div
                      key={`${row.id}-${d.id}`}
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
                    {t("home:dealCard.viewDetails")}
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
