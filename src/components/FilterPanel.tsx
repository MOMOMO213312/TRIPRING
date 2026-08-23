import { EMPTY_FILTERS } from "../lib/filters";
import type { AdvancedFilters, DurationBucket, TimeOfDay, TravelClassFilter } from "../lib/filters";
import type { AirlineRow } from "../types/database";
import { Button } from "./ui/Button";

const TIME_OPTIONS: { value: TimeOfDay; label: string }[] = [
  { value: "morning", label: "صباحًا (6ص–12ظ)" },
  { value: "afternoon", label: "ظهرًا (12–6م)" },
  { value: "evening", label: "مساءً (6–12م)" },
  { value: "night", label: "ليلاً (12–6ص)" },
];
const DURATION_OPTIONS: { value: DurationBucket; label: string }[] = [
  { value: "short", label: "قصيرة (أقل من 5 ساعات)" },
  { value: "medium", label: "متوسطة (5–10 ساعات)" },
  { value: "long", label: "طويلة (أكثر من 10 ساعات)" },
];
const CLASS_OPTIONS: { value: TravelClassFilter; label: string }[] = [
  { value: "economy", label: "اقتصادية" },
  { value: "premium_economy", label: "اقتصادية مميزة" },
  { value: "business", label: "رجال أعمال" },
  { value: "first", label: "الدرجة الأولى" },
];

type Props = {
  filters: AdvancedFilters;
  onChange: (next: AdvancedFilters) => void;
  availableAirlines: AirlineRow[];
  /** Bottom-sheet on mobile, centered modal on larger screens — opened on demand from a "المزيد من الفلاتر" button. */
  isOpen?: boolean;
  onClose?: () => void;
};

/** "المزيد من الفلاتر" — secondary filters, only reachable through the explicit button (primary filters live on the page itself). */
export function FilterPanel({ filters, onChange, availableAirlines, isOpen, onClose }: Props) {
  function toggleAirline(code: string) {
    const has = filters.airlines.includes(code);
    onChange({
      ...filters,
      airlines: has ? filters.airlines.filter((a) => a !== code) : [...filters.airlines, code],
    });
  }

  function toggleIn<K extends "departureTimes" | "arrivalTimes" | "durationBuckets" | "travelClasses">(
    key: K,
    value: AdvancedFilters[K][number],
  ) {
    const list = filters[key] as unknown[];
    const has = list.includes(value);
    onChange({
      ...filters,
      [key]: has ? list.filter((v) => v !== value) : [...list, value],
    } as AdvancedFilters);
  }

  const content = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900">المزيد من الفلاتر</h3>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...filters,
              airlines: [],
              departureTimes: [],
              arrivalTimes: [],
              durationBuckets: [],
              travelClasses: [],
            })
          }
          className="text-xs font-semibold text-[#0C7BB3] hover:underline"
        >
          إعادة تعيين
        </button>
      </div>

      {availableAirlines.length > 0 ? (
        <FilterGroup title="شركة الطيران">
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {availableAirlines.map((a) => (
              <Checkbox key={a.code} checked={filters.airlines.includes(a.code)} onChange={() => toggleAirline(a.code)}>
                {a.name}
              </Checkbox>
            ))}
          </div>
        </FilterGroup>
      ) : null}

      <FilterGroup title="وقت المغادرة">
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map((opt) => (
            <ChipToggle
              key={opt.value}
              active={filters.departureTimes.includes(opt.value)}
              onClick={() => toggleIn("departureTimes", opt.value)}
            >
              {opt.label}
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="وقت الوصول">
        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map((opt) => (
            <ChipToggle
              key={opt.value}
              active={filters.arrivalTimes.includes(opt.value)}
              onClick={() => toggleIn("arrivalTimes", opt.value)}
            >
              {opt.label}
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="مدة الرحلة">
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((opt) => (
            <ChipToggle
              key={opt.value}
              active={filters.durationBuckets.includes(opt.value)}
              onClick={() => toggleIn("durationBuckets", opt.value)}
            >
              {opt.label}
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="درجة السفر">
        <div className="flex flex-wrap gap-2">
          {CLASS_OPTIONS.map((opt) => (
            <ChipToggle
              key={opt.value}
              active={filters.travelClasses.includes(opt.value)}
              onClick={() => toggleIn("travelClasses", opt.value)}
            >
              {opt.label}
            </ChipToggle>
          ))}
        </div>
      </FilterGroup>
    </div>
  );

  return (
    <>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <div className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:mx-auto sm:max-w-md sm:rounded-2xl sm:self-center">
            {content}
            <div className="sticky bottom-0 mt-6 flex gap-3 border-t border-slate-100 bg-white pt-4">
              <Button variant="outline" fullWidth onClick={() => onChange(EMPTY_FILTERS)}>
                إعادة تعيين الكل
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
    <div className="border-t border-slate-100 pt-4 first:border-0 first:pt-0">
      <p className="mb-2.5 text-sm font-semibold text-slate-800">{title}</p>
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
