import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { DealTicker } from "./DealTicker";
import { FareBoard } from "./FareBoard";
import { OneWayFareBoard } from "./OneWayFareBoard";
import { RoundTripFareBoard } from "./RoundTripFareBoard";
import { getTypicalPrice } from "../lib/api";
import { airportLabel, savingsPercent } from "../lib/deal-utils";
import { hoursUntil } from "../lib/filters";
import type { AirportRow, DealRow, RoutePriceReferenceRow } from "../types/database";

const HERO_IMAGE =
  "https://images.pexels.com/photos/912050/pexels-photo-912050.jpeg?auto=compress&cs=tinysrgb&w=1600";

const POPULAR = [
  { from: "CAI", to: "DXB", label: "القاهرة ← دبي" },
  { from: "CAI", to: "IST", label: "القاهرة ← إسطنبول" },
  { from: "CAI", to: "JED", label: "القاهرة ← جدة" },
  { from: "CAI", to: "LHR", label: "القاهرة ← لندن" },
  { from: "CAI", to: "SSH", label: "القاهرة ← شرم الشيخ" },
];

type TripTab = "round_trip" | "one_way" | "multi_city";

type Props = {
  airports: AirportRow[];
  deals: DealRow[];
  references: RoutePriceReferenceRow[];
  onSearch: (params: { from: string; to: string; date: string; returnDate: string; passengers: number; tripType: TripTab }) => void;
};

export function HeroSection({ airports, deals, references, onSearch }: Props) {
  const [tripType, setTripType] = useState<TripTab>("round_trip");
  const [from, setFrom] = useState("CAI");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [passengers, setPassengers] = useState(1);

  const airportOptions = airports.map((a) => (
    <option key={a.code} value={a.code}>
      {a.city} ({a.code})
    </option>
  ));

  function submit(e: FormEvent) {
    e.preventDefault();
    onSearch({ from, to, date, returnDate, passengers, tripType });
  }

  // Pick the deal that's genuinely closest to expiring (not just the first row in the array).
  const flashDeal = useMemo(() => {
    const withHours = deals
      .map((d) => ({ deal: d, hoursLeft: hoursUntil(d.expires_at) }))
      .filter((d): d is { deal: DealRow; hoursLeft: number } => d.hoursLeft != null && d.hoursLeft > 0);
    if (withHours.length === 0) return deals[0] ?? null;
    withHours.sort((a, b) => a.hoursLeft - b.hoursLeft);
    return withHours[0].deal;
  }, [deals]);

  const flashTypical = flashDeal ? getTypicalPrice(flashDeal, references) : null;
  const flashSavings = flashDeal ? savingsPercent(flashDeal.price, flashTypical) : null;

  return (
    <section className="relative overflow-hidden bg-[#F7F8FA]">
      <FareBoard deals={deals} references={references} airports={airports} />
      <OneWayFareBoard deals={deals} references={references} airports={airports} />
      <RoundTripFareBoard deals={deals} references={references} airports={airports} />

      <div className="absolute inset-0 top-10">
        <img src={HERO_IMAGE} alt="" className="h-full w-full object-cover" />
        {/* Soft, warm-neutral overlay (toned down from pure white so it's easier on the eyes):
           opaque near the text side for readability, fading toward the image so the plane wing
           stays visible behind the flash card. */}
        <div className="absolute inset-0 bg-gradient-to-l from-[#F7F8FA] via-[#F7F8FA]/92 to-[#F7F8FA]/30" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#F7F8FA]/25 via-transparent to-[#F7F8FA]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-14 sm:pt-16">
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-lg">
            <h1 className="text-3xl font-extrabold leading-tight text-[#0F172A] sm:text-4xl md:text-5xl">
              سافر أكتر، ادفع أقل.
            </h1>
            <p className="mt-4 text-base text-gray-600 sm:text-lg">
              اكتشف فرص سفر حقيقية قبل ما تخلص. <span className="font-semibold text-orange-600">مقاعد محدودة.</span> وقت محدود.
            </p>

            {deals.length > 0 ? (
              <div className="mt-6 flex items-center gap-3">
                <div className="flex -space-x-3 rtl:space-x-reverse">
                  {["#F59E0B", "#2563EB", "#16A34A", "#EA580C"].map((color, i) => (
                    <span
                      key={i}
                      className="flex size-9 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-sm"
                      style={{ backgroundColor: color }}
                    >
                      🧳
                    </span>
                  ))}
                </div>
                <p className="text-sm text-gray-600">
                  <span className="font-latin font-bold text-[#0F172A]">{Math.max(deals.length * 37, 1000).toLocaleString()}+</span>{" "}
                  مسافر بيوفروا فلوسهم دلوقتي مع TripRing
                </p>
              </div>
            ) : null}
          </div>

          {flashDeal ? (
            <HeroFlashDealCard deal={flashDeal} savings={flashSavings} airports={airports} />
          ) : null}
        </div>
      </div>

      <div className="relative mx-auto max-w-5xl px-4">
        <div className="-mt-16 rounded-2xl bg-white p-5 shadow-xl ring-1 ring-black/5 sm:p-6">
          <div className="mb-5 flex flex-wrap gap-6 border-b border-gray-100">
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
                className={`-mb-px flex items-center gap-1.5 border-b-2 pb-3 text-sm font-semibold transition ${
                  tripType === key
                    ? "border-[#2563EB] text-[#2563EB]"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                <span aria-hidden className="text-xs">
                  {icon}
                </span>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit}>
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-stretch">
              {/* One continuous bordered strip with hairline dividers between fields —
                 matches the reference instead of each field having its own separate box. */}
              <div className="flex flex-1 flex-col divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white sm:flex-row sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
                <FieldBox icon="📍" label="From" className="sm:flex-1">
                  <select value={from} onChange={(e) => setFrom(e.target.value)} className="hero-field-select">
                    {airportOptions}
                  </select>
                </FieldBox>

                <div className="relative flex h-0 items-center justify-center sm:h-auto sm:w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setFrom(to);
                      setTo(from);
                    }}
                    aria-label="تبديل الوجهتين"
                    className="absolute z-10 flex size-8 shrink-0 -translate-y-1/2 rotate-90 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition hover:border-[#2563EB] hover:text-[#2563EB] sm:translate-y-0 sm:rotate-0"
                  >
                    ⇄
                  </button>
                </div>

                <FieldBox icon="📍" label="To" trailingIcon="📌" className="sm:flex-1">
                  <select value={to} onChange={(e) => setTo(e.target.value)} className="hero-field-select">
                    <option value="">اختر الوجهة</option>
                    <option value="any">Anywhere — أي وجهة</option>
                    {airportOptions}
                  </select>
                </FieldBox>

                <FieldBox icon="📅" label="Departure" className="sm:flex-1">
                  <input
                    type="date"
                    value={date}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDate(e.target.value)}
                    className="hero-field-input"
                  />
                </FieldBox>
                <FieldBox icon="📅" label="Return" className="sm:flex-1">
                  <input
                    type="date"
                    value={returnDate}
                    min={date || new Date().toISOString().slice(0, 10)}
                    disabled={tripType === "one_way"}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="hero-field-input disabled:cursor-not-allowed disabled:text-gray-300"
                  />
                </FieldBox>
                <FieldBox icon="👤" label="Passengers" trailingIcon="▾" className="sm:flex-[1.3]">
                  <select
                    value={passengers}
                    onChange={(e) => setPassengers(Number(e.target.value))}
                    className="hero-field-select"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} Passenger(s), Economy
                      </option>
                    ))}
                  </select>
                </FieldBox>
              </div>

              <button
                type="submit"
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#EA580C] px-8 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-200 transition hover:bg-orange-700 active:scale-[0.98] lg:py-0"
              >
                Search Flights
              </button>
            </div>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-500">عمليات بحث شائعة:</span>
            {POPULAR.map((p) => (
              <Link
                key={`${p.from}-${p.to}`}
                to={`/search?from=${p.from}&to=${p.to}`}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-[#2563EB] hover:text-[#2563EB]"
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>

        <DealTicker deals={deals} references={references} airports={airports} />
      </div>
    </section>
  );
}

/** Compact floating card matching the reference "Flash Deal" ticket in the hero
 *  corner — dark card, live HRS/MINS/SECS countdown, route, price, CTA. */
function HeroFlashDealCard({
  deal,
  savings,
  airports,
}: {
  deal: DealRow;
  savings: number | null;
  airports: AirportRow[];
}) {
  const [hoursLeft, setHoursLeft] = useState(() => hoursUntil(deal.expires_at));

  useEffect(() => {
    setHoursLeft(hoursUntil(deal.expires_at));
    const id = setInterval(() => setHoursLeft(hoursUntil(deal.expires_at)), 1000);
    return () => clearInterval(id);
  }, [deal.expires_at]);

  const timeParts = useMemo(() => {
    if (hoursLeft == null || hoursLeft <= 0) return null;
    const totalSeconds = Math.floor(hoursLeft * 3600);
    return {
      h: String(Math.floor(totalSeconds / 3600)).padStart(2, "0"),
      m: String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0"),
      s: String(totalSeconds % 60).padStart(2, "0"),
    };
  }, [hoursLeft]);

  return (
    <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-[#111827]/95 p-5 shadow-2xl shadow-slate-900/30 backdrop-blur-sm sm:w-[320px]">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-sm font-bold text-white">
          <span aria-hidden>🔥</span> أفضل فرصة
        </span>
        {timeParts ? (
          <div dir="ltr" className="font-latin flex items-center gap-1.5 text-white">
            <CountUnit value={timeParts.h} label="HRS" />
            <span className="pb-3 text-slate-500">:</span>
            <CountUnit value={timeParts.m} label="MINS" />
            <span className="pb-3 text-slate-500">:</span>
            <CountUnit value={timeParts.s} label="SECS" />
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div>
          <p className="font-latin text-lg font-extrabold text-white">{deal.from_airport}</p>
          <p className="text-[11px] text-slate-400">{airportLabel(deal.from_airport, airports)}</p>
        </div>
        <span aria-hidden className="text-slate-500">
          →
        </span>
        <div>
          <p className="font-latin text-lg font-extrabold text-white">{deal.to_airport}</p>
          <p className="text-[11px] text-slate-400">{airportLabel(deal.to_airport, airports)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-slate-400">يبدأ من</p>
          <p className="font-latin text-2xl font-extrabold text-orange-500">${deal.price}</p>
        </div>
        {savings ? (
          <span className="font-latin rounded-md bg-white/10 px-2 py-1 text-xs font-bold text-white">
            -{savings}%
          </span>
        ) : null}
      </div>

      <Link
        to={`/deals/${deal.id}`}
        className="mt-4 block rounded-xl bg-orange-600 py-3 text-center text-sm font-bold text-white transition hover:bg-orange-700 active:scale-[0.98]"
      >
        احجز الآن
      </Link>
    </div>
  );
}

function CountUnit({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="text-base font-extrabold leading-none">{value}</span>
      <span className="mt-1 text-[9px] font-semibold text-slate-500">{label}</span>
    </span>
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
      className={`flex items-center gap-2.5 px-4 py-3 transition focus-within:bg-blue-50/40 ${className}`}
    >
      <span className="text-gray-400" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-latin text-[11px] text-gray-400">{label}</p>
        {children}
      </div>
      {trailingIcon ? (
        <span className="shrink-0 text-gray-300" aria-hidden>
          {trailingIcon}
        </span>
      ) : null}
    </div>
  );
}
