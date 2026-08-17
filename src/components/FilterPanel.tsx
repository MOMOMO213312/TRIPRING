import { EMPTY_FILTERS } from "../lib/filters";
import type { AdvancedFilters } from "../lib/filters";
import { dealTypeLabel } from "../lib/deal-utils";
import type { AirlineRow, DealType, StopType } from "../types/database";
import { Button } from "./ui/Button";

const SCORE_OPTIONS = [90, 80, 70];
const SAVINGS_OPTIONS = [10, 20, 30, 40];
const STOP_OPTIONS: { value: StopType; label: string }[] = [
  { value: "direct", label: "بدون توقف" },
  { value: "one_stop", label: "توقف واحد" },
  { value: "multi_stop", label: "توقفات متعددة" },
];
const BAGGAGE_OPTIONS = [23, 32];
const EXPIRY_OPTIONS = [
  { value: 12, label: "خلال 12 ساعة" },
  { value: 24, label: "خلال 24 ساعة" },
  { value: 48, label: "خلال 48 ساعة" },
];
const DEAL_TYPES: (DealType | "any")[] = ["any", "flash", "last_minute", "empty_seat", "special_fare"];

type Props = {
  filters: AdvancedFilters;
  onChange: (next: AdvancedFilters) => void;
  availableAirlines: AirlineRow[];
  /** Mobile bottom-sheet mode. Desktop renders as a static sidebar regardless. */
  isOpen?: boolean;
  onClose?: () => void;
};

export function FilterPanel({ filters, onChange, availableAirlines, isOpen, onClose }: Props) {
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
        <h3 className="text-base font-bold text-gray-900">الفلاتر المتقدمة</h3>
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="text-xs font-semibold text-[#2563EB] hover:underline"
        >
          إعادة تعيين
        </button>
      </div>

      <FilterGroup title="Deal Score">
        <div className="flex flex-wrap gap-2">
          {SCORE_OPTIONS.map((s) => (
            <ChipToggle
              key={s}
              active={filters.minScore === s}
              onClick={() => onChange({ ...filters, minScore: filters.minScore === s ? null : s })}
            >
              {s}+
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="نسبة التوفير">
        <div className="flex flex-wrap gap-2">
          {SAVINGS_OPTIONS.map((s) => (
            <ChipToggle
              key={s}
              active={filters.minSavings === s}
              onClick={() => onChange({ ...filters, minSavings: filters.minSavings === s ? null : s })}
            >
              {s}%+
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="التوقفات">
        <div className="space-y-2">
          {STOP_OPTIONS.map((opt) => (
            <Checkbox key={opt.value} checked={filters.stops.includes(opt.value)} onChange={() => toggleStop(opt.value)}>
              {opt.label}
            </Checkbox>
          ))}
        </div>
      </FilterGroup>

      {availableAirlines.length > 0 ? (
        <FilterGroup title="شركات الطيران">
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {availableAirlines.map((a) => (
              <Checkbox key={a.code} checked={filters.airlines.includes(a.code)} onChange={() => toggleAirline(a.code)}>
                {a.name}
              </Checkbox>
            ))}
          </div>
        </FilterGroup>
      ) : null}

      <FilterGroup title="الأمتعة">
        <div className="flex flex-wrap gap-2">
          {BAGGAGE_OPTIONS.map((kg) => (
            <ChipToggle
              key={kg}
              active={filters.minBaggage === kg}
              onClick={() => onChange({ ...filters, minBaggage: filters.minBaggage === kg ? null : kg })}
            >
              {kg} كجم+
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="ينتهي العرض">
        <div className="flex flex-wrap gap-2">
          {EXPIRY_OPTIONS.map((opt) => (
            <ChipToggle
              key={opt.value}
              active={filters.expiresWithinHours === opt.value}
              onClick={() =>
                onChange({
                  ...filters,
                  expiresWithinHours: filters.expiresWithinHours === opt.value ? null : opt.value,
                })
              }
            >
              ⏳ {opt.label}
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="نوع الفرصة">
        <div className="flex flex-wrap gap-2">
          {DEAL_TYPES.map((t) => (
            <ChipToggle
              key={t}
              active={filters.dealType === t}
              onClick={() => onChange({ ...filters, dealType: t })}
            >
              {t === "any" ? "الكل" : dealTypeLabel(t)}
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden shrink-0 lg:block lg:w-[260px]">
        <div className="sticky top-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">{content}</div>
      </aside>

      {/* Mobile bottom sheet */}
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <div className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl">
            {content}
            <div className="sticky bottom-0 mt-6 flex gap-3 border-t border-gray-100 bg-white pt-4">
              <Button variant="outline" fullWidth onClick={() => onChange(EMPTY_FILTERS)}>
                إعادة تعيين
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

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-4 first:border-0 first:pt-0">
      <p className="mb-2.5 text-sm font-semibold text-gray-800">{title}</p>
      {children}
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
          ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
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
    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 rounded accent-[#2563EB]" />
      {children}
    </label>
  );
}
