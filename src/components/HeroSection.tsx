import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
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
  { value: "", label: "Any budget" },
  { value: "300", label: "Up to $300" },
  { value: "500", label: "Up to $500" },
  { value: "700", label: "Up to $700" },
  { value: "1000", label: "Up to $1000" },
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
      {a.city_en ?? a.city} ({a.code})
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

      {/* Search box pulled up to overlap the bottom of the hero photo. The
         headline block above now reserves fixed bottom padding (pb-40 /
         sm:pb-44) that comfortably exceeds this negative margin, so the card
         can never cover the headline or subheadline text. */}
      <div className="relative z-10 mx-auto max-w-5xl px-4">
        <div className="-mt-28 overflow-visible rounded-[24px] bg-[#FBF9F4] p-4 shadow-2xl shadow-slate-900/15 ring-1 ring-black/[0.04] sm:-mt-32 sm:p-5">
          {/* Trip-type tabs as an underline segmented control (a boarding
             pass' "class" selector, not a generic pill switcher) — the
             active tab's indicator uses the CTA orange so tab selection and
             the search button read as one connected action. */}
          <div className="mb-3 flex gap-5 border-b border-slate-100 px-0.5">
            {(
              [
                ["round_trip", "↔️", "ذهاب وعودة"],
                ["one_way", "✈️", "ذهاب فقط"],
                ["multi_city", "🧭", "مدن متعددة"],
              ] as const
            ).map(([key, icon, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTripType(key)}
                className={`relative flex items-center gap-1.5 pb-2.5 pt-1 text-sm font-bold transition ${
                  tripType === key ? "text-[#FF7A45]" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <span aria-hidden className="text-xs">
                  {icon}
                </span>
                {label}
                {tripType === key ? (
                  <span aria-hidden className="absolute inset-x-0 -bottom-px h-[3px] rounded-full bg-[#FF7A45]" />
                ) : null}
              </button>
            ))}
          </div>

          {/* Boarding-pass layout: route/date fields sit in the "flight
             segment" of the ticket, a perforated tear-line (dashed rule +
             two edge notches) splits it from the "stub" holding
             budget/passengers/search — mirroring how a real paper ticket
             separates the flight details from the tear-off stub, instead of
             a generic bordered form card. */}
          <form onSubmit={submit}>
            <div className="flex flex-col divide-y divide-slate-100 lg:flex-row lg:items-stretch lg:divide-x lg:divide-y-0 rtl:lg:divide-x-reverse">
              <FieldBox icon="📍" label="From" className="lg:flex-1">
                <select value={from} onChange={(e) => setFrom(e.target.value)} className="hero-field-select">
                  {airportOptions}
                </select>
              </FieldBox>

              <div className="flex h-8 shrink-0 items-center justify-center lg:h-auto lg:w-10">
                <button
                  type="button"
                  onClick={() => {
                    setFrom(to);
                    setTo(from);
                  }}
                  aria-label="تبديل الوجهتين"
                  className="flex size-8 shrink-0 rotate-90 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-[#FF7A45] hover:text-[#FF7A45] lg:rotate-0"
                >
                  ⇄
                </button>
              </div>

              <FieldBox icon="📍" label="To" className="lg:flex-1">
                <select value={to} onChange={(e) => setTo(e.target.value)} className="hero-field-select">
                  <option value="">Select destination</option>
                  <option value="any">Anywhere</option>
                  {airportOptions}
                </select>
              </FieldBox>

              <FieldBox icon="📅" label="When" className="lg:flex-1">
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDate(e.target.value)}
                    className="hero-field-input"
                  />
                  {/* Native date inputs render their empty state in the
                     browser's own locale (often "mm/dd"). Cover it with a
                     fixed English label until a date is actually picked —
                     pointer-events-none so the click still opens the native
                     picker underneath. */}
                  {!date && (
                    <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center bg-[#FBF9F4] text-sm font-semibold text-slate-800">
                      Flexible dates
                    </span>
                  )}
                </div>
              </FieldBox>

              {tripType === "round_trip" ? (
                <FieldBox icon="📅" label="Return" className="lg:flex-1">
                  <div className="relative">
                    <input
                      type="date"
                      value={returnDate}
                      min={date || new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="hero-field-input"
                    />
                    {!returnDate && (
                      <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center bg-[#FBF9F4] text-sm font-semibold text-slate-800">
                        Flexible dates
                      </span>
                    )}
                  </div>
                </FieldBox>
              ) : null}
            </div>

            {/* Perforated tear-line — sized to its own thin strip so its
               position never depends on how tall the rows above/below it
               are (they reflow a lot between mobile-stacked and desktop).
               The two notch circles match the card's own paper color, so
               they read as punched-through cutouts at the card's edges. */}
            <div className="relative my-1">
              <div className="border-t-2 border-dashed border-slate-200" />
              <span
                aria-hidden
                className="absolute left-0 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FBF9F4] ring-1 ring-black/[0.04]"
              />
              <span
                aria-hidden
                className="absolute right-0 top-1/2 size-5 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FBF9F4] ring-1 ring-black/[0.04]"
              />
            </div>

            <div className="flex flex-col divide-y divide-slate-100 lg:flex-row lg:items-stretch lg:divide-x lg:divide-y-0 rtl:lg:divide-x-reverse">
              <FieldBox
                icon="💰"
                label="Budget"
                trailingIcon="▾"
                className="lg:w-56 lg:shrink-0 lg:flex-none cursor-pointer hover:bg-[#FFEDE3]/40"
              >
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="hero-field-select cursor-pointer"
                >
                  {BUDGET_OPTIONS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </FieldBox>

              <FieldBox
                icon="👤"
                label="Passengers"
                trailingIcon="▾"
                className="lg:w-56 lg:shrink-0 lg:flex-none cursor-pointer hover:bg-[#FFEDE3]/40"
              >
                <select
                  value={passengers}
                  onChange={(e) => setPassengers(Number(e.target.value))}
                  className="hero-field-select cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "Passenger" : "Passengers"}
                    </option>
                  ))}
                </select>
              </FieldBox>

              <div className="p-2 lg:flex lg:flex-1 lg:items-center lg:p-1.5">
                <button
                  type="submit"
                  className="ticket-stub-btn group relative flex w-full shrink-0 items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#FF7A45] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#FFD4C2] transition hover:-translate-y-0.5 hover:bg-[#F0642F] hover:shadow-xl active:scale-[0.98] active:translate-y-0 lg:h-full lg:w-full lg:rounded-2xl"
                >
                  {/* Barcode strip — a quiet nod to the ticket-stub motif,
                     tucked along the button's own edge rather than
                     competing with the label. */}
                  <span aria-hidden className="ticket-barcode absolute inset-y-0 end-0 w-9 opacity-25" />
                  <span aria-hidden>🔍</span> دوّر على أفضل عرض
                </button>
              </div>
            </div>
          </form>

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
  trailingIcon,
  children,
  className = "",
}: {
  icon: string;
  label: string;
  trailingIcon?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 px-3.5 py-2.5 transition focus-within:bg-[#FFEDE3]/40 ${className}`}
    >
      <span className="shrink-0 text-slate-400" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-ticket text-[10px] tracking-[0.12em] text-slate-400">{label}</p>
        {children}
      </div>
      {trailingIcon ? (
        <span className="shrink-0 text-sm font-bold text-slate-400" aria-hidden>
          {trailingIcon}
        </span>
      ) : null}
    </div>
  );
}
