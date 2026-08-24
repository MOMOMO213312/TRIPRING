import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { TripGoCard } from "../components/TripGoCard";
import { Card } from "../components/ui/Card";
import { useCatalog } from "../hooks/useCatalog";
import { fetchActiveDeals, fetchAdditionalServices } from "../lib/api";
import { friendlyErrorMessage } from "../lib/errors";
import { airportLabel } from "../lib/deal-utils";
import type { AdditionalServiceRow, DealRow } from "../types/database";

export function TripGoResultsPage() {
  const [params] = useSearchParams();
  const catalog = useCatalog();
  const from = params.get("from") ?? "CAI";
  const to = params.get("to") ?? "";
  const date = params.get("date") ?? "";
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [services, setServices] = useState<AdditionalServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchActiveDeals({
        from: from || undefined,
        to: to || undefined,
        departureDate: date || undefined,
        sort: "price_asc",
        availableOnly: true,
      }),
      fetchAdditionalServices(),
    ])
      .then(([d, s]) => {
        setDeals(d);
        setServices(s);
      })
      .catch((e) => setError(friendlyErrorMessage(e, "حصل خطأ في تحميل النتائج، جرّب تاني.", "TripGoResultsPage.load")))
      .finally(() => setLoading(false));
  }, [from, to, date]);

  if (catalog.loading) return <p className="text-slate-500">جاري التحميل...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          🚐 نتائج TripGo
        </h1>
        <p className="mt-1 text-slate-600">
          {airportLabel(from, catalog.airports)}
          {to ? ` → ${airportLabel(to, catalog.airports)}` : " → كل الوجهات"}
          {date ? ` · ${date}` : ""}
          <span className="mx-1.5 text-slate-300">·</span>
          <span className="font-semibold text-[#16A34A]">كل رحلة تشمل النقل من وإلى المطار</span>
        </p>
      </div>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-pulse h-[420px]" />
          ))}
        </div>
      ) : error ? (
        <Card className="text-red-600">{error}</Card>
      ) : deals.length === 0 ? (
        <Card className="space-y-2 text-center">
          <p className="text-slate-700">لا توجد رحلات TripGo مطابقة لبحثك حالياً.</p>
          <Link to="/tripgo" className="text-sm font-semibold text-[#0C7BB3]">
            جرّب بحث تاني
          </Link>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {deals.map((deal) => (
            <TripGoCard key={deal.id} deal={deal} catalog={catalog} services={services} />
          ))}
        </div>
      )}
    </div>
  );
}
