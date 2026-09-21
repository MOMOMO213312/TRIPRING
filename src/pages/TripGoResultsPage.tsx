import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { TripGoCard } from "../components/TripGoCard";
import { Card } from "../components/ui/Card";
import { useCatalog } from "../hooks/useCatalog";
import { fetchActiveTripGoBundles } from "../lib/tripgo";
import { friendlyErrorMessage } from "../lib/errors";
import { airportLabel } from "../lib/deal-utils";
import type { TripGoBundleJoined } from "../types/database";

export function TripGoResultsPage() {
  const { t } = useTranslation("tripgo");
  const [params] = useSearchParams();
  const catalog = useCatalog();
  const from = params.get("from") ?? "CAI";
  const to = params.get("to") ?? "";
  const date = params.get("date") ?? "";
  const [bundles, setBundles] = useState<TripGoBundleJoined[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchActiveTripGoBundles({
      from: from || undefined,
      to: to || undefined,
      date: date || undefined,
    })
      .then(setBundles)
      .catch((e) => setError(friendlyErrorMessage(e, t("results.loadFailed"), "TripGoResultsPage.load")))
      .finally(() => setLoading(false));
  }, [from, to, date]);

  if (catalog.loading) return <p className="text-slate-500">{t("results.loading")}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">{t("results.title")}</h1>
        <p className="mt-1 text-slate-600">
          {airportLabel(from, catalog.airports)}
          {to ? ` → ${airportLabel(to, catalog.airports)}` : ` → ${t("results.allDestinations")}`}
          {date ? ` · ${date}` : ""}
          <span className="mx-1.5 text-slate-300">·</span>
          <span className="font-semibold text-slate-500">{t("results.oneWay")}</span>
          <span className="mx-1.5 text-slate-300">·</span>
          <span className="font-semibold text-[#16A34A]">{t("results.transferIncluded")}</span>
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
      ) : bundles.length === 0 ? (
        <Card className="space-y-2 text-center">
          <p className="text-slate-700">{t("results.empty")}</p>
          <Link to="/tripgo" className="text-sm font-semibold text-[#0C7BB3]">
            {t("results.tryAgain")}
          </Link>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {bundles.map((bundle) => (
            <TripGoCard key={bundle.id} bundle={bundle} catalog={catalog} />
          ))}
        </div>
      )}
    </div>
  );
}
