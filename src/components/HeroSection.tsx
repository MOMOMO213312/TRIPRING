import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { FareBoard } from "./FareBoard";
import type { TripType } from "../lib/api";
import type { AirportRow, DealRow, RoutePriceReferenceRow } from "../types/database";
import heroSky from "../assets/hero-sky.jpg";

const HERO_IMAGE = heroSky;

const POPULAR = [
  { from: "CAI", to: "DXB", label: "القاهرة ← دبي" },
  { from: "CAI", to: "IST", label: "القاهرة ← إسطنبول" },
  { from: "CAI", to: "JED", label: "القاهرة ← جدة" },
  { from: "CAI", to: "LHR", label: "القاهرة ← لندن" },
  { from: "CAI", to: "SSH", label: "القاهرة ← شرم الشيخ" },
];

type Props = {
  airports: AirportRow[];
  deals: DealRow[];
  references: RoutePriceReferenceRow[];
  onSearch: (params: { from: string; to: string; date: string; returnDate: string; passengers: number; tripType: TripType }) => void;
};

export function HeroSection({ airports, deals, references, onSearch }: Props) {
  const [tripType, setTripType] = useState<TripType>("round_trip");
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

  return (
    <>
      {/* One-way ticker stays pinned to the very top of the hero, in normal
         document flow — kept OUTSIDE the hero photo's relatively-positioned
         section below so the absolutely-positioned photo layer can never
         overlap or cover it. */}
      <FareBoard deals={deals} references={references} airports={airports} tripType="one-way" />

      <section className="relative overflow-hidden bg-surface-alt">
        <div className="absolute inset-0 h-[360px] sm:h-[400px]">
          <img src={HERO_IMAGE} alt="" className="h-full w-full object-cover" />
          {/* Daytime wing-over-clouds shot carries bright natural color. Text now
             sits on the RTL "end" edge (visually the left side), so the dark
             wash sits over the left side of the photo and fades away to the
             right, then a soft handoff into the page background at the
             very bottom. */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-surface-alt" />
        </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-28 pt-10 sm:pb-32 sm:pt-14">
        <div className="max-w-lg ms-auto text-end">
          <h1
            className="text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl"
            style={{ textShadow: "0 2px 20px rgba(0,0,0,0.45)" }}
          >
            طيران أرخص، سفر أكتر.
          </h1>
          <p
            className="mt-4 text-base text-white/90 sm:text-lg"
            style={{ textShadow: "0 1px 16px rgba(0,0,0,0.4)" }}
          >
            قارن <span className="font-semibold text-flash-orange-light">مئات عروض الطيران</span> في ثانية، واحجز بأفضل سعر متاح.
          </p>
        </div>
      </div>

      {/* Search box pulled up to overlap the bottom of the hero photo — the
         headline block above reserves fixed bottom padding (pb-28 / sm:pb-32)
         that comfortably exceeds this negative margin, so the card never
         covers the headline/subheadline/trust row above it. */}
      <div className="relative z-10 mx-auto max-w-5xl px-4">
        <div className="-mt-16 rounded-[28px] bg-white p-5 shadow-2xl shadow-slate-900/15 ring-1 ring-black/[0.04] sm:p-7">
          <div className="mb-5 flex w-fit gap-1 rounded-full bg-slate-100 p-1">
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
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  tripType === key
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
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
              {/* Each field now sits in its own bordered, rounded box with a
                 visible gap between them (matches the reference), instead of
                 one continuous strip with hairline dividers. */}
              <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12">
                <div className="relative lg:col-span-3">
                  <FieldBox icon="📍" label="From">
                    <select value={from} onChange={(e) => setFrom(e.target.value)} className="hero-field-select">
                      {airportOptions}
                    </select>
                  </FieldBox>
                  <button
                    type="button"
                    onClick={() => {
                      setFrom(to);
                      setTo(from);
                    }}
                    aria-label="تبديل الوجهتين"
                    className="absolute start-full top-1/2 z-10 flex size-7 -translate-x-1/2 -translate-y-1/2 rotate-90 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-primary hover:text-primary rtl:translate-x-1/2"
                  >
                    ⇄
                  </button>
                </div>

                <div className="lg:col-span-3">
                  <FieldBox icon="📍" label="To">
                    <select value={to} onChange={(e) => setTo(e.target.value)} className="hero-field-select">
                      <option value="">اختر الوجهة</option>
                      <option value="any">Anywhere — أي وجهة</option>
                      {airportOptions}
                    </select>
                  </FieldBox>
                </div>

                <div className="lg:col-span-2">
                  <FieldBox icon="📅" label="Departure">
                    <input
                      type="date"
                      value={date}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setDate(e.target.value)}
                      className="hero-field-input"
                    />
                  </FieldBox>
                </div>
                <div className="lg:col-span-2">
                  <FieldBox icon="📅" label="Return">
                    <input
                      type="date"
                      value={returnDate}
                      min={date || new Date().toISOString().slice(0, 10)}
                      disabled={tripType === "one_way"}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="hero-field-input disabled:cursor-not-allowed disabled:text-slate-300"
                    />
                  </FieldBox>
                </div>
                <div className="lg:col-span-2">
                  <FieldBox icon="👤" label="Passengers" trailingIcon="▾">
                    <select
                      value={passengers}
                      onChange={(e) => setPassengers(Number(e.target.value))}
                      className="hero-field-select"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "مسافر" : "مسافرين"}، الدرجة الاقتصادية
                        </option>
                      ))}
                    </select>
                  </FieldBox>
                </div>
              </div>

              <button
                type="submit"
                className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary-ring transition hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-xl active:scale-[0.98] active:translate-y-0 lg:py-0"
              >
                <span aria-hidden>🔍</span> ابحث عن رحلات
              </button>
            </div>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">عمليات بحث شائعة:</span>
            {POPULAR.map((p) => (
              <Link
                key={`${p.from}-${p.to}`}
                to={`/search?from=${p.from}&to=${p.to}`}
                className="rounded-full border border-border-muted bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-primary hover:bg-primary-light hover:text-primary"
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
      <div className="relative isolate z-0 mt-8 w-full overflow-hidden pb-8">
        <FareBoard deals={deals} references={references} airports={airports} tripType="round-trip" />
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
      className={`flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 transition focus-within:border-primary focus-within:bg-primary-light/40 ${className}`}
    >
      <span className="shrink-0 text-slate-400" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-latin text-[11px] text-slate-400">{label}</p>
        {children}
      </div>
      {trailingIcon ? (
        <span className="shrink-0 text-slate-300" aria-hidden>
          {trailingIcon}
        </span>
      ) : null}
    </div>
  );
}
