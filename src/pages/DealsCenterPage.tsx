import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { DealComparisonModal } from "../components/DealComparisonModal";
import { DealImageWrapper } from "../components/DealImageWrapper";
import { FilterPanel } from "../components/FilterPanel";
import { Select } from "../components/ui/Select";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { fetchActiveDealsPage } from "../lib/api";
import type { DealSearchParams } from "../lib/api";
import { airlinesInDeals, applyAdvancedFilters, countAdvancedOnlyFilters, EMPTY_FILTERS } from "../lib/filters";
import type { AdvancedFilters, DataStatus } from "../lib/filters";
import { useCatalog } from "../hooks/useCatalog";
import type { DealRow, DealType, StopType } from "../types/database";

const BUDGET_CHIPS = [100, 200, 300, 500, 700, 1000];
const VALID_DEAL_TYPES: DealType[] = ["flash", "last_minute", "empty_seat", "special_fare"];
// Small page size + real "load more" instead of dumping every active deal on
// screen — the customer picks filters (budget first) to narrow down, rather
// than scrolling through everything.
const PAGE_SIZE = 12;
type SortKey = NonNullable<DealSearchParams["sort"]>;
type PriorityKey = "price" | "speed" | "direct" | "baggage" | "flexible";
const MAX_PRIORITIES = 2;

const STOP_FILTER_OPTIONS: { value: StopType | "any"; label: string }[] = [
  { value: "any", label: "أي" },
  { value: "direct", label: "مباشر" },
  { value: "one_stop", label: "توقف واحد" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recommended", label: "الأنسب (موصى به)" },
  { value: "price_asc", label: "أقل سعر" },
  { value: "duration_asc", label: "أقصر رحلة" },
  { value: "departure_asc", label: "أقرب مغادرة" },
];

const DATA_STATUS_CHIPS: { value: DataStatus; label: string }[] = [
  { value: "verified", label: "🟢 تم التحقق مؤخرًا" },
  { value: "needs_check", label: "🟡 يحتاج تحقق" },
  { value: "limited", label: "🔥 فرصة محدودة" },
];

const PRIORITY_OPTIONS: { value: PriorityKey; label: string }[] = [
  { value: "price", label: "💰 أوفر سعر" },
  { value: "speed", label: "⚡ أسرع رحلة" },
  { value: "direct", label: "✈️ بدون توقف" },
  { value: "baggage", label: "🧳 شامل أمتعة" },
  { value: "flexible", label: "📅 مرن في الموعد" },
];

export function DealsCenterPage() {
  const catalog = useCatalog();
  const [searchParams] = useSearchParams();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("recommended");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [budget, setBudget] = useState<number | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [stopsChoice, setStopsChoice] = useState<StopType | "any">("any");
  const [minBaggage, setMinBaggage] = useState<number | null>(null);
  const [priorities, setPriorities] = useState<PriorityKey[]>([]);
  const [dataStatusSel, setDataStatus] = useState<DataStatus[]>([]);
  // Deep-link support: /deals?dealType=last_minute (used by the homepage
  // "Last-Minute Opportunities" section's "عرض الكل" button) — applied
  // silently server-side, not exposed as a filter control on this page.
  const [dealType] = useState<DealType | "any">(() => {
    const urlDealType = searchParams.get("dealType");
    return VALID_DEAL_TYPES.includes(urlDealType as DealType) ? (urlDealType as DealType) : "any";
  });
  const [filters, setFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const MAX_COMPARE = 3;

  function togglePriority(key: PriorityKey) {
    setPriorities((prev) => {
      const has = prev.includes(key);
      if (has) return prev.filter((p) => p !== key);
      if (prev.length >= MAX_PRIORITIES) return prev; // cap at 1–2 selected
      return [...prev, key];
    });
    // Each priority quick-picks a real, provable filter/sort — never a fake score.
    if (key === "price") setSort((s) => (s === "recommended" ? "price_asc" : s === "price_asc" ? "recommended" : s));
    if (key === "speed") setSort((s) => (s === "recommended" ? "duration_asc" : s === "duration_asc" ? "recommended" : s));
    if (key === "direct") setStopsChoice((s) => (s === "direct" ? "any" : "direct"));
    if (key === "baggage") setMinBaggage((b) => (b === 23 ? null : 23));
    if (key === "flexible") setFlexibleDates((f) => !f);
  }

  function toggleCompare(dealId: string) {
    setCompareIds((prev) => {
      if (prev.includes(dealId)) return prev.filter((id) => id !== dealId);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, dealId];
    });
  }

  function applyBudgetInput() {
    const n = Number(budgetInput);
    setBudget(budgetInput && !Number.isNaN(n) && n > 0 ? n : null);
  }

  const serverParams: DealSearchParams = {
    sort,
    from: from || undefined,
    to: to || undefined,
    departureDate: departureDate || undefined,
    departureDateWindowDays: flexibleDates && departureDate ? 3 : undefined,
    maxPrice: budget ?? undefined,
    dealType,
    availableOnly: true,
  };
  const depsKey = JSON.stringify(serverParams);

  // Base filters hit the server and reset back to page 0 — each combination
  // is its own result set, fetched fresh so the "X من Y" count and the
  // deals shown always match what's actually being asked for instead of
  // stacking pages from a previous filter combo.
  useEffect(() => {
    setLoading(true);
    setPage(0);
    fetchActiveDealsPage({ ...serverParams, page: 0, pageSize: PAGE_SIZE })
      .then(({ deals: rows, total: count }) => {
        setDeals(rows);
        setTotal(count);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "خطأ"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    fetchActiveDealsPage({ ...serverParams, page: nextPage, pageSize: PAGE_SIZE })
      .then(({ deals: rows, total: count }) => {
        setDeals((prev) => [...prev, ...rows]);
        setTotal(count);
        setPage(nextPage);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "خطأ"))
      .finally(() => setLoadingMore(false));
  }

  const combinedFilters: AdvancedFilters = useMemo(
    () => ({
      ...filters,
      stops: stopsChoice === "any" ? [] : [stopsChoice],
      minBaggage,
      dataStatus: dataStatusSel,
    }),
    [filters, stopsChoice, minBaggage, dataStatusSel],
  );
  const finalFiltered = useMemo(() => applyAdvancedFilters(deals, combinedFilters), [deals, combinedFilters]);

  const availableAirlines = useMemo(() => airlinesInDeals(deals, catalog.airlines), [deals, catalog.airlines]);
  const advancedFilterCount = countAdvancedOnlyFilters(filters);

  function toggleDataStatus(v: DataStatus) {
    setDataStatus((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  }

  function resetAll() {
    setFilters(EMPTY_FILTERS);
    setStopsChoice("any");
    setMinBaggage(null);
    setBudget(null);
    setBudgetInput("");
    setPriorities([]);
    setDataStatus([]);
  }

  if (catalog.loading) return <p className="text-slate-500">جاري التحميل...</p>;

  const airportOptions = [
    { value: "", label: "الكل" },
    ...catalog.airports.map((a) => ({ value: a.code, label: `${a.city} (${a.code})` })),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">مركز الفرص</h1>
        <p className="text-slate-600">حدد ميزانيتك ووجهتك عشان نظهرلك أدق الفرص، مش كل العروض</p>
      </div>

      {/* إيه الأهم بالنسبالك؟ — يختار العميل واحد أو اثنين */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <span aria-hidden>✨</span> إيه الأهم بالنسبالك؟ <span className="text-xs font-normal text-slate-400">(اختَر واحد أو اثنين)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {PRIORITY_OPTIONS.map((opt) => {
            const active = priorities.includes(opt.value);
            const disabled = !active && priorities.length >= MAX_PRIORITIES;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => togglePriority(opt.value)}
                className={`smart-chip ${active ? "smart-chip-active" : ""} ${disabled ? "opacity-40" : ""}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 💰 السعر — أهم فلتر، لازم يظهر بوضوح */}
      <Card className="space-y-3 border-2 border-[#BFE3F6]">
        <p className="flex items-center gap-1.5 text-sm font-bold text-slate-800">
          <span aria-hidden>💰</span> الميزانية <span className="text-red-500">*</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {BUDGET_CHIPS.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => {
                setBudget(budget === amount ? null : amount);
                setBudgetInput(budget === amount ? "" : String(amount));
              }}
              className={`smart-chip font-latin ${budget === amount ? "smart-chip-active" : ""}`}
            >
              ${amount}
            </button>
          ))}
        </div>
        <div className="flex max-w-xs items-center gap-2">
          <Input
            type="number"
            min={1}
            placeholder="ميزانية مخصصة $"
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            onBlur={applyBudgetInput}
            className="font-latin"
          />
          <Button variant="outline" onClick={applyBudgetInput}>
            تطبيق
          </Button>
        </div>
      </Card>

      <Card className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Select label="🌍 من" value={from} onChange={(e) => setFrom(e.target.value)} options={airportOptions} />
        <Select label="🌍 إلى (الوجهة)" value={to} onChange={(e) => setTo(e.target.value)} options={airportOptions} />
        <div className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">📅 تاريخ السفر</span>
          <input
            type="date"
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-[#BFE3F6]"
          />
          <label className="flex items-center gap-2 pt-1 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={flexibleDates}
              onChange={(e) => setFlexibleDates(e.target.checked)}
              className="size-4 rounded accent-[#0C7BB3]"
            />
            مرن في الموعد (± 3 أيام)
          </label>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800">✈️ التوقفات</p>
          <div className="flex flex-wrap gap-2">
            {STOP_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStopsChoice(opt.value)}
                className={`smart-chip ${stopsChoice === opt.value ? "smart-chip-active" : ""}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-800">🧳 الأمتعة</p>
          <div className="flex flex-wrap gap-2">
            {[23, 32].map((kg) => (
              <button
                key={kg}
                type="button"
                onClick={() => setMinBaggage(minBaggage === kg ? null : kg)}
                className={`smart-chip ${minBaggage === kg ? "smart-chip-active" : ""}`}
              >
                {kg} كجم+
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* حالة البيانات */}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">حالة البيانات</p>
        <div className="flex flex-wrap gap-2">
          {DATA_STATUS_CHIPS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleDataStatus(opt.value)}
              className={`smart-chip ${dataStatusSel.includes(opt.value) ? "smart-chip-active" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {deals.length < total ? `${deals.length} من ${total} فرصة نشطة` : `${total} فرصة نشطة`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <button type="button" onClick={() => setMobileFiltersOpen(true)} className="smart-chip">
            🔧 المزيد من الفلاتر {advancedFilterCount ? `(${advancedFilterCount})` : ""}
          </button>
          {advancedFilterCount || budget || departureDate || stopsChoice !== "any" || minBaggage || dataStatusSel.length || priorities.length ? (
            <button type="button" onClick={resetAll} className="text-xs font-semibold text-[#0C7BB3] hover:underline">
              إعادة تعيين الكل
            </button>
          ) : null}
        </div>
      </div>

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
        ) : finalFiltered.length === 0 ? (
          <Card className="space-y-3 text-center">
            <p className="text-slate-700">لا توجد فرص مطابقة.</p>
            <p className="text-sm text-slate-500">جرّب زيادة الميزانية أو إزالة بعض الفلاتر.</p>
            <button type="button" onClick={resetAll} className="cta-primary mx-auto px-5 py-2 text-sm">
              إعادة تعيين الفلاتر
            </button>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {finalFiltered.map((deal) => (
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
