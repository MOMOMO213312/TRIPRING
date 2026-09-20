import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { AdvancedFilters, DurationBucket, TimeSlot } from "../lib/filters";
import { EMPTY_FILTERS } from "../lib/filters";

import { REGIONS, regionLabel } from "../lib/regions";
import type { AirlineRow, StopType } from "../types/database";
import { Button } from "./ui/Button";
import { useCurrency } from "../hooks/useCurrency";

// Labels live in the `search` namespace (filter.stops.*, filter.duration.*, filter.slot.*).
const STOP_OPTIONS: { value: StopType | ""; labelKey: string }[] = [
  { value: "", labelKey: "filter.stops.all" },
  { value: "direct", labelKey: "filter.stops.direct" },
  { value: "one_stop", labelKey: "filter.stops.one" },
  { value: "multi_stop", labelKey: "filter.stops.multi" },
];

const DURATION_OPTIONS: DurationBucket[] = ["short", "medium", "long"];

const TIME_SLOT_OPTIONS: { value: TimeSlot; icon: string }[] = [
  { value: "6am_12pm", icon: "☀️" },
  { value: "before_6am", icon: "🌙" },
  { value: "6pm_midnight", icon: "🌙" },
  { value: "12pm_6pm", icon: "🌤️" },
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
  const { t } = useTranslation("search");
  const { fmtIn } = useCurrency();
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
          {t("filter.title")}
        </h3>
        <button type="button" onClick={resetAll} className="text-xs font-semibold text-[#0C7BB3] hover:underline">
          {t("filter.clearAll")}
        </button>
      </div>

      <FilterSection title={t("filter.section.destination")}>
        <div className="space-y-2">
          {REGIONS.map((region) => (
            <label key={region.key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={regionKey === region.key}
                onChange={() => onSelectRegion(region.key)}
                className="size-4 rounded accent-[#0C7BB3]"
              />
              {region.emoji} {regionLabel(region)}
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title={t("filter.section.price")}>
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
            <span>{fmtIn(minPrice, currency)}</span>
            <span>{fmtIn(maxPrice, currency)}{maxPrice >= priceBounds.max ? "+" : ""}</span>
          </div>
        </div>
      </FilterSection>

      <FilterSection title={t("filter.section.stops")}>
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
              {t(opt.labelKey)}
            </label>
          ))}
        </div>
      </FilterSection>

      {availableAirlines.length > 0 ? (
        <FilterSection title={t("filter.section.airlines")}>
          <input
            type="text"
            value={airlineSearch}
            onChange={(e) => setAirlineSearch(e.target.value)}
            placeholder={t("filter.airlineSearch")}
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
            {shownAirlines.length === 0 ? <p className="text-xs text-slate-400">{t("filter.noResults")}</p> : null}
          </div>
        </FilterSection>
      ) : null}

      <FilterSection title={t("filter.section.duration")}>
        <div className="space-y-2">
          {DURATION_OPTIONS.map((bucket) => (
            <label key={bucket} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.durationBucket === bucket}
                onChange={() => setDuration(bucket)}
                className="size-4 rounded accent-[#0C7BB3]"
              />
              {t(`filter.duration.${bucket}`)}
            </label>
          ))}
        </div>
      </FilterSection>

      <FilterSection title={t("filter.section.departureTimes")}>
        <TimeSlotGrid
          selected={filters.departureSlot}
          onSelect={(slot) =>
            onChange({ ...filters, departureSlot: filters.departureSlot === slot ? null : slot })
          }
        />
      </FilterSection>

      <FilterSection title={t("filter.section.arrivalTimes")}>
        <TimeSlotGrid
          selected={filters.arrivalSlot}
          onSelect={(slot) => onChange({ ...filters, arrivalSlot: filters.arrivalSlot === slot ? null : slot })}
        />
      </FilterSection>

      <FilterSection title={t("filter.section.ticketTerms")}>
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.refundableOnly}
              onChange={() => onChange({ ...filters, refundableOnly: !filters.refundableOnly })}
              className="size-4 rounded accent-[#0C7BB3]"
            />
            {t("filter.term.refundable")}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.changeableOnly}
              onChange={() => onChange({ ...filters, changeableOnly: !filters.changeableOnly })}
              className="size-4 rounded accent-[#0C7BB3]"
            />
            {t("filter.term.changeable")}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.checkedBaggageOnly}
              onChange={() => onChange({ ...filters, checkedBaggageOnly: !filters.checkedBaggageOnly })}
              className="size-4 rounded accent-[#0C7BB3]"
            />
            {t("filter.term.checkedBag")}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.noChangeFeeOnly}
              onChange={() => onChange({ ...filters, noChangeFeeOnly: !filters.noChangeFeeOnly })}
              className="size-4 rounded accent-[#0C7BB3]"
            />
            {t("filter.term.noChangeFee")}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.noCancellationFeeOnly}
              onChange={() => onChange({ ...filters, noCancellationFeeOnly: !filters.noCancellationFeeOnly })}
              className="size-4 rounded accent-[#0C7BB3]"
            />
            {t("filter.term.noCancelFee")}
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
                {t("filter.clearAll")}
              </Button>
              <Button fullWidth onClick={onClose}>
                {t("filter.apply")}
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

function TimeSlotGrid({
  selected,
  onSelect,
}: {
  selected: TimeSlot | null;
  onSelect: (slot: TimeSlot) => void;
}) {
  const { t } = useTranslation("search");
  return (
    <div className="grid grid-cols-2 gap-2">
      {TIME_SLOT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onSelect(opt.value)}
          className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center text-[11px] font-semibold transition ${
            selected === opt.value
              ? "border-[#0C7BB3] bg-[#E5F4FB] text-[#0C7BB3]"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          <span aria-hidden className="text-base">
            {opt.icon}
          </span>
          {t(`filter.slot.${opt.value}`)}
        </button>
      ))}
    </div>
  );
}
