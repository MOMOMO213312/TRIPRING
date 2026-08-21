import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { OneWayFareBoard } from "./OneWayFareBoard";
import { RoundTripFareBoard } from "./RoundTripFareBoard";
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
      <OneWayFareBoard deals={deals} references={references} airports={airports} />

      <section className="relative overflow-hidden bg-[#F7F8FA]">
        <div className="absolute inset-0 h-[340px] sm:h-[380px]">
          <img src={HERO_IMAGE} alt="" className="h-full w-full object-cover" />
          {/* Daytime wing-over-clouds shot carries bright natural color, so the
             overlay's job is just to guarantee the headline stays legible over
             it — a dark wash up top that fades to nothing by mid-photo, then a
             soft handoff into the page background at the very bottom so the
             photo still reads as a hero, not a washed-out panel. */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#F7F8FA]" />
        </div>

      <div className="relative mx-auto max-w-4xl px-4 pb-32 pt-8 text-center sm:pb-36 sm:pt-10">
        <h1
          className="font-display text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl"
          style={{ textShadow: "0 4px 28px rgba(0,0,0,0.5)" }}
        >
          اكتشف افضل فرص السفر يوميا
        </h1>
        <p
          className="mx-auto mt-3 max-w-xl text-base text-white/90 sm:text-lg"
          style={{ textShadow: "0 1px 16px rgba(0,0,0,0.4)" }}
        >
          تجربة تستحق البحث
        </p>
      </div>

      {/* Search box pulled up to overlap the bottom of the hero photo. The
         headline block above now reserves fixed bottom padding (pb-32 /
         sm:pb-36) that comfortably exceeds this negative margin, so the card
         can never cover the headline or subheadline text. */}
      <div className="relative z-10 mx-auto max-w-5xl px-4">
        <div className="-mt-24 rounded-[24px] bg-white p-4 shadow-2xl shadow-slate-900/15 ring-1 ring-black/[0.04] sm:p-5">
          <div className="mb-4 flex w-fit gap-1 rounded-full bg-slate-100 p-1">
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
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  tripType === key
                    ? "bg-white text-[#0C7BB3] shadow-sm"
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
            <div className="flex flex-col gap-2.5">
              {/* Two stacked rows instead of cramming all 5 fields + swap button
                 into one strip — From/To (the widest values) get their own row,
                 and the three shorter fields (date/date/passengers) share a
                 second row, so every field gets enough width for its label,
                 icon and value to stop colliding or truncating. */}
              <div className="flex flex-1 flex-col divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:flex-row sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
                <FieldBox icon="📍" label="From" className="sm:flex-1">
                  <select value={from} onChange={(e) => setFrom(e.target.value)} className="hero-field-select">
                    {airportOptions}
                  </select>
                </FieldBox>

                <div className="flex h-8 shrink-0 items-center justify-center sm:h-auto sm:w-12">
                  <button
                    type="button"
                    onClick={() => {
                      setFrom(to);
                      setTo(from);
                    }}
                    aria-label="تبديل الوجهتين"
                    className="flex size-8 shrink-0 rotate-90 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:border-[#0C7BB3] hover:text-[#0C7BB3] sm:rotate-0"
                  >
                    ⇄
                  </button>
                </div>

                <FieldBox icon="📍" label="To" className="sm:flex-1">
                  <select value={to} onChange={(e) => setTo(e.target.value)} className="hero-field-select">
                    <option value="">اختر الوجهة</option>
                    <option value="any">Anywhere — أي وجهة</option>
                    {airportOptions}
                  </select>
                </FieldBox>
              </div>

              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-stretch">
                <div className="flex flex-1 flex-col divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:flex-row sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
                  <FieldBox icon="📅" label="Departure" className="sm:flex-1">
                    <div className="relative">
                      <input
                        type="date"
                        value={date}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setDate(e.target.value)}
                        className="hero-field-input"
                      />
                      {/* Native date inputs render their empty state in the
                         browser's own locale (often "mm/dd"), which reads as
                         English inside an otherwise Arabic form. Cover it with
                         an Arabic label until a date is actually picked —
                         pointer-events-none so the click still opens the native
                         picker underneath. */}
                      {!date && (
                        <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center bg-white text-sm font-semibold text-slate-800">
                          اختر التاريخ
                        </span>
                      )}
                    </div>
                  </FieldBox>
                  <FieldBox icon="📅" label="Return" className="sm:flex-1">
                    <div className="relative">
                      <input
                        type="date"
                        value={returnDate}
                        min={date || new Date().toISOString().slice(0, 10)}
                        disabled={tripType === "one_way"}
                        onChange={(e) => setReturnDate(e.target.value)}
                        className="hero-field-input disabled:cursor-not-allowed disabled:text-slate-300"
                      />
                      {!returnDate && tripType !== "one_way" && (
                        <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center bg-white text-sm font-semibold text-slate-800">
                          اختر التاريخ
                        </span>
                      )}
                    </div>
                  </FieldBox>
                  <FieldBox
                    icon="👤"
                    label="Passengers"
                    trailingIcon="▾"
                    className="sm:flex-1 cursor-pointer hover:bg-[#E5F4FB]/40"
                  >
                    <select
                      value={passengers}
                      onChange={(e) => setPassengers(Number(e.target.value))}
                      className="hero-field-select cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "مسافر" : "مسافرين"}، الدرجة الاقتصادية
                        </option>
                      ))}
                    </select>
                  </FieldBox>
                </div>

                <button
                  type="submit"
                  className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#0C7BB3] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#BFE3F6] transition hover:-translate-y-0.5 hover:bg-[#095E8A] hover:shadow-xl active:scale-[0.98] active:translate-y-0 lg:py-0"
                >
                  <span aria-hidden>🔍</span> ابحث عن رحلات
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
                className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-[#0C7BB3] hover:bg-[#E5F4FB] hover:text-[#0C7BB3]"
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
      className={`flex min-w-0 items-center gap-2 px-3.5 py-2.5 transition focus-within:bg-[#E5F4FB]/40 ${className}`}
    >
      <span className="shrink-0 text-slate-400" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-latin text-[11px] text-slate-400">{label}</p>
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
