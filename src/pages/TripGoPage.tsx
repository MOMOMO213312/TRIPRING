import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { AirportAutocomplete } from "../components/ui/AirportAutocomplete";
import { Input } from "../components/ui/Input";
import { useCatalog } from "../hooks/useCatalog";

export function TripGoPage() {
  const catalog = useCatalog();
  const navigate = useNavigate();
  const [from, setFrom] = useState("CAI");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [error, setError] = useState<string | null>(null);

  function swapAirports() {
    if (!to) return; // nothing to swap into "from"
    setFrom(to);
    setTo(from);
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const validCode = (code: string) => catalog.airports.some((a) => a.code === code);
    if (!from || !validCode(from)) {
      setError("اختر مطار المغادرة من القائمة");
      return;
    }
    if (to && !validCode(to)) {
      setError("اختر الوجهة من القائمة أو اتركها فارغة لأي وجهة");
      return;
    }
    setError(null);
    const params = new URLSearchParams();
    params.set("from", from);
    if (to) params.set("to", to);
    if (date) params.set("date", date);
    params.set("passengers", String(passengers));
    navigate(`/tripgo/results?${params.toString()}`);
  }

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="tripgo-gradient-bg relative overflow-hidden rounded-3xl px-6 py-12 text-center text-white sm:px-10 sm:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-10">
          <span className="absolute -end-6 -top-6 text-[160px]">✈️</span>
          <span className="absolute -start-4 bottom-0 text-[120px]">🚐</span>
        </div>

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
            ⚡ منتج TripRing المتقدم
          </span>
          <h1 className="font-display mt-4 text-4xl font-extrabold sm:text-5xl">TripGo</h1>
          <p className="mt-3 text-lg font-bold text-white/95 sm:text-xl">
            تذكرتك + نقلك من وإلى المطار في حجز واحد، من غير ما تدوّر على تاكسي بعد كده.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/80 sm:text-base">
            سعر واحد نهائي شامل الرحلة والنقل. اختار عربية خاصة أو نقل تشاركي وقت الحجز، وإحنا هنكون في استقبالك.
          </p>
        </div>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="relative mx-auto mt-8 max-w-4xl rounded-2xl bg-white p-4 text-start shadow-xl sm:p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#0C7BB3]/10 px-2.5 py-1 text-[11px] font-bold text-[#0C7BB3]">
              🎫 رحلة ذهاب فقط
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-12 sm:items-end sm:gap-2">
            <div className="sm:col-span-3">
              <AirportAutocomplete label="من" value={from} onChange={setFrom} airports={catalog.airports} />
            </div>

            <div className="flex items-end justify-center pb-0.5 sm:col-span-1">
              <button
                type="button"
                onClick={swapAirports}
                disabled={!to}
                aria-label="تبديل من وإلى"
                title="تبديل من وإلى"
                className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-[#0C7BB3] hover:text-[#0C7BB3] disabled:cursor-not-allowed disabled:opacity-40"
              >
                ⇄
              </button>
            </div>

            <div className="sm:col-span-3">
              <AirportAutocomplete
                label="إلى"
                value={to}
                onChange={setTo}
                airports={catalog.airports}
                placeholder="أي وجهة"
                allowClear
              />
            </div>

            <div className="sm:col-span-2">
              <Input label="التاريخ" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            <div className="sm:col-span-1">
              <Input
                label="المسافرون"
                type="number"
                min={1}
                value={passengers}
                onChange={(e) => setPassengers(Math.max(1, Number(e.target.value)))}
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-[#0C7BB3] to-[#1E3A8A] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90"
              >
                🔍 ابحث عن TripGo
              </button>
            </div>
          </div>

          {error ? <p className="mt-2 text-start text-xs font-semibold text-red-600">{error}</p> : null}
        </form>
      </div>

      {/* Value props */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <span className="text-3xl">🎟️</span>
          <p className="mt-2 font-bold text-slate-900">تذكرة طيران</p>
          <p className="mt-1 text-sm text-slate-500">أفضل الأسعار من شركات الطيران والوكالات الموثوقة</p>
        </div>
        <div className="rounded-2xl border border-[#16A34A]/25 bg-[#F0FDF4] p-5 text-center">
          <span className="text-3xl">🚐</span>
          <p className="mt-2 font-bold text-slate-900">نقل من وإلى المطار</p>
          <p className="mt-1 text-sm text-slate-500">
            مضمون مع كل رحلة — اختار عربية خاصة أو نقل تشاركي، مش خدمة اختيارية بتضيفها بنفسك
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <span className="text-3xl">✅</span>
          <p className="mt-2 font-bold text-slate-900">تجربة سفر واحدة</p>
          <p className="mt-1 text-sm text-slate-500">من الباب لحد المطار، ومن المطار لحد وجهتك</p>
        </div>
      </div>
    </div>
  );
}
