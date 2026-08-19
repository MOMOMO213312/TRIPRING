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
    <section className="relative overflow-hidden bg-[#0F172A]">
      <FareBoard deals={deals} references={references} airports={airports} />
      <OneWayFareBoard deals={deals} references={references} airports={airports} />
      <RoundTripFareBoard deals={deals} references={references} airports={airports} />

      <div className="absolute inset-0 top-10">
        <img src={HERO_IMAGE} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/90 to-slate-900/60" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-14 text-center sm:pt-16">
        <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
          سافر أكتر، ادفع أقل.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base text-slate-300 sm:text-lg">
          اكتشف فرص سفر حقيقية قبل ما تخلص. <span className="font-semibold text-orange-400">مقاعد محدودة.</span> وقت محدود.
        </p>
        {deals.length > 0 ? (
          <p className="mt-5 text-sm font-medium text-slate-300">
            🔥 <span className="font-latin font-bold text-white">{deals.length}</span> فرصة نشطة دلوقتي على TripRing
          </p>
        ) : null}
      </div>

      <div className="relative mx-auto max-w-4xl px-4">
        <div className="-mt-24 rounded-xl border border-gray-200 bg-white p-5 shadow-lg sm:p-6">
          <div className="mb-4 flex flex-wrap gap-6 border-b border-gray-100">
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
            <div className="flex flex-col divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 lg:flex-row lg:divide-x lg:divide-y-0">
              <FieldCell icon="📍" label="From">
                <select value={from} onChange={(e) => setFrom(e.target.value)} className="hero-field-select">
                  {airportOptions}
                </select>
              </FieldCell>
              <FieldCell icon="📍" label="To" trailingIcon="📌">
                <select value={to} onChange={(e) => setTo(e.target.value)} className="hero-field-select">
                  <option value="">اختر الوجهة</option>
                  <option value="any">Anywhere — أي وجهة</option>
                  {airportOptions}
                </select>
              </FieldCell>
              <FieldCell icon="📅" label="Departure">
                <input
                  type="date"
                  value={date}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setDate(e.target.value)}
                  className="hero-field-input"
                />
              </FieldCell>
              <FieldCell icon="📅" label="Return">
                <input
                  type="date"
                  value={returnDate}
                  min={date || new Date().toISOString().slice(0, 10)}
                  disabled={tripType === "one_way"}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="hero-field-input disabled:cursor-not-allowed disabled:text-gray-300"
                />
              </FieldCell>
              <FieldCell icon="👤" label="Passengers">
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
              </FieldCell>
              <button
                type="submit"
                className="flex shrink-0 items-center justify-center bg-[#EA580C] px-8 py-4 text-sm font-bold text-white transition hover:bg-orange-700"
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

        {flashDeal ? (
          <FlashDealStrip deal={flashDeal} typical={flashTypical} savings={flashSavings} airports={airports} />
        ) : null}
      </div>
    </section>
  );
}

function FlashDealStrip({
  deal,
  typical,
  savings,
  airports,
}: {
  deal: DealRow;
  typical: number | null;
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
    <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-md sm:flex-row sm:justify-between sm:p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600">
          🔥 أفضل فرصة
        </span>
        <div className="flex items-center gap-2">
          <div className="text-center">
            <p className="font-latin text-lg font-extrabold text-gray-900">{deal.from_airport}</p>
            <p className="text-[11px] text-gray-500">{airportLabel(deal.from_airport, airports)}</p>
          </div>
          <span aria-hidden className="text-gray-300">
            ✈️
          </span>
          <div className="text-center">
            <p className="font-latin text-lg font-extrabold text-gray-900">{deal.to_airport}</p>
            <p className="text-[11px] text-gray-500">{airportLabel(deal.to_airport, airports)}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-center sm:text-right">
          <p className="text-xs text-gray-500">يبدأ من</p>
          <p className="font-latin text-xl font-extrabold text-orange-600">${deal.price}</p>
        </div>
        {savings ? (
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-600 whitespace-nowrap">
            -{savings}%
          </span>
        ) : null}
        {timeParts ? (
          /* dir="ltr" forces h:m:s reading order regardless of the page's RTL direction */
          <div dir="ltr" className="font-latin flex items-center gap-1 text-xs font-bold text-[#0F172A]">
            <TimeBox value={timeParts.h} />:<TimeBox value={timeParts.m} />:<TimeBox value={timeParts.s} />
          </div>
        ) : null}
        <Link
          to={`/deals/${deal.id}`}
          className="shrink-0 rounded-xl bg-orange-600 px-5 py-2.5 text-center text-sm font-bold text-white transition hover:bg-orange-700"
        >
          احجز الآن
        </Link>
      </div>
    </div>
  );
}

function TimeBox({ value }: { value: string }) {
  return <span className="rounded-md bg-gray-100 px-1.5 py-1">{value}</span>;
}

function FieldCell({
  icon,
  label,
  trailingIcon,
  children,
}: {
  icon: string;
  label: string;
  trailingIcon?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center gap-2.5 px-4 py-3">
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
