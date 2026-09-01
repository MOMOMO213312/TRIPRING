import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { CardsSkeleton } from "../components/LoadingSkeleton";
import { EmptyState } from "../components/EmptyState";
import { fetchActiveDeals, getDestinationImage } from "../lib/api";
import { formatPrice } from "../lib/utils";
import { friendlyErrorMessage } from "../lib/errors";
import { useCatalog } from "../hooks/useCatalog";
import { usePageMeta } from "../hooks/usePageMeta";
import type { AirportRow, DealRow } from "../types/database";

type DestinationEntry = {
  airport: AirportRow;
  minPrice: number;
  currency: string;
  dealCount: number;
};

export function DestinationsPage() {
  const catalog = useCatalog();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageMeta(
    "أفضل وجهات السفر وأسعار الطيران — TripRing",
    "استكشف أفضل وجهات السفر المتاحة الآن على TripRing، مع أرخص أسعار الطيران الفعلية لكل وجهة.",
  );

  useEffect(() => {
    fetchActiveDeals({ sort: "price_asc", availableOnly: true })
      .then(setDeals)
      .catch((e) =>
        setError(friendlyErrorMessage(e, "حصل خطأ في تحميل الوجهات، جرّب تاني.", "DestinationsPage.loadDeals")),
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
          currency: deal.currency ?? "USD",
          dealCount: 1,
        });
      } else {
        existing.dealCount += 1;
        if (deal.price < existing.minPrice) {
          existing.minPrice = deal.price;
          existing.currency = deal.currency ?? "USD";
        }
      }
    }
    return [...byAirport.values()].sort((a, b) => a.minPrice - b.minPrice);
  }, [deals, catalog.airports]);

  const isLoading = loading || catalog.loading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">وجهات السفر</h1>
        <p className="mt-1 text-sm text-slate-600">
          {destinations.length > 0
            ? `${destinations.length} وجهة متاحة الآن بأسعار حقيقية من فرص TripRing الحية`
            : "تصفح كل الوجهات المتاحة حاليًا على TripRing بأسعار حقيقية ومحدثة"}
        </p>
      </div>

      {isLoading ? (
        <CardsSkeleton count={8} />
      ) : error ? (
        <EmptyState title="حصل خطأ" subtitle={error} />
      ) : destinations.length === 0 ? (
        <EmptyState title="لا توجد وجهات متاحة حاليًا" subtitle="جرّب تتابعنا لاحقًا، بنضيف فرص جديدة باستمرار." />
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
                    {airport.country} · {dealCount} فرصة متاحة
                  </p>
                  <p className="font-latin mt-1 text-lg font-extrabold text-white">
                    {formatPrice(minPrice, currency)}
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
