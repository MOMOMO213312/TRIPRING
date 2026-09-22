import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { EmptyState } from "../components/EmptyState";
import { LineSkeleton } from "../components/LoadingSkeleton";
import { fetchActiveDeals } from "../lib/api";
import { buildRouteQuotes } from "../lib/routeQuotes";

import { friendlyErrorMessage } from "../lib/errors";
import { useCatalog } from "../hooks/useCatalog";
import { usePageMeta } from "../hooks/usePageMeta";
import type { DealRow } from "../types/database";
import { useCurrency } from "../hooks/useCurrency";

export function RoutesPage() {
  const { t } = useTranslation("explore");
  const { fmt } = useCurrency();
  const catalog = useCatalog();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  usePageMeta(t("routes.meta.title"), t("routes.meta.description"));

  useEffect(() => {
    fetchActiveDeals({ sort: "price_asc", availableOnly: true })
      .then(setDeals)
      .catch((e) => setError(friendlyErrorMessage(e, "explore:routes.loadFailed", "RoutesPage.loadDeals")))
      .finally(() => setLoading(false));
  }, []);

  const quotes = useMemo(
    () => buildRouteQuotes(catalog.references, deals, catalog.airports).sort((a, b) => {
      const pa = a.bestDeal?.price ?? Infinity;
      const pb = b.bestDeal?.price ?? Infinity;
      return pa - pb;
    }),
    [catalog.references, deals, catalog.airports],
  );

  const isLoading = loading || catalog.loading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t("routes.title")}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {quotes.length > 0
            ? t("routes.subtitle.count", { count: quotes.length })
            : t("routes.subtitle.empty")}
        </p>
      </div>

      {isLoading ? (
        <LineSkeleton count={8} />
      ) : error ? (
        <EmptyState title={t("routes.errorTitle")} subtitle={error} />
      ) : quotes.length === 0 ? (
        <EmptyState title={t("routes.emptyTitle")} subtitle={t("routes.emptyHint")} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {quotes.map((route) => (
            <Link
              key={route.key}
              to={`/search?from=${route.from}&to=${route.to}`}
              className="opportunity-card-lift flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <span className="font-latin">{route.from}</span>
                  <span aria-hidden className="text-slate-300">
                    ✈
                  </span>
                  <span className="font-latin">{route.to}</span>
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {route.fromCity} → {route.toCity}
                </p>
                {route.flightType ? <p className="mt-1 text-[11px] text-slate-400">{route.flightType}</p> : null}
              </div>
              <div className="shrink-0 text-end">
                {route.bestDeal ? (
                  <>
                    <p className="text-[11px] text-slate-400">{t("routes.startsFrom")}</p>
                    <p className="font-latin text-lg font-extrabold text-[#0C7BB3]">
                      {fmt(route.bestDeal.price, route.bestDeal.currency ?? "USD")}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">{t("routes.noLiveDeal")}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
