import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { DealComparisonModal } from "../components/DealComparisonModal";
import { DealImageWrapper } from "../components/DealImageWrapper";
import { FilterPanel } from "../components/FilterPanel";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { fetchActiveDealsPage } from "../lib/api";
import { airlinesInDeals, applyAdvancedFilters, countActiveFilters, EMPTY_FILTERS } from "../lib/filters";
import type { AdvancedFilters } from "../lib/filters";
import { friendlyErrorMessage } from "../lib/errors";
import { useCatalog } from "../hooks/useCatalog";
import { findRegion, regionAirportCodes, REGIONS } from "../lib/regions";
import type { DealRow, DealType } from "../types/database";

const BUDGET_CHIPS = [100, 200, 300, 500, 700, 1000];
const VALID_DEAL_TYPES: DealType[] = ["flash", "last_minute", "empty_seat", "special_fare"];
const PAGE_SIZE = 30;
type SortKey = "price_asc" | "price_desc";

export function DealsCenterPage() {
  const catalog = useCatalog();
  const [searchParams] = useSearchParams();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("price_asc");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [budget, setBudget] = useState<number | null>(null);
  // Destination entry point (see UX spec: each pick — region, then budget,
  // then stop-type — reshapes the page into a narrower curated view instead
  // of behaving like a traditional filter sidebar).
  const [regionKey, setRegionKey] = useState<string | null>(null);
  const selectedRegion = findRegion(regionKey);
  // Deep-link support: /deals?dealType=last_minute (used by the homepage
  // "Last-Minute Opportunities" section's "عرض الكل" button) pre-applies
  // the same dealType filter FilterPanel already knows how to render/clear.
  const [filters, setFilters] = useState<AdvancedFilters>(() => {
    const urlDealType = searchParams.get("dealType");
    const dealType = VALID_DEAL_TYPES.includes(urlDealType as DealType) ? (urlDealType as DealType) : "any";
    return { ...EMPTY_FILTERS, dealType };
  });
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const MAX_COMPARE = 3;

  const toAirportCodes = useMemo(
    () => (selectedRegion ? regionAirportCodes(selectedRegion, catalog.airports) : []),
    [selectedRegion, catalog.airports],
  );
  const isDirectOnly = filters.stops.length === 1 && filters.stops[0] === "direct";

  function selectRegion(key: string) {
    setRegionKey((prev) => (prev === key ? null : key));
    setTo(""); // region and a specific "to" airport shouldn't fight each other
  }

  // Dynamic headline: each entry-point pick (destination → budget →
  // stop-type) narrows the same title instead of the page jumping to a
  // separate "search results" look.
  const heading = useMemo(() => {
    if (!selectedRegion) return { title: "مركز الفرص", subtitle: "تصفّح كل الفرص النشطة مع فلاتر حقيقية" };
    const parts = [`أفضل ${isDirectOnly ? "الرحلات المباشرة" : "فرص"} ${selectedRegion.label}`];
    if (budget != null) parts.push(`تحت $${budget}`);
    return { title: parts.join(" "), subtitle: `فرص مختارة على وجهات ${selectedRegion.label}` };
  }, [selectedRegion, budget, isDirectOnly]);

  function toggleCompare(dealId: string) {
    setCompareIds((prev) => {
      if (prev.includes(dealId)) return prev.filter((id) => id !== dealId);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, dealId];
    });
  }

  // Base filters (from/to/budget/sort) hit the server and reset back to
  // page 0 — each combination is its own result set, fetched fresh so the
  // "X من Y" count and the deals shown always match what's actually being
  // asked for instead of stacking pages from a previous filter combo.
  useEffect(() => {
    setLoading(true);
    setPage(0);
    fetchActiveDealsPage({
      sort,
      from: from || undefined,
      to: to || undefined,
      toAirports: toAirportCodes.length ? toAirportCodes : undefined,
      maxPrice: budget ?? undefined,
      availableOnly: true,
      page: 0,
      pageSize: PAGE_SIZE,
    })
      .then(({ deals: rows, total: count }) => {
        setDeals(rows);
        setTotal(count);
      })
      .catch((e) => setError(friendlyErrorMessage(e, "حصل خطأ في تحميل العروض، جرّب تاني.", "DealsCenterPage.load")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, from, to, budget, regionKey, toAirportCodes]);

  function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    fetchActiveDealsPage({
      sort,
      from: from || undefined,
      to: to || undefined,
      toAirports: toAirportCodes.length ? toAirportCodes : undefined,
      maxPrice: budget ?? undefined,
      availableOnly: true,
      page: nextPage,
      pageSize: PAGE_SIZE,
    })
      .then(({ deals: rows, total: count }) => {
        setDeals((prev) => [...prev, ...rows]);
        setTotal(count);
        setPage(nextPage);
      })
      .catch((e) => setError(friendlyErrorMessage(e, "حصل خطأ في تحميل العروض، جرّب تاني.", "DealsCenterPage.load")))
      .finally(() => setLoadingMore(false));
  }

  const filtered = useMemo(() => applyAdvancedFilters(deals, filters), [deals, filters]);

  const availableAirlines = useMemo(() => airlinesInDeals(deals, catalog.airlines), [deals, catalog.airlines]);
  const activeFilterCount = countActiveFilters(filters);

  if (catalog.loading) return <p className="text-slate-500">جاري التحميل...</p>;

  const airportOptions = [
    { value: "", label: "الكل" },
    ...catalog.airports.map((a) => ({ value: a.code, label: `${a.city} (${a.code})` })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{heading.title}</h1>
        <p className="text-slate-600">{heading.subtitle}</p>
      </div>

      {selectedRegion || budget != null || isDirectOnly ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">اخترت:</span>
          {selectedRegion ? (
            <button
              type="button"
              onClick={() => selectRegion(selectedRegion.key)}
              className="smart-chip smart-chip-active"
            >
              {selectedRegion.emoji} {selectedRegion.label} ✕
            </button>
          ) : null}
          {budget != null ? (
            <button type="button" onClick={() => setBudget(null)} className="smart-chip smart-chip-active font-latin">
              أقل من ${budget} ✕
            </button>
          ) : null}
          {isDirectOnly ? (
            <button
              type="button"
              onClick={() => setFilters((f) => ({ ...f, stops: [] }))}
              className="smart-chip smart-chip-active"
            >
              ✈️ مباشر ✕
            </button>
          ) : null}
        </div>
      ) : null}

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <span aria-hidden>🧭</span> الوجهات
        </p>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((region) => (
            <button
              key={region.key}
              type="button"
              onClick={() => selectRegion(region.key)}
              className={`smart-chip ${regionKey === region.key ? "smart-chip-active" : ""}`}
            >
              {region.emoji} {region.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <span aria-hidden>✨</span> إيه الأهم بالنسبالك؟
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSort("price_asc")}
            className={`smart-chip ${sort === "price_asc" ? "smart-chip-active" : ""}`}
          >
            💰 أوفر سعر
          </button>
          <button
            type="button"
            onClick={() =>
              setFilters((f) => ({
                ...f,
                stops: f.stops.length === 1 && f.stops[0] === "direct" ? [] : ["direct"],
              }))
            }
            className={`smart-chip ${filters.stops.length === 1 && filters.stops[0] === "direct" ? "smart-chip-active" : ""}`}
          >
            ✈️ بدون توقف
          </button>
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, minBaggage: f.minBaggage === 23 ? null : 23 }))}
            className={`smart-chip ${filters.minBaggage != null ? "smart-chip-active" : ""}`}
          >
            🧳 شامل أمتعة
          </button>
        </div>
      </div>

      <p className="text-sm font-semibold text-slate-700">🔍 عندك رحلة محددة في بالك؟</p>
      <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Select label="من" value={from} onChange={(e) => setFrom(e.target.value)} options={airportOptions} />
        <Select
          label="إلى"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            if (e.target.value) setRegionKey(null);
          }}
          options={airportOptions}
        />
        <Select
          label="ترتيب"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          options={[
            { value: "price_asc", label: "السعر ↑" },
            { value: "price_desc", label: "السعر ↓" },
          ]}
        />
      </Card>

      <div className="flex flex-wrap gap-2">
        {BUDGET_CHIPS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => setBudget(budget === amount ? null : amount)}
            className={`smart-chip font-latin ${budget === amount ? "smart-chip-active" : ""}`}
          >
            ${amount}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {deals.length < total ? `${deals.length} من ${total} فرصة نشطة` : `${total} فرصة نشطة`}
        </p>
        <button type="button" onClick={() => setMobileFiltersOpen(true)} className="smart-chip lg:hidden">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton-pulse h-[360px]" />
            ))}
          </div>
        ) : error ? (
          <Card className="text-red-600">{error}</Card>
        ) : filtered.length === 0 ? (
          <Card className="space-y-3 text-center">
            <p className="text-slate-700">لا توجد فرص مطابقة.</p>
            <p className="text-sm text-slate-500">جرّب زيادة الميزانية أو إزالة بعض الفلاتر.</p>
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="cta-primary mx-auto px-5 py-2 text-sm"
            >
              إعادة تعيين الفلاتر
            </button>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((deal) => (
                <DealImageWrapper
                  key={deal.id}
                  deal={deal}
                  catalog={catalog}
                  comparing={compareIds.includes(deal.id)}
                  onToggleCompare={toggleCompare}
                />
              ))}
            </div>
            {deals.length < total ? (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? "جاري التحميل..." : `عرض المزيد (${total - deals.length} فرصة متبقية)`}
                </Button>
              </div>
            ) : null}
          </>
        )}
        </div>
      </div>

      {compareIds.length > 0 ? (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <p className="text-sm font-semibold text-slate-700">
            {compareIds.length} من {MAX_COMPARE} محدّدة للمقارنة
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCompareIds([])} className="text-xs text-slate-500 hover:text-red-500">
              مسح
            </button>
            <Button disabled={compareIds.length < 2} onClick={() => setCompareOpen(true)} className="text-sm">
              قارن الآن
            </Button>
          </div>
        </div>
      ) : null}

      <DealComparisonModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        deals={deals.filter((d) => compareIds.includes(d.id))}
        catalog={catalog}
        onRemove={toggleCompare}
      />
    </div>
  );
}
