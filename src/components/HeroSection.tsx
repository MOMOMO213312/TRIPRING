import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { OneWayFareBoard } from "./OneWayFareBoard";
import { RoundTripFareBoard } from "./RoundTripFareBoard";
import { HeroFlashDealCard } from "./HeroFlashDealCard";
import { getDestinationImage } from "../lib/api";
import type { TripType } from "../lib/api";
import type { AirportRow, DealRow, ImageCacheRow, RoutePriceReferenceRow } from "../types/database";
import heroSky from "../assets/hero-sky.png";

const HERO_IMAGE = heroSky;

const POPULAR = [
  { from: "CAI", to: "DXB", label: "القاهرة ← دبي" },
  { from: "CAI", to: "IST", label: "القاهرة ← إسطنبول" },
  { from: "CAI", to: "JED", label: "القاهرة ← جدة" },
  { from: "CAI", to: "LHR", label: "القاهرة ← لندن" },
  { from: "CAI", to: "SSH", label: "القاهرة ← شرم الشيخ" },
];

const BUDGET_OPTIONS = [
  { value: "", label: "أي ميزانية" },
  { value: "300", label: "حتى 300$" },
  { value: "500", label: "حتى 500$" },
  { value: "700", label: "حتى 700$" },
  { value: "1000", label: "حتى 1000$" },
];

type Props = {
  airports: AirportRow[];
  deals: DealRow[];
  references: RoutePriceReferenceRow[];
  imageCache: ImageCacheRow[];
  onSearch: (params: { from: string; to: string; date: string; returnDate: string; passengers: number; tripType: TripType; budget: string }) => void;
};

// Hero background photo is intentionally limited to this curated set (per
// request): Saudi Arabia (any city), Dubai specifically, Istanbul
// specifically, and Egypt (domestic — Sharm, Luxor, Aswan, Hurghada, etc.).
// Matched by both the airport's country/city text AND a known IATA-code
// fallback, since exact Arabic spellings in the live `airports` table can't
// be verified from here.
const HERO_COUNTRY_MATCHES = ["السعودية", "المملكة العربية السعودية", "مصر"];
const HERO_CITY_MATCHES = ["دبي", "إسطنبول", "اسطنبول"];
const HERO_CODE_FALLBACK = new Set([
  // Saudi Arabia
  "JED", "RUH", "MED", "DMM", "TUU", "ELQ", "AHB", "TIF", "YNB", "GIZ", "HAS", "AJF", "ULH", "ABT",
  // Dubai
  "DXB",
  // Istanbul
  "IST", "SAW",
  // Egypt (domestic)
  "SSH", "HRG", "LXR", "ASW", "ALY", "HBE", "RMF", "ATZ",
]);

function isHeroEligibleDestination(airport: AirportRow | undefined): boolean {
  if (!airport) return false;
  if (HERO_COUNTRY_MATCHES.includes(airport.country)) return true;
  if (HERO_CITY_MATCHES.includes(airport.city)) return true;
  return HERO_CODE_FALLBACK.has(airport.code);
}

/**
 * Picks one real photo for the currently most in-demand destination (within
 * the curated Saudi Arabia / Dubai / Istanbul / Egypt set) instead of a
 * static stock photo. Ranked by deal_score, then booking/view counts, then
 * price — so whichever of those routes is actually hot right now becomes the
 * hero backdrop. Only uses the same licensed `image_cache` table already
 * used everywhere else in the app (deal cards, TravelToSection, etc.), so no
 * new image licensing is introduced. Falls back to the static hero photo
 * when no real destination photo is available yet (e.g. still loading).
 */
function topDestinationImage(
  deals: DealRow[],
  airports: AirportRow[],
  imageCache: ImageCacheRow[],
): string | null {
  const ranked = [...deals]
    .filter((deal) => isHeroEligibleDestination(airports.find((a) => a.code === deal.to_airport)))
    .sort((a, b) => {
      const scoreDiff = (b.deal_score ?? 0) - (a.deal_score ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      const bookingDiff = (b.booking_count ?? 0) - (a.booking_count ?? 0);
      if (bookingDiff !== 0) return bookingDiff;
      const viewDiff = (b.view_count ?? 0) - (a.view_count ?? 0);
      if (viewDiff !== 0) return viewDiff;
      return a.price - b.price;
    });

  for (const deal of ranked) {
    const airport = airports.find((a) => a.code === deal.to_airport);
    const url = getDestinationImage(airport, imageCache, deal.to_airport);
    if (url) return url;
  }
  return null;
}

function airportLabel(a: AirportRow): string {
  return `${a.city_en ?? a.city} (${a.code})`;
}

/** Matches an airport against a free-text query across code, city (ar/en),
 *  airport name, and country — so typing "دبي", "Dubai", "DXB" or "الإمارات"
 *  all find the same airport. */
function matchesAirportQuery(a: AirportRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    a.code.toLowerCase().includes(q) ||
    a.city.toLowerCase().includes(q) ||
    (a.city_en ?? "").toLowerCase().includes(q) ||
    a.name.toLowerCase().includes(q) ||
    a.country.toLowerCase().includes(q)
  );
}

/** Searchable From/To field: typeahead over the real airports catalog
 *  (code, name, city, country — Arabic and English), same underlying data
 *  and value shape (an IATA code) as the select it replaces. Keeps the
 *  "Anywhere" option that the To field previously exposed. */
function AirportField({
  icon,
  label,
  value,
  onChange,
  airports,
  allowAnywhere,
  className = "",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (code: string) => void;
  airports: AirportRow[];
  allowAnywhere?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = value === "any" ? null : airports.find((a) => a.code === value);
  const displayValue = open
    ? query
    : value === "any"
      ? "أي وجهة"
      : selected
        ? airportLabel(selected)
        : "";

  const results = useMemo(() => {
    if (!open) return [];
    return airports.filter((a) => matchesAirportQuery(a, query)).slice(0, 8);
  }, [airports, query, open]);

  function pick(code: string) {
    onChange(code);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={wrapRef} className={`relative min-w-0 ${className}`}>
      <FieldBox icon={icon} label={label}>
        <input
          type="text"
          value={displayValue}
          placeholder="ابحث بالمدينة أو المطار"
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => setQuery(e.target.value)}
          className="hero-field-input"
          autoComplete="off"
        />
      </FieldBox>

      {open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-100 bg-white p-1.5 shadow-xl">
          {allowAnywhere ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick("any")}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start text-sm font-semibold text-slate-700 hover:bg-[#FFF1EA]"
            >
              <span aria-hidden className="text-slate-400">🌍</span>
              أي وجهة
            </button>
          ) : null}
          {results.length > 0 ? (
            results.map((a) => (
              <button
                key={a.code}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(a.code)}
                className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-start hover:bg-[#FFF1EA]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {a.city_en ?? a.city}
                    <span className="text-slate-400"> · {a.name}</span>
                  </span>
                  <span className="block truncate text-xs text-slate-400">{a.country}</span>
                </span>
                <span className="font-latin shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-500">
                  {a.code}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2.5 text-sm text-slate-400">لا توجد نتائج مطابقة</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Compact passengers stepper — same underlying value (a single passenger
 *  count, 1–6) as the select it replaces, just presented as a +/- control
 *  instead of a dropdown list. */
function TravelersField({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-start">
        <FieldBox icon="👤" label="المسافرون">
          <span className="hero-field-input flex items-center justify-between gap-1">
            <span className="truncate">
              {value} {value === 1 ? "مسافر" : "مسافرين"}
            </span>
            <span aria-hidden className="shrink-0 text-xs font-bold text-slate-400">
              ▾
            </span>
          </span>
        </FieldBox>
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-slate-700">عدد المسافرين</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onChange(Math.max(1, value - 1))}
                disabled={value <= 1}
                className="flex size-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-[#FF7A45] hover:text-[#FF7A45] disabled:opacity-30"
                aria-label="تقليل عدد المسافرين"
              >
                −
              </button>
              <span className="font-latin w-4 text-center text-sm font-bold text-slate-800">{value}</span>
              <button
                type="button"
                onClick={() => onChange(Math.min(6, value + 1))}
                disabled={value >= 6}
                className="flex size-8 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-[#FF7A45] hover:text-[#FF7A45] disabled:opacity-30"
                aria-label="زيادة عدد المسافرين"
              >
                +
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function HeroSection({ airports, deals, references, imageCache, onSearch }: Props) {
  const [tripType, setTripType] = useState<TripType>("round_trip");
  const [from, setFrom] = useState("CAI");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [budget, setBudget] = useState("");
  const [swapped, setSwapped] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Hero background is intentionally always the custom illustrated skyline
  // (HERO_IMAGE) rather than a live per-deal destination photo — the real
  // photos in `image_cache` are plain sky/cloud stock shots that look just
  // as empty as the old default, so swapping to one on load made the hero
  // flash the new artwork for an instant and then fall back to a bare-sky
  // photo. `deals`/`airports`/`imageCache` are still accepted as props
  // (used elsewhere below, e.g. HeroFlashDealCard) but no longer drive the
  // background image.
  void imageCache;

  function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    onSearch({ from, to, date, returnDate, passengers, tripType, budget });
    // Purely a brief visual acknowledgement — the actual navigation below is
    // synchronous (client-side route change), so this never blocks it.
    window.setTimeout(() => setSubmitting(false), 600);
  }

  return (
    <>
      {/* One-way ticker stays pinned to the very top of the hero, in normal
         document flow — kept OUTSIDE the hero photo's relatively-positioned
         section below so the absolutely-positioned photo layer can never
         overlap or cover it. */}
      <OneWayFareBoard deals={deals} references={references} airports={airports} />

      <section className="relative overflow-hidden bg-[#F7F8FA]">
        <div className="absolute inset-0 h-[420px] sm:h-[460px]">
          <img
            src={HERO_IMAGE}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Deep navy wash for legibility — a single calm gradient instead
             of a busy multi-tile collage, per the "clean, premium, no
             clutter" direction: strongest over the text side, fading out
             toward the opposite edge, then handing off softly into the page
             background at the very bottom. */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-[#0B1B2B]/25 via-[#0B1B2B]/55 to-[#0B1B2B]/80 rtl:bg-gradient-to-r" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-[#F7F8FA]" />

          {/* Flash-deal corner card — real, data-driven urgency (an actual
             expiring deal), kept as the hero's only "trust badge" so the
             rest of the hero can stay uncluttered. */}
          <div className="absolute end-5 top-5 z-10 hidden sm:block">
            <HeroFlashDealCard deals={deals} airports={airports} />
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-36 pt-12 sm:pb-40 sm:pt-16">
          <div className="max-w-xl text-start">
            <h1
              className="font-cairo text-4xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl sm:leading-[1.1]"
              style={{ textShadow: "0 4px 28px rgba(0,0,0,0.45)" }}
            >
              اكتشف أفضل فرص السفر بأفضل الأسعار
            </h1>
            <p
              className="mt-4 max-w-md text-base leading-relaxed text-white/85 sm:text-lg"
              style={{ textShadow: "0 1px 16px rgba(0,0,0,0.35)" }}
            >
              اكتشف الرحلات والعروض التي تستحق الحجز، وقارن أفضل الفرص في مكان واحد.
            </p>
          </div>

          {/* Compact flash-deal card for small screens, right under the
             headline instead of floating in the corner (no room for that
             there below `sm`). */}
          <div className="mt-5 max-w-[260px] sm:hidden">
            <HeroFlashDealCard deals={deals} airports={airports} />
          </div>
        </div>

        {/* Search card pulled up to overlap the bottom of the hero photo.
           The headline block above reserves fixed bottom padding
           (pb-36 / sm:pb-40) that comfortably exceeds this negative margin,
           so the card can never cover the headline or subheadline text. */}
        <div className="relative z-20 mx-auto max-w-5xl px-4">
          <div className="animate-hero-card-in -mt-24 rounded-[28px] bg-white p-4 shadow-2xl shadow-slate-900/20 ring-1 ring-black/[0.03] sm:-mt-28 sm:p-5">
            {/* Trip-type segmented control */}
            <div className="mb-4 inline-flex rounded-full bg-slate-100 p-1">
              {(
                [
                  ["round_trip", "ذهاب وعودة"],
                  ["one_way", "ذهاب فقط"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTripType(key)}
                  className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                    tripType === key ? "bg-white text-[#FF7A45] shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={submit}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-0 lg:divide-x lg:divide-slate-100 rtl:lg:divide-x-reverse lg:rounded-2xl lg:border lg:border-slate-100">
                <AirportField
                  icon="🛫"
                  label="من"
                  value={from}
                  onChange={setFrom}
                  airports={airports}
                  className="lg:flex-1"
                />

                <div className="flex h-9 shrink-0 items-center justify-center lg:h-auto lg:w-10">
                  <button
                    type="button"
                    onClick={() => {
                      setFrom(to === "any" ? from : to);
                      setTo(from);
                      setSwapped((s) => !s);
                    }}
                    aria-label="تبديل الوجهتين"
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition duration-300 hover:border-[#FF7A45] hover:text-[#FF7A45] ${
                      swapped ? "rotate-[270deg]" : "rotate-90"
                    } lg:rotate-0`}
                  >
                    ⇄
                  </button>
                </div>

                <AirportField
                  icon="🛬"
                  label="إلى"
                  value={to}
                  onChange={setTo}
                  airports={airports}
                  allowAnywhere
                  className="lg:flex-1"
                />

                <FieldBox icon="📅" label="تاريخ الذهاب" className="lg:flex-1">
                  <input
                    type="date"
                    dir="ltr"
                    value={date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDate(e.target.value)}
                    className="hero-field-input text-start"
                  />
                </FieldBox>

                {tripType === "round_trip" ? (
                  <FieldBox icon="📅" label="تاريخ العودة" className="lg:flex-1">
                    <input
                      type="date"
                      dir="ltr"
                      value={returnDate}
                      min={date || new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="hero-field-input text-start"
                    />
                  </FieldBox>
                ) : null}

                <div className="lg:w-56 lg:shrink-0">
                  <TravelersField value={passengers} onChange={setPassengers} />
                </div>
              </div>

              <div className="mt-3 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Budget kept as a real, functioning filter — de-emphasized
                   to a small secondary control so it doesn't compete with
                   the primary route/date fields above. */}
                <label className="flex items-center gap-2 text-sm text-slate-500">
                  <span aria-hidden>💰</span>
                  <select
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-slate-600 outline-none"
                  >
                    {BUDGET_OPTIONS.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-[#FF7A45] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#FFD4C2] transition hover:-translate-y-0.5 hover:bg-[#F0642F] hover:shadow-xl active:scale-[0.98] active:translate-y-0 disabled:opacity-80 sm:w-auto"
                >
                  {submitting ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
                      جارِ البحث عن الفرص...
                    </>
                  ) : (
                    <>
                      <span aria-hidden>🔍</span>
                      ابحث الآن
                    </>
                  )}
                </button>
              </div>
            </form>

            <p className="mt-3 text-center text-xs font-medium text-slate-400 sm:text-start">
              عروض ذكية · أسعار أفضل · حجز سهل
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">عمليات بحث شائعة:</span>
            {POPULAR.map((p) => (
              <Link
                key={`${p.from}-${p.to}`}
                to={`/search?from=${p.from}&to=${p.to}`}
                className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-[#FF7A45] hover:bg-[#FFEDE3] hover:text-[#FF7A45]"
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Round-trip ticker now takes the "LIVE DEALS" ticker's old spot,
           directly under the search box — full-bleed like the one-way board
           above, with a clear gap (mt-8) so it never visually crowds the
           search card sitting right above it. Its own independent,
           overflow-clipped container keeps the scrolling marquee (labels,
           prices, indicator dot) fully contained even if the section above
           it changes height — nothing here can bleed into the header or
           hero photo. */}
        <div className="relative isolate z-0 mt-8 w-full overflow-hidden pb-6">
          <RoundTripFareBoard deals={deals} references={references} airports={airports} />
        </div>
      </section>
    </>
  );
}

/** Two-line "label above value" field, the same pattern Google Flights /
 *  Skyscanner use: a small muted eyebrow line (icon + label) on top, the
 *  actual value large and bold underneath. Kept as one shared shell so every
 *  field in the search card — airports, dates, travelers — lines up with
 *  identical height, padding and rhythm instead of each one improvising its
 *  own spacing. */
function FieldBox({
  icon,
  label,
  children,
  className = "",
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 rounded-xl border border-slate-100 bg-white px-4 py-3 transition focus-within:border-[#FF7A45] focus-within:ring-2 focus-within:ring-[#FFEDE3] lg:rounded-none lg:border-0 lg:py-3.5 ${className}`}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
        <span aria-hidden className="text-[13px] leading-none">
          {icon}
        </span>
        {label}
      </p>
      <div className="mt-1.5 min-w-0">{children}</div>
    </div>
  );
}
