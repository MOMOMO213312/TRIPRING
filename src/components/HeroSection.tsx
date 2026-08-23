import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { OneWayFareBoard } from "./OneWayFareBoard";
import { RoundTripFareBoard } from "./RoundTripFareBoard";
import { HeroFlashDealCard } from "./HeroFlashDealCard";
import { getDestinationImage } from "../lib/api";
import type { TripType } from "../lib/api";
import type { AirportRow, DealRow, ImageCacheRow, RoutePriceReferenceRow } from "../types/database";
import heroSky from "../assets/hero-sky.jpg";

const HERO_IMAGE = heroSky;
const MAX_ROTATING_IMAGES = 4;
const ROTATE_INTERVAL_MS = 6000;

const POPULAR = [
  { from: "CAI", to: "DXB", label: "القاهرة ← دبي" },
  { from: "CAI", to: "IST", label: "القاهرة ← إسطنبول" },
  { from: "CAI", to: "JED", label: "القاهرة ← جدة" },
  { from: "CAI", to: "LHR", label: "القاهرة ← لندن" },
  { from: "CAI", to: "SSH", label: "القاهرة ← شرم الشيخ" },
];

const BUDGET_OPTIONS = [
  { value: "", label: "بدون حد" },
  { value: "300", label: "حتى $300" },
  { value: "500", label: "حتى $500" },
  { value: "700", label: "حتى $700" },
  { value: "1000", label: "حتى $1000" },
];

const TRIP_TABS = [
  { key: "round_trip" as const, label: "ذهاب وعودة", Icon: IconRoundTrip },
  { key: "one_way" as const, label: "ذهاب فقط", Icon: IconOneWay },
  { key: "multi_city" as const, label: "مدن متعددة", Icon: IconMultiCity },
];

type Props = {
  airports: AirportRow[];
  deals: DealRow[];
  references: RoutePriceReferenceRow[];
  imageCache: ImageCacheRow[];
  onSearch: (params: { from: string; to: string; date: string; returnDate: string; passengers: number; tripType: TripType; budget: string }) => void;
};

type HeroDestinationImage = { code: string; city: string; url: string };

// Hero rotation is intentionally limited to these four destinations (per request):
// Saudi Arabia (any city), Dubai specifically, Istanbul specifically, and Egypt
// (domestic — Sharm, Luxor, Aswan, Hurghada, etc.). Matched by both the airport's
// country/city text AND a known IATA-code fallback, since exact Arabic spellings
// in the live `airports` table can't be verified from here.
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
 * Picks real photos for the currently most in-demand destinations (within the
 * curated Saudi Arabia / Dubai / Istanbul / Egypt set) instead of one static
 * stock photo. Ranked by deal_score, then booking/view counts, then price — so
 * whichever of those routes is actually hot right now shows up in the hero.
 * Only uses the same licensed `image_cache` table already used everywhere else
 * in the app (deal cards, TravelToSection, etc.), so no new image licensing is
 * introduced.
 */
function topDestinationImages(
  deals: DealRow[],
  airports: AirportRow[],
  imageCache: ImageCacheRow[],
  limit: number,
): HeroDestinationImage[] {
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

  const seen = new Set<string>();
  const result: HeroDestinationImage[] = [];
  for (const deal of ranked) {
    if (seen.has(deal.to_airport)) continue;
    seen.add(deal.to_airport);
    const airport = airports.find((a) => a.code === deal.to_airport);
    const url = getDestinationImage(airport, imageCache, deal.to_airport);
    if (url && airport) result.push({ code: deal.to_airport, city: airport.city, url });
    if (result.length >= limit) break;
  }
  return result;
}

export function HeroSection({ airports, deals, references, imageCache, onSearch }: Props) {
  const [tripType, setTripType] = useState<TripType>("round_trip");
  const [from, setFrom] = useState("CAI");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [budget, setBudget] = useState("");

  const [heroImages, setHeroImages] = useState<HeroDestinationImage[]>([]);
  const [activeImage, setActiveImage] = useState(0);

  // Re-rank whenever fresh deal/catalog data lands (deals arrive async after first paint).
  useEffect(() => {
    setHeroImages(topDestinationImages(deals, airports, imageCache, MAX_ROTATING_IMAGES));
  }, [deals, airports, imageCache]);

  // Auto-rotate between the top destinations. Respects prefers-reduced-motion,
  // and simply does nothing (single static photo) if fewer than 2 real photos
  // were found — e.g. an empty/dev image_cache.
  useEffect(() => {
    if (heroImages.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setActiveImage((i) => (i + 1) % heroImages.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [heroImages]);

  const airportOptions = airports.map((a) => (
    <option key={a.code} value={a.code}>
      {a.city} ({a.code})
    </option>
  ));

  function submit(e: FormEvent) {
    e.preventDefault();
    onSearch({ from, to, date, returnDate, passengers, tripType, budget });
  }

  return (
    <>
      {/* One-way ticker stays pinned to the very top of the hero, in normal
         document flow — kept OUTSIDE the hero photo's relatively-positioned
         section below so the absolutely-positioned photo layer can never
         overlap or cover it. */}
      <OneWayFareBoard deals={deals} references={references} airports={airports} />

      <section className="relative overflow-hidden bg-[#F7F8FA]">
        <div className="absolute inset-0 h-[400px] sm:h-[440px]">
          {/* Static fallback stays as the base layer so there's never a blank
             flash while the first real destination photo loads, and it's all
             that renders if image_cache has nothing usable yet. */}
          <img src={HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full object-cover" />
          {heroImages.map((img, i) => (
            <img
              key={img.code}
              src={img.url}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
                i === activeImage ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          {/* Daytime wing-over-clouds shot (or whichever destination photo is
             active) carries bright natural color, so the overlay's job is just
             to guarantee the headline stays legible over it — a dark wash on
             the text side that fades to nothing by mid-photo, then a soft
             handoff into the page background at the very bottom so the photo
             still reads as a hero, not a washed-out panel. */}
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-black/10 to-black/60 rtl:bg-gradient-to-r" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#F7F8FA]" />

          {heroImages.length > 0 ? (
            <div className="absolute start-4 top-4 z-10 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              ✈ {heroImages[activeImage]?.city}
            </div>
          ) : null}

          {/* Flash-deal corner card — mirrors the "end" side (opposite the
             headline) so it works the same way in RTL as the reference's
             top-right countdown card does in LTR. */}
          <div className="absolute end-4 top-4 z-10 hidden sm:block">
            <HeroFlashDealCard deals={deals} airports={airports} />
          </div>

          {heroImages.length > 1 ? (
            <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
              {heroImages.map((img, i) => (
                <button
                  key={img.code}
                  type="button"
                  aria-label={`عرض صورة ${img.city}`}
                  onClick={() => setActiveImage(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === activeImage ? "w-6 bg-white" : "w-1.5 bg-white/50"
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-40 pt-10 sm:pb-44 sm:pt-14">
        <div className="max-w-xl text-start">
          <h1
            className="font-display text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl"
            style={{ textShadow: "0 4px 28px rgba(0,0,0,0.5)" }}
          >
            اكتشف افضل فرص السفر يوميا
          </h1>
          <p
            className="mt-3 max-w-md text-base text-white/90 sm:text-lg"
            style={{ textShadow: "0 1px 16px rgba(0,0,0,0.4)" }}
          >
            تجربة تستحق البحث
          </p>
          <p className="mt-2 text-sm font-semibold text-[#FF7A45]" style={{ textShadow: "0 1px 12px rgba(0,0,0,0.4)" }}>
            مقاعد محدودة. وقت محدود.
          </p>
        </div>

        {/* Compact flash-deal card for small screens, right under the
           headline instead of floating in the corner (no room for that
           there below `sm`). */}
        <div className="mt-5 max-w-[260px] sm:hidden">
          <HeroFlashDealCard deals={deals} airports={airports} />
        </div>
      </div>

      {/* Search panel: fixed box model per design spec (width/max-width,
         padding, radius, shadow) with a translateY(50px) nudge to sit lower
         than its normal flow position, layered above the hero photo via
         z-10. */}
      <div className="relative z-10 mx-auto w-[min(1240px,calc(100%_-_48px))] min-h-[140px] max-w-[1240px] translate-y-[50px] rounded-[24px] bg-white px-5 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <div className="mb-4 flex w-fit gap-1 rounded-full bg-slate-100 p-1">
          {TRIP_TABS.map(({ key, Icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTripType(key)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                tripType === key
                  ? "bg-white text-[#0C7BB3] shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span aria-hidden className={tripType === key ? "text-[#0C7BB3]" : "text-slate-400"}>
                <Icon />
              </span>
              {label}
            </button>
          ))}
        </div>

        {/* Fields sit as individually-bordered white cards inside a tinted
           tray (not one hairline-divided strip) — gives each field real
           breathing room instead of a cramped continuous bar. The primary
           CTA is now its own full-width row below the tray, so it never
           has to compete with 6 fields for horizontal space. */}
        <form onSubmit={submit} className="space-y-3">
          <div className="rounded-[22px] bg-slate-50 p-2 sm:p-2.5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
              <FieldBox icon={<IconPin />} label="من" className="lg:flex-[1.15]">
                <select value={from} onChange={(e) => setFrom(e.target.value)} className="hero-field-select">
                  {airportOptions}
                </select>
              </FieldBox>

              <div className="flex h-6 shrink-0 items-center justify-center lg:h-auto lg:w-6">
                <button
                  type="button"
                  onClick={() => {
                    setFrom(to);
                    setTo(from);
                  }}
                  aria-label="تبديل الوجهتين"
                  className="flex size-9 shrink-0 rotate-90 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:-translate-y-0.5 hover:border-[#0C7BB3] hover:text-[#0C7BB3] hover:shadow-md active:scale-95 lg:rotate-0"
                >
                  <IconSwap />
                </button>
              </div>

              <FieldBox icon={<IconPin />} label="إلى" className="lg:flex-[1.15]">
                <select value={to} onChange={(e) => setTo(e.target.value)} className="hero-field-select">
                  <option value="">اختر الوجهة</option>
                  <option value="any">أي مكان</option>
                  {airportOptions}
                </select>
              </FieldBox>

              <FieldBox icon={<IconCalendar />} label="المغادرة" className="lg:flex-1">
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDate(e.target.value)}
                    className="hero-field-input"
                  />
                  {/* Native date inputs render their empty state in the
                     browser's own locale. Cover it with a fixed Arabic
                     label until a date is actually picked —
                     pointer-events-none so the click still opens the
                     native picker underneath. */}
                  {!date && (
                    <span className="hero-field-select pointer-events-none absolute inset-y-0 start-0 flex items-center bg-white">
                      اختر التاريخ
                    </span>
                  )}
                </div>
              </FieldBox>

              {tripType === "round_trip" ? (
                <FieldBox icon={<IconCalendar />} label="العودة" className="lg:flex-1">
                  <div className="relative">
                    <input
                      type="date"
                      value={returnDate}
                      min={date || new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="hero-field-input"
                    />
                    {!returnDate && (
                      <span className="hero-field-select pointer-events-none absolute inset-y-0 start-0 flex items-center bg-white">
                        اختر التاريخ
                      </span>
                    )}
                  </div>
                </FieldBox>
              ) : null}

              <PassengerBudgetField
                passengers={passengers}
                setPassengers={setPassengers}
                budget={budget}
                setBudget={setBudget}
              />
            </div>
          </div>

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF7A45] py-4 text-[15px] font-bold text-white shadow-lg shadow-[#FFD4C2] transition hover:-translate-y-0.5 hover:bg-[#F0642F] hover:shadow-xl active:scale-[0.98] active:translate-y-0"
          >
            <IconSearch /> اعثر على أفضل عرض
          </button>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">عمليات بحث شائعة:</span>
          {POPULAR.map((p) => (
            <Link
              key={`${p.from}-${p.to}`}
              to={`/search?from=${p.from}&to=${p.to}`}
              className="flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-[#0C7BB3] hover:bg-[#E5F4FB] hover:text-[#0C7BB3]"
            >
              <span aria-hidden className="text-slate-400">
                <IconOneWay />
              </span>
              {p.label}
            </Link>
          ))}
        </div>
        </div>

      {/* Round-trip ticker now takes the "LIVE DEALS" ticker's old spot,
         directly under the search box — full-bleed like the one-way board
         above, with a clear gap (mt-8) so it never visually crowds the trip-
         type tabs or the search fields sitting right above it. Its own
         independent, overflow-clipped container keeps the scrolling marquee
         (labels, prices, indicator dot) fully contained even if the section
         above it changes height — nothing here can bleed into the header or
         hero photo. */}
      <div className="relative isolate z-0 mt-6 w-full overflow-hidden pb-6">
        <RoundTripFareBoard deals={deals} references={references} airports={airports} />
      </div>
      </section>
    </>
  );
}

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
      className={`flex min-w-0 items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition focus-within:border-[#0C7BB3] focus-within:shadow-sm focus-within:shadow-[#BFE3F6] hover:border-[#0C7BB3]/50 ${className}`}
    >
      <span className="shrink-0 text-slate-400" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="hero-field-label">{label}</p>
        {children}
      </div>
    </div>
  );
}

/** Combined "Passengers" field: a single button that opens a popover with a
 *  +/- passenger-count stepper and the (pre-existing) max-budget filter,
 *  rather than two separate dropdowns crowding the main row. Keeps the exact
 *  same `passengers`/`budget` state and onSearch payload as before — this is
 *  a presentation change only, no new search params. */
function PassengerBudgetField({
  passengers,
  setPassengers,
  budget,
  setBudget,
}: {
  passengers: number;
  setPassengers: (n: number) => void;
  budget: string;
  setBudget: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const budgetLabel = BUDGET_OPTIONS.find((b) => b.value === budget)?.label;

  return (
    <div ref={ref} className="relative lg:w-64 lg:shrink-0 lg:flex-none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full min-w-0 items-center gap-2.5 rounded-2xl border bg-white px-4 py-3 text-start transition hover:border-[#0C7BB3]/50 ${
          open ? "border-[#0C7BB3] shadow-sm shadow-[#BFE3F6]" : "border-slate-200"
        }`}
      >
        <span className="shrink-0 text-slate-400" aria-hidden>
          <IconUsers />
        </span>
        <span className="min-w-0 flex-1">
          <p className="hero-field-label">المسافرون</p>
          <p className="hero-field-select truncate">
            {passengers} {passengers === 1 ? "مسافر" : "مسافرين"}
            {budgetLabel ? <span className="font-medium text-slate-400"> · {budgetLabel}</span> : null}
          </p>
        </span>
        <span className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>
          <IconChevronDown />
        </span>
      </button>

      {open ? (
        <div className="absolute end-0 top-full z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-800">عدد المسافرين</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPassengers(Math.max(1, passengers - 1))}
                disabled={passengers <= 1}
                aria-label="تقليل عدد المسافرين"
                className="flex size-8 items-center justify-center rounded-full border border-slate-200 text-lg leading-none text-slate-500 transition hover:border-[#0C7BB3] hover:text-[#0C7BB3] disabled:opacity-30"
              >
                −
              </button>
              <span className="font-latin w-4 text-center text-sm font-bold text-slate-900">{passengers}</span>
              <button
                type="button"
                onClick={() => setPassengers(Math.min(9, passengers + 1))}
                disabled={passengers >= 9}
                aria-label="زيادة عدد المسافرين"
                className="flex size-8 items-center justify-center rounded-full border border-slate-200 text-lg leading-none text-slate-500 transition hover:border-[#0C7BB3] hover:text-[#0C7BB3] disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm font-bold text-slate-800">أقصى ميزانية</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BUDGET_OPTIONS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => setBudget(b.value)}
                  className={`smart-chip !px-3 !py-1.5 !text-xs ${budget === b.value ? "smart-chip-active" : ""}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => setOpen(false)} className="cta-primary mt-4 w-full py-2 text-sm">
            تم
          </button>
        </div>
      ) : null}
    </div>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s7-6.6 7-12a7 7 0 1 0-14 0c0 5.4 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6" />
      <circle cx="17" cy="8.5" r="2.5" />
      <path d="M20.5 20c0-2.8-1.6-5-4-5.7" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </svg>
  );
}

function IconSwap() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 7h11l-3.2-3.2M17 17H6l3.2 3.2" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function IconRoundTrip() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  );
}

function IconOneWay() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12h17M14 5l6 7-6 7" />
    </svg>
  );
}

function IconMultiCity() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="5" cy="7" r="2" />
      <circle cx="19" cy="7" r="2" />
      <circle cx="12" cy="18" r="2" />
      <path d="M7 7h10M6.5 8.7L10.5 16M17.5 8.7L13.5 16" />
    </svg>
  );
}
