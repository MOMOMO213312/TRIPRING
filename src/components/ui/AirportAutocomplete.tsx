import { useEffect, useMemo, useState } from "react";

import { cn } from "../../lib/utils";
import type { AirportRow } from "../../types/database";

type Props = {
  label: string;
  value: string;
  onChange: (code: string) => void;
  airports: AirportRow[];
  placeholder?: string;
  /** If true, an empty query is a valid selection (clears value to ""). Used for "أي وجهة". */
  allowClear?: boolean;
  error?: string;
};

function airportDisplay(a: AirportRow): string {
  return `${a.city} (${a.code})`;
}

/**
 * Flight-search-style route field: type-ahead by city/airport/code instead of
 * scrolling a plain <select> with 100+ airports. Matches the "من"/"إلى"
 * fields on real flight search engines (Skyscanner/Google Flights), which is
 * the reference UX for the TripGo search bar.
 */
export function AirportAutocomplete({ label, value, onChange, airports, placeholder, allowClear, error }: Props) {
  const selected = airports.find((a) => a.code === value) ?? null;
  const [query, setQuery] = useState(selected ? airportDisplay(selected) : "");
  const [open, setOpen] = useState(false);

  // Keep the visible text in sync when the value changes from outside this
  // input (e.g. the from/to swap button).
  useEffect(() => {
    const current = airports.find((a) => a.code === value) ?? null;
    setQuery(current ? airportDisplay(current) : "");
  }, [value, airports]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const isCurrentSelection = selected && query === airportDisplay(selected);
    if (!q || isCurrentSelection) return airports.slice(0, 8);
    return airports
      .filter((a) => [a.city, a.city_en ?? "", a.name, a.code, a.country].some((f) => f.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [airports, query, selected]);

  function revertToSelection() {
    const current = airports.find((a) => a.code === value) ?? null;
    setQuery(current ? airportDisplay(current) : "");
  }

  return (
    <div className="relative">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <input
          type="text"
          value={query}
          placeholder={placeholder ?? "المدينة أو المطار"}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (allowClear && e.target.value.trim() === "") onChange("");
          }}
          onBlur={() => {
            // Delay so a click on a dropdown option still registers before we close/revert.
            window.setTimeout(() => {
              setOpen(false);
              revertToSelection();
            }, 150);
          }}
          className={cn(
            "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-[#BFE3F6]",
            error && "border-red-300 focus:border-red-400 focus:ring-red-100",
          )}
        />
      </label>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}

      {open && results.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {allowClear ? (
            <li>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange("");
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center px-3 py-2 text-start text-sm text-slate-500 hover:bg-slate-50"
              >
                أي وجهة
              </button>
            </li>
          ) : null}
          {results.map((a) => (
            <li key={a.code}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(a.code);
                  setQuery(airportDisplay(a));
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-800">
                  {a.city} <span className="text-slate-400">· {a.country}</span>
                </span>
                <span className="font-latin text-xs font-bold text-slate-500">{a.code}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
