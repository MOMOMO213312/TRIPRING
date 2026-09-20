import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { DealImageWrapper } from "../components/DealImageWrapper";
import { FilterPanel } from "../components/FilterPanel";
import { Select } from "../components/ui/Select";
import { Card } from "../components/ui/Card";
import { fetchActiveDeals } from "../lib/api";
import type { OfferDealRow, TripType } from "../lib/api";
import { airportLabel, dealTripScope } from "../lib/deal-utils";
import type { TripScope } from "../lib/deal-utils";
import { airlinesInDeals, applyAdvancedFilters, countActiveFilters, EMPTY_FILTERS } from "../lib/filters";
import type { AdvancedFilters } from "../lib/filters";
import { friendlyErrorMessage } from "../lib/errors";
import { useCatalog } from "../hooks/useCatalog";

const BUDGET_CHIPS = [100, 200, 300, 500, 700, 1000];
type SortKey = "price_asc" | "price_desc" | "best_match";

export function SearchResultsPage() {
  const { t } = useTranslation("search");
  const [params, setParams] = useSearchParams();
  const catalog = useCatalog();
  const from = params.get("from") ?? "CAI";
  const to = params.get("to") ?? "";
  const effectiveTo = to === "any" ? "" : to;
  const date = params.get("date") ?? "";
  const returnDate = params.get("returnDate") ?? "";
  const tripType = (params.get("tripType") as TripType | null) ?? "round_trip";
  const budget = params.get("budget") ?? "";
  const scope = params.get("scope") as TripScope | null;
  const stopsParam = params.get("stops");
  const sortParam = params.get("sort");
  const initialSort: SortKey =
    sortParam === "price_desc" || sortParam === "best_match" ? sortParam : "price_asc";
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [deals, setDeals] = useState<OfferDealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Picks up ?stops=direct|one_stop|multi_stop coming from SmartFilterChips
  // on the homepage (previously read from the URL and then silently
  // ignored — the chip navigated here but nothing consumed the param).
  const [filters, setFilters] = useState<AdvancedFilters>(() =>
    stopsParam && ["direct", "one_stop", "multi_stop"].includes(stopsParam)
      ? { ...EMPTY_FILTERS, stops: [stopsParam as AdvancedFilters["stops"][number]] }
      : EMPTY_FILTERS
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchActiveDeals({
      from: from || undefined,
      to: effectiveTo || undefined,
      departureDate: date || undefined,
      // Budget chips are labelled in USD ($300…), so they filter on the deals' USD-equivalent price.
      maxPriceUsd: budget && budget !== "1000plus" ? Number(budget) : undefined,
      sort,
      availableOnly: true,
      tripType,
    })
      .then(setDeals)
      .catch((e) => setError(friendlyErrorMessage(e, "search:results.loadFailed", "SearchResultsPage.load")))
      .finally(() => setLoading(false));
  }, [from, effectiveTo, date, budget, sort, tripType]);

  const filtered = useMemo(() => {
    let result = applyAdvancedFilters(deals, filters);
    if (scope) {
      result = result.filter((deal) => dealTripScope(deal, catalog.airports) === scope);
    }
    return result;
  }, [deals, filters, scope, catalog.airports]);

  const availableAirlines = useMemo(() => airlinesInDeals(deals, catalog.airlines), [deals, catalog.airlines]);
  const activeFilterCount = countActiveFilters(filters);

  if (catalog.loading) return <p className="text-slate-500">{t("loading")}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {t("results.heading", {
            scope: t(`results.scope.${scope === "domestic" || scope === "international" ? scope : "best"}`),
            airport: airportLabel(from, catalog.airports),
          })}
        </h1>
        <p className="mt-1 text-slate-600">
          {to ? `→ ${airportLabel(effectiveTo || to, catalog.airports)}` : t("results.allDestinations")}
          {date ? ` · ${date}` : ""}
          {tripType === "one_way" ? ` · ${t("results.oneWay")}` : tripType === "round_trip" && returnDate ? ` · ${t("results.returnOn", { date: returnDate })}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {BUDGET_CHIPS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => setParams((prev) => { const p = new URLSearchParams(prev); p.set("budget", String(amount)); return p; })}
            className={`smart-chip font-latin ${budget === String(amount) ? "smart-chip-active" : ""}`}
          >
            ${amount}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            label={t("sort.label")}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            options={[
              { value: "best_match", label: t("sort.bestMatch") },
              { value: "price_asc", label: t("sort.priceAsc") },
              { value: "price_desc", label: t("sort.priceDesc") },
            ]}
            className="max-w-xs"
          />
          <span className="text-sm text-slate-500">{t("results.count", { count: filtered.length })}</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="smart-chip lg:hidden"
        >
          {t("results.filtersButton")} {activeFilterCount ? `(${activeFilterCount})` : ""}
        </button>
      </div>

      <div className="flex items-start gap-6">
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          availableAirlines={availableAirlines}
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
        />

        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-pulse h-[360px]" />
              ))}
            </div>
          ) : error ? (
            <Card className="text-red-600">{error}</Card>
          ) : filtered.length === 0 ? (
            <Card className="space-y-3 text-center">
              <p className="text-slate-700">{t("results.empty.title")}</p>
              <p className="text-sm text-slate-500">{t("results.empty.hint")}</p>
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="cta-primary mx-auto px-5 py-2 text-sm"
              >
                {t("results.empty.reset")}
              </button>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((deal) => (
                <DealImageWrapper key={deal.id} deal={deal} catalog={catalog} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
