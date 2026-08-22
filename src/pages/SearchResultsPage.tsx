import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { DealImageWrapper } from "../components/DealImageWrapper";
import { FilterPanel } from "../components/FilterPanel";
import { Select } from "../components/ui/Select";
import { Card } from "../components/ui/Card";
import { fetchActiveDeals } from "../lib/api";
import type { TripType } from "../lib/api";
import { airportLabel, dealTripScope } from "../lib/deal-utils";
import type { TripScope } from "../lib/deal-utils";
import { airlinesInDeals, applyAdvancedFilters, countActiveFilters, EMPTY_FILTERS } from "../lib/filters";
import type { AdvancedFilters } from "../lib/filters";
import { useCatalog } from "../hooks/useCatalog";
import type { DealRow } from "../types/database";

const BUDGET_CHIPS = [100, 200, 300, 500, 700, 1000];
type SortKey = "price_asc" | "price_desc";

export function SearchResultsPage() {
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
  const [sort, setSort] = useState<SortKey>("price_asc");
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchActiveDeals({
      from: from || undefined,
      to: effectiveTo || undefined,
      departureDate: date || undefined,
      maxPrice: budget && budget !== "1000plus" ? Number(budget) : undefined,
      sort,
      availableOnly: true,
      tripType,
    })
      .then(setDeals)
      .catch((e) => setError(e instanceof Error ? e.message : "خطأ"))
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

  if (catalog.loading) return <p className="text-slate-500">جاري التحميل...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {scope === "domestic" ? "رحلات داخلية" : scope === "international" ? "رحلات دولية" : "أفضل الفرص"} من {airportLabel(from, catalog.airports)}
        </h1>
        <p className="mt-1 text-slate-600">
          {to ? `→ ${airportLabel(effectiveTo || to, catalog.airports)}` : "كل الوجهات"}
          {date ? ` · ${date}` : ""}
          {tripType === "one_way" ? " · ذهاب فقط" : tripType === "round_trip" && returnDate ? ` · عودة ${returnDate}` : ""}
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
            label="ترتيب حسب"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            options={[
              { value: "price_asc", label: "السعر: الأقل أولاً" },
              { value: "price_desc", label: "السعر: الأعلى أولاً" },
            ]}
            className="max-w-xs"
          />
          <span className="text-sm text-slate-500">{filtered.length} فرصة</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileFiltersOpen(true)}
          className="smart-chip lg:hidden"
        >
          🔧 الفلاتر {activeFilterCount ? `(${activeFilterCount})` : ""}
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
              <p className="text-slate-700">لا توجد فرص مطابقة لاختياراتك الحالية.</p>
              <p className="text-sm text-slate-500">جرّب زيادة الميزانية، تواريخ مرنة، أو إزالة بعض الفلاتر.</p>
              <button
                type="button"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="cta-primary mx-auto px-5 py-2 text-sm"
              >
                إعادة تعيين الفلاتر
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
