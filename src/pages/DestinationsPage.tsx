import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { CardsSkeleton } from "../components/LoadingSkeleton";
import { EmptyState } from "../components/EmptyState";
import { fetchActiveDeals, getDestinationImage } from "../lib/api";

import { friendlyErrorMessage } from "../lib/errors";
import { useCatalog } from "../hooks/useCatalog";
import { usePageMeta } from "../hooks/usePageMeta";
import type { AirportRow, DealRow } from "../types/database";
import { useCurrency } from "../hooks/useCurrency";
import { comparablePrice } from "../lib/deal-utils";

type DestinationEntry = {
  airport: AirportRow;
  minPrice: number;
  /** USD-equivalent of minPrice — what "cheapest" is decided on when deals are in different currencies. */
  minComparable: number;
  currency: string;
  dealCount: number;
};

export function DestinationsPage() {
  const { t } = useTranslation("explore");
  const { fmt } = useCurrency();
  const catalog = useCatalog();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageMeta(t("destinations.meta.title"), t("destinations.meta.description"));

  useEffect(() => {
    fetchActiveDeals({ sort: "price_asc", availableOnly: true })
      .then(setDeals)
      .catch((e) =>
        setError(friendlyErrorMessage(e, "explore:destinations.loadFailed", "DestinationsPage.loadDeals")),
      )
      .finally(() => setLoading(false));
  }, []);

  const destinations = useMemo(() => {
    const byAirport = new Map<string, DestinationEntry>();
    for (const deal of deals) {
      const airport = catalog.airports.find((a) => a.code === deal.to_airport);
      if (!airport) continue;
      const existing = byAirport.get(airport.code);
      if (!existing) {
        byAirport.set(airport.code, {
          airport,
          minPrice: deal.price,
          minComparable: comparablePrice(deal),
          currency: deal.currency ?? "USD",
          dealCount: 1,
        });
      } else {
        existing.dealCount += 1;
        if (comparablePrice(deal) < existing.minComparable) {
          existing.minPrice = deal.price;
          existing.minComparable = comparablePrice(deal);
          existing.currency = deal.currency ?? "USD";
        }
      }
    }
    return [...byAirport.values()].sort((a, b) => a.minComparable - b.minComparable);
  }, [deals, catalog.airports]);

  const isLoading = loading || catalog.loading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("destinations.title")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {destinations.length > 0
            ? t("destinations.subtitle.count", { count: destinations.length })
            : t("destinations.subtitle.empty")}
        </p>
      </div>

      {isLoading ? (
        <CardsSkeleton count={8} />
      ) : error ? (
        <EmptyState title={t("destinations.errorTitle")} subtitle={error} />
      ) : destinations.length === 0 ? (
        <EmptyState title={t("destinations.emptyTitle")} subtitle={t("destinations.emptyHint")} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {destinations.map(({ airport, minPrice, currency, dealCount }) => {
            const image = getDestinationImage(airport, catalog.imageCache, airport.code);
            return (
              <Link
                key={airport.code}
                to={`/search?to=${airport.code}`}
                className="opportunity-card-lift group relative block h-[220px] w-full overflow-hidden rounded-xl sm:h-[260px]"
              >
                {image ? (
                  <img
                    src={image}
                    alt={airport.city}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    draggable={false}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 text-slate-400">
                    <span className="text-4xl">✈</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute bottom-0 start-0 end-0 p-3">
                  <p className="text-base font-bold text-white">{airport.city}</p>
                  <p className="mt-0.5 text-xs text-white/70">
                    {airport.country} · {t("destinations.dealCount", { count: dealCount })}
                  </p>
                  <p className="font-latin mt-1 text-lg font-extrabold text-white">
                    {fmt(minPrice, currency)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
