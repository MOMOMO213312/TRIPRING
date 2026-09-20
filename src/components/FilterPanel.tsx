import { useTranslation } from "react-i18next";

import { EMPTY_FILTERS } from "../lib/filters";
import type { AdvancedFilters, TimeSlot } from "../lib/filters";
import { dealTypeLabel } from "../lib/deal-utils";
import type { AirlineRow, DealType, StopType } from "../types/database";
import { Button } from "./ui/Button";

// Labels live in the `search` namespace (filter.stops.*, filter.expiry, filter.slot.*).
const STOP_OPTIONS: { value: StopType; labelKey: string }[] = [
  { value: "direct", labelKey: "filter.stops.nonstop" },
  { value: "one_stop", labelKey: "filter.stops.one" },
  { value: "multi_stop", labelKey: "filter.stops.multiple" },
];
const BAGGAGE_OPTIONS = [23, 32];
const EXPIRY_HOURS = [12, 24, 48];
const DEAL_TYPES: (DealType | "any")[] = ["any", "flash", "last_minute", "empty_seat", "special_fare"];
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
  /** Bottom-sheet on mobile, centered modal on larger screens — opened on demand from the "Filters" button. */
  isOpen?: boolean;
  onClose?: () => void;
};

export function FilterPanel({ filters, onChange, availableAirlines, isOpen, onClose }: Props) {
  const { t } = useTranslation("search");
  function toggleStop(stop: StopType) {
    const has = filters.stops.includes(stop);
    onChange({ ...filters, stops: has ? filters.stops.filter((s) => s !== stop) : [...filters.stops, stop] });
  }

  function toggleAirline(code: string) {
    const has = filters.airlines.includes(code);
    onChange({
      ...filters,
      airlines: has ? filters.airlines.filter((a) => a !== code) : [...filters.airlines, code],
    });
  }

  const content = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900">{t("filter.advanced")}</h3>
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="text-xs font-semibold text-[#0C7BB3] hover:underline"
        >
          {t("filter.reset")}
        </button>
      </div>

      <FilterGroup title={t("filter.section.stops")}>
        <div className="space-y-2">
          {STOP_OPTIONS.map((opt) => (
            <Checkbox key={opt.value} checked={filters.stops.includes(opt.value)} onChange={() => toggleStop(opt.value)}>
              {t(opt.labelKey)}
            </Checkbox>
          ))}
        </div>
      </FilterGroup>

      {availableAirlines.length > 0 ? (
        <FilterGroup title={t("filter.section.airlines")}>
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {availableAirlines.map((a) => (
              <Checkbox key={a.code} checked={filters.airlines.includes(a.code)} onChange={() => toggleAirline(a.code)}>
                {a.name}
              </Checkbox>
            ))}
          </div>
        </FilterGroup>
      ) : null}

      <FilterGroup title={t("filter.section.baggage")}>
        <div className="flex flex-wrap gap-2">
          {BAGGAGE_OPTIONS.map((kg) => (
            <ChipToggle
              key={kg}
              active={filters.minBaggage === kg}
              onClick={() => onChange({ ...filters, minBaggage: filters.minBaggage === kg ? null : kg })}
            >
              {t("filter.baggageKg", { kg })}
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={t("filter.section.ticketTerms")}>
        <div className="space-y-2">
          <Checkbox
            checked={filters.refundableOnly}
            onChange={() => onChange({ ...filters, refundableOnly: !filters.refundableOnly })}
          >
            {t("filter.term.refundable")}
          </Checkbox>
          <Checkbox
            checked={filters.changeableOnly}
            onChange={() => onChange({ ...filters, changeableOnly: !filters.changeableOnly })}
          >
            {t("filter.term.changeable")}
          </Checkbox>
          <Checkbox
            checked={filters.checkedBaggageOnly}
            onChange={() => onChange({ ...filters, checkedBaggageOnly: !filters.checkedBaggageOnly })}
          >
            {t("filter.term.checkedBag")}
          </Checkbox>
          <Checkbox
            checked={filters.noChangeFeeOnly}
            onChange={() => onChange({ ...filters, noChangeFeeOnly: !filters.noChangeFeeOnly })}
          >
            {t("filter.term.noChangeFee")}
          </Checkbox>
          <Checkbox
            checked={filters.noCancellationFeeOnly}
            onChange={() => onChange({ ...filters, noCancellationFeeOnly: !filters.noCancellationFeeOnly })}
          >
            {t("filter.term.noCancelFee")}
          </Checkbox>
        </div>
      </FilterGroup>

      <FilterGroup title={t("filter.section.expires")}>
        <div className="flex flex-wrap gap-2">
          {EXPIRY_HOURS.map((hours) => (
            <ChipToggle
              key={hours}
              active={filters.expiresWithinHours === hours}
              onClick={() =>
                onChange({
                  ...filters,
                  expiresWithinHours: filters.expiresWithinHours === hours ? null : hours,
                })
              }
            >
              ⏳ {t("filter.expiry", { hours })}
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title={t("filter.section.departureTimes")}>
        <TimeSlotGrid
          selected={filters.departureSlot}
          onSelect={(slot) =>
            onChange({ ...filters, departureSlot: filters.departureSlot === slot ? null : slot })
          }
        />
      </FilterGroup>

      <FilterGroup title={t("filter.section.arrivalTimes")}>
        <TimeSlotGrid
          selected={filters.arrivalSlot}
          onSelect={(slot) => onChange({ ...filters, arrivalSlot: filters.arrivalSlot === slot ? null : slot })}
        />
      </FilterGroup>

      <FilterGroup title={t("filter.section.dealType")}>
        <div className="flex flex-wrap gap-2">
          {DEAL_TYPES.map((dt) => (
            <ChipToggle
              key={dt}
              active={filters.dealType === dt}
              onClick={() => onChange({ ...filters, dealType: dt })}
            >
              {dt === "any" ? t("filter.dealTypeAll") : dealTypeLabel(dt)}
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>
    </div>
  );

  return (
    <>
      {/* Persistent sidebar on large screens — desktop had no way to reach
         the filters at all before this: the only trigger button was
         lg:hidden and this component previously rendered nothing unless
         isOpen was true. */}
      <div className="hidden w-72 shrink-0 lg:block">
        <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-5">{content}</div>
      </div>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <div className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:mx-auto sm:max-w-md sm:rounded-2xl sm:self-center">
            {content}
            <div className="sticky bottom-0 mt-6 flex gap-3 border-t border-slate-100 bg-white pt-4">
              <Button variant="outline" fullWidth onClick={() => onChange(EMPTY_FILTERS)}>
                {t("filter.reset")}
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

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
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

function ChipToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-[#0C7BB3] bg-[#E5F4FB] text-[#0C7BB3]"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 rounded accent-[#0C7BB3]" />
      {children}
    </label>
  );
}
