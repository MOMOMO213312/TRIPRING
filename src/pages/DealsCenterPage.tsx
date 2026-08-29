import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { DealComparisonModal } from "../components/DealComparisonModal";
import { DealOpportunityCard } from "../components/DealOpportunityCard";
import { DealsSidebarFilters } from "../components/DealsSidebarFilters";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { fetchActiveDealsPage, fetchActivePriceBounds, fetchDealPriceDrops } from "../lib/api";
import { airlinesInDeals, applyAdvancedFilters, countActiveFilters, EMPTY_FILTERS } from "../lib/filters";
import type { AdvancedFilters } from "../lib/filters";
import { friendlyErrorMessage } from "../lib/errors";
import { useCatalog, useDealImage } from "../hooks/useCatalog";
import type { Catalog } from "../hooks/useCatalog";
import { findRegion, regionAirportCodes, REGIONS } from "../lib/regions";
import { formatPrice } from "../lib/utils";
import type { DealRow, DealType } from "../types/database";

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
  const [priceDrops, setPriceDrops] = useState<Map<string, { percent: number; amount: number }>>(new Map());

  // Real min/max active price — fetched once so the sidebar slider never
  // shows an invented range. Falls back to a wide-open [0, +inf] window
  // until it resolves, so the UI is never blocked on it.
  const [priceBounds, setPriceBounds] = useState({ min: 0, max: 100000 });
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(100000);
  useEffect(() => {
    fetchActivePriceBounds().then(({ min, max }) => {
      setPriceBounds({ min, max });
      setMinPrice(min);
      setMaxPrice(max);
    });
  }, []);

  // Destination entry point (see UX spec: each pick — region, then budget,
  // then stop-type — reshapes the page into a narrower curated view instead
  // of behaving like a traditional filter sidebar).
  const [regionKey, setRegionKey] = useState<string | null>(null);
  const selectedRegion = findRegion(regionKey);
  // Deep-link support: /deals?dealType=last_minute (used by the homepage
  // "Last-Minute Opportunities" section's "عرض الكل" button) pre-applies
  // the same dealType filter DealsSidebarFilters already knows how to render/clear.
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
  const isPriceNarrowed = minPrice > priceBounds.min || maxPrice < priceBounds.max;

  function selectRegion(key: string) {
    setRegionKey((prev) => (prev === key ? null : key));
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
      toAirports: toAirportCodes.length ? toAirportCodes : undefined,
      minPrice: minPrice > priceBounds.min ? minPrice : undefined,
      maxPrice: maxPrice < priceBounds.max ? maxPrice : undefined,
      availableOnly: true,
      page: 0,
      pageSize: PAGE_SIZE,
    })
      .then(async ({ deals: rows, total: count }) => {
        setDeals(rows);
        setTotal(count);
        setPriceDrops(await fetchDealPriceDrops(rows.map((d) => d.id)));
      })
      .catch((e) => setError(friendlyErrorMessage(e, "حصل خطأ في تحميل العروض، جرّب تاني.", "DealsCenterPage.load")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, minPrice, maxPrice, regionKey, toAirportCodes, priceBounds.min, priceBounds.max]);

  function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    fetchActiveDealsPage({
      sort,
      toAirports: toAirportCodes.length ? toAirportCodes : undefined,
      minPrice: minPrice > priceBounds.min ? minPrice : undefined,
      maxPrice: maxPrice < priceBounds.max ? maxPrice : undefined,
      availableOnly: true,
      page: nextPage,
      pageSize: PAGE_SIZE,
    })
      .then(async ({ deals: rows, total: count }) => {
        setDeals((prev) => [...prev, ...rows]);
        setTotal(count);
        setPage(nextPage);
        const moreDrops = await fetchDealPriceDrops(rows.map((d) => d.id));
        setPriceDrops((prev) => new Map([...prev, ...moreDrops]));
      })
      .catch((e) => setError(friendlyErrorMessage(e, "حصل خطأ في تحميل العروض، جرّب تاني.", "DealsCenterPage.load")))
      .finally(() => setLoadingMore(false));
  }

  const filtered = useMemo(() => applyAdvancedFilters(deals, filters), [deals, filters]);
  const availableAirlines = useMemo(() => airlinesInDeals(deals, catalog.airlines), [deals, catalog.airlines]);
  const activeFilterCount = countActiveFilters(filters) + (isPriceNarrowed ? 1 : 0);
  const currency = deals[0]?.currency ?? "EGP";

  if (catalog.loading) return <p className="text-slate-500">جاري التحميل...</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#E5F4FB] text-2xl" aria-hidden>
            🌍
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">TripRing عروض</h1>
            <p className="text-slate-500">اكتشف أفضل فرص السفر المتاحة الآن</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-500">
          <span aria-hidden>📈</span>
          نقارن الأسعار أولاً بأول لنقدّم لك فرص حقيقية
        </div>
      </div>

      {/* Quick tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setRegionKey(null);
            setFilters((f) => ({ ...f, stops: [] }));
          }}
          className={`smart-chip ${!regionKey && !isDirectOnly ? "smart-chip-active" : ""}`}
        >
          🗂️ كل العروض
        </button>
        <button
          type="button"
          onClick={() => setSort("price_asc")}
          className={`smart-chip ${sort === "price_asc" ? "smart-chip-active" : ""}`}
        >
          💰 الأرخص
        </button>
        <button
          type="button"
          onClick={() => setFilters((f) => ({ ...f, stops: isDirectOnly ? [] : ["direct"] }))}
          className={`smart-chip ${isDirectOnly ? "smart-chip-active" : ""}`}
        >
          ✈️ مباشر
        </button>
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

      {/* Active filters */}
      {selectedRegion || isPriceNarrowed || isDirectOnly ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">اخترت:</span>
          {selectedRegion ? (
            <button type="button" onClick={() => selectRegion(selectedRegion.key)} className="smart-chip smart-chip-active">
              {selectedRegion.emoji} {selectedRegion.label} ✕
            </button>
          ) : null}
          {isPriceNarrowed ? (
            <button
              type="button"
              onClick={() => {
                setMinPrice(priceBounds.min);
                setMaxPrice(priceBounds.max);
              }}
              className="smart-chip smart-chip-active font-latin"
            >
              {formatPrice(minPrice, currency)} - {formatPrice(maxPrice, currency)} ✕
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

      {/* Results count + sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700">{total} عرض متاح</p>
        <div className="flex items-center gap-2">
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            options={[
              { value: "price_asc", label: "ترتيب: الأوفر أولاً" },
              { value: "price_desc", label: "ترتيب: الأعلى سعرًا أولاً" },
            ]}
            className="!py-2 text-sm"
          />
          <button type="button" onClick={() => setMobileFiltersOpen(true)} className="smart-chip lg:hidden">
            🔧 الفلاتر {activeFilterCount ? `(${activeFilterCount})` : ""}
          </button>
        </div>
      </div>

      <div className="flex items-start gap-6">
        <DealsSidebarFilters
          filters={filters}
          onChange={setFilters}
          availableAirlines={availableAirlines}
          regionKey={regionKey}
          onSelectRegion={selectRegion}
          currency={currency}
          priceBounds={priceBounds}
          minPrice={minPrice}
          maxPrice={maxPrice}
          onPriceChange={(min, max) => {
            setMinPrice(min);
            setMaxPrice(max);
          }}
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
        />

        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-pulse h-[400px]" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-red-600">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-slate-700">لا توجد فرص مطابقة.</p>
              <p className="text-sm text-slate-500">جرّب توسيع نطاق السعر أو إزالة بعض الفلاتر.</p>
              <button
                type="button"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setMinPrice(priceBounds.min);
                  setMaxPrice(priceBounds.max);
                }}
                className="cta-primary mx-auto px-5 py-2 text-sm"
              >
                إعادة تعيين الفلاتر
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((deal) => (
                  <DealCardWithImage
                    key={deal.id}
                    deal={deal}
                    catalog={catalog}
                    priceDrop={priceDrops.get(deal.id) ?? null}
                    comparing={compareIds.includes(deal.id)}
                    onToggleCompare={(id) =>
                      setCompareIds((prev) => {
                        if (prev.includes(id)) return prev.filter((x) => x !== id);
                        if (prev.length >= MAX_COMPARE) return prev;
                        return [...prev, id];
                      })
                    }
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
        onRemove={(id) => setCompareIds((prev) => prev.filter((x) => x !== id))}
      />
    </div>
  );
}

function DealCardWithImage({
  deal,
  catalog,
  priceDrop,
  comparing,
  onToggleCompare,
}: {
  deal: DealRow;
  catalog: Catalog;
  priceDrop: { percent: number; amount: number } | null;
  comparing: boolean;
  onToggleCompare: (id: string) => void;
}) {
  const imageUrl = useDealImage(deal.to_airport, catalog, deal.id);
  return (
    <DealOpportunityCard
      deal={deal}
      airports={catalog.airports}
      airlines={catalog.airlines}
      agencies={catalog.agencies}
      imageUrl={imageUrl}
      priceDrop={priceDrop}
      comparing={comparing}
      onToggleCompare={onToggleCompare}
    />
  );
}
