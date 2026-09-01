import { useState } from "react";

import type { AdvancedFilters, DurationBucket } from "../lib/filters";
import { EMPTY_FILTERS } from "../lib/filters";
import { formatPrice } from "../lib/utils";
import { REGIONS } from "../lib/regions";
import type { AirlineRow, StopType } from "../types/database";
import { Button } from "./ui/Button";

const STOP_OPTIONS: { value: StopType | ""; label: string }[] = [
  { value: "", label: "الكل" },
  { value: "direct", label: "مباشر" },
  { value: "one_stop", label: "توقف واحد" },
  { value: "multi_stop", label: "توقفين أو أكثر" },
];

const DURATION_OPTIONS: { value: DurationBucket; label: string }[] = [
  { value: "short", label: "أقل من 5 ساعات" },
  { value: "medium", label: "من 5 إلى 10 ساعات" },
  { value: "long", label: "أكثر من 10 ساعات" },
];

type Props = {
  filters: AdvancedFilters;
  onChange: (next: AdvancedFilters) => void;
  availableAirlines: AirlineRow[];
  regionKey: string | null;
  onSelectRegion: (key: string) => void;
  currency: string;
  priceBounds: { min: number; max: number };
  minPrice: number;
  maxPrice: number;
  onPriceChange: (min: number, max: number) => void;
  isOpen?: boolean;
  onClose?: () => void;
};

export function DealsSidebarFilters({
  filters,
  onChange,
  availableAirlines,
  regionKey,
  onSelectRegion,
  currency,
  priceBounds,
  minPrice,
  maxPrice,
  onPriceChange,
  isOpen,
  onClose,
}: Props) {
  const [airlineSearch, setAirlineSearch] = useState("");

  function toggleAirline(code: string) {
    const has = filters.airlines.includes(code);
    onChange({ ...filters, airlines: has ? filters.airlines.filter((a) => a !== code) : [...filters.airlines, code] });
  }

  function setStop(value: StopType | "") {
    onChange({ ...filters, stops: value === "" ? [] : [value] });
  }

  function setDuration(value: DurationBucket) {
    onChange({ ...filters, durationBucket: filters.durationBucket === value ? null : value });
  }

  function resetAll() {
    onChange(EMPTY_FILTERS);
    onPriceChange(priceBounds.min, priceBounds.max);
  }

  const shownAirlines = availableAirlines.filter((a) => a.name.includes(airlineSearch) || airlineSearch === "");

  const minPct = priceBounds.max > priceBounds.min ? ((minPrice - priceBounds.min) / (priceBounds.max - priceBounds.min)) * 100 : 0;
  const maxPct = priceBounds.max > priceBounds.min ? ((maxPrice - priceBounds.min) / (priceBounds.max - priceBounds.min)) * 100 : 100;

  const content = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
          <span aria-hidden>🔧</span> الفلاتر
        </h3>
        <button type="button" onClick={resetAll} className="text-xs font-semibold text-[#0C7BB3] hover:underline">
          مسح الكل
        </button>
      </div>

      <FilterSection title="الوجهة">
        <div className="space-y-2">
          {REGIONS.map((region) => (
            <label key={region.key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={regionKey === region.key}
                onChange={() => onSelectRegion(region.key)}
                className="size-4 rounded accent-[#0C7BB3]"
              />
              {region.emoji} {region.label}
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="السعر">
        <div className="px-1">
          <div className="relative h-1.5 w-full">
            <div className="absolute inset-0 rounded-full bg-slate-200" />
            <div
              className="absolute h-1.5 rounded-full bg-[#0C7BB3]"
              style={{ insetInlineStart: `${minPct}%`, insetInlineEnd: `${100 - maxPct}%` }}
            />
            <input
              type="range"
              className="range-thumb absolute inset-0 w-full appearance-none bg-transparent"
              min={priceBounds.min}
              max={priceBounds.max}
              value={minPrice}
              onChange={(e) => onPriceChange(Math.min(Number(e.target.value), maxPrice), maxPrice)}
            />
            <input
              type="range"
              className="range-thumb absolute inset-0 w-full appearance-none bg-transparent"
              min={priceBounds.min}
              max={priceBounds.max}
              value={maxPrice}
              onChange={(e) => onPriceChange(minPrice, Math.max(Number(e.target.value), minPrice))}
            />
          </div>
          <div className="font-latin mt-3 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>{formatPrice(minPrice, currency)}</span>
            <span>{formatPrice(maxPrice, currency)}{maxPrice >= priceBounds.max ? "+" : ""}</span>
          </div>
        </div>
      </FilterSection>

      <FilterSection title="التوقفات">
        <div className="space-y-2">
          {STOP_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="stops"
                checked={opt.value === "" ? filters.stops.length === 0 : filters.stops[0] === opt.value}
                onChange={() => setStop(opt.value)}
                className="size-4 accent-[#0C7BB3]"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </FilterSection>

      {availableAirlines.length > 0 ? (
        <FilterSection title="شركات الطيران">
          <input
            type="text"
            value={airlineSearch}
            onChange={(e) => setAirlineSearch(e.target.value)}
            placeholder="بحث عن شركة طيران"
            className="mb-2.5 w-full rounded-lg border border-slate-200 bg-[#F8FAFC] px-2.5 py-1.5 text-xs outline-none focus:border-[#0C7BB3]"
          />
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {shownAirlines.map((a) => (
              <label key={a.code} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={filters.airlines.includes(a.code)}
                  onChange={() => toggleAirline(a.code)}
                  className="size-4 rounded accent-[#0C7BB3]"
                />
                {a.name}
              </label>
            ))}
            {shownAirlines.length === 0 ? <p className="text-xs text-slate-400">لا توجد نتائج</p> : null}
          </div>
        </FilterSection>
      ) : null}

      <FilterSection title="مدة الرحلة">
        <div className="space-y-2">
          {DURATION_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.durationBucket === opt.value}
                onChange={() => setDuration(opt.value)}
                className="size-4 rounded accent-[#0C7BB3]"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="شروط التذكرة">
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.refundableOnly}
              onChange={() => onChange({ ...filters, refundableOnly: !filters.refundableOnly })}
              className="size-4 rounded accent-[#0C7BB3]"
            />
            قابلة للاسترداد فقط
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.changeableOnly}
              onChange={() => onChange({ ...filters, changeableOnly: !filters.changeableOnly })}
              className="size-4 rounded accent-[#0C7BB3]"
            />
            يمكن تغييرها فقط
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.checkedBaggageOnly}
              onChange={() => onChange({ ...filters, checkedBaggageOnly: !filters.checkedBaggageOnly })}
              className="size-4 rounded accent-[#0C7BB3]"
            />
            تشمل حقيبة مسجلة
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.noChangeFeeOnly}
              onChange={() => onChange({ ...filters, noChangeFeeOnly: !filters.noChangeFeeOnly })}
              className="size-4 rounded accent-[#0C7BB3]"
            />
            بدون رسوم تغيير
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.noCancellationFeeOnly}
              onChange={() => onChange({ ...filters, noCancellationFeeOnly: !filters.noCancellationFeeOnly })}
              className="size-4 rounded accent-[#0C7BB3]"
            />
            بدون رسوم إلغاء
          </label>
        </div>
      </FilterSection>
    </div>
  );

  return (
    <>
      <div className="hidden w-72 shrink-0 lg:block">
        <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-5">{content}</div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <div className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:mx-auto sm:max-w-md sm:rounded-2xl sm:self-center">
            {content}
            <div className="sticky bottom-0 mt-6 flex gap-3 border-t border-slate-100 bg-white pt-4">
              <Button variant="outline" fullWidth onClick={resetAll}>
                مسح الكل
              </Button>
              <Button fullWidth onClick={onClose}>
                تطبيق الفلاتر
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
      <p className="mb-2.5 text-sm font-semibold text-slate-800">{title}</p>
      {children}
    </div>
  );
}
