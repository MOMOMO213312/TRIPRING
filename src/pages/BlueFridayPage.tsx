import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { DestinationCard } from "../components/DestinationCard";
import { Button } from "../components/ui/Button";
import { getTypicalPrice, fetchActiveDeals } from "../lib/api";
import { PLATFORM_WHATSAPP } from "../lib/constants";
import { airportLabel, formatRouteCities, savingsPercent } from "../lib/deal-utils";
import { hoursUntil } from "../lib/filters";
import { whatsAppLink } from "../lib/utils";
import { useCatalog, useDealImage } from "../hooks/useCatalog";
import type { Catalog } from "../hooks/useCatalog";
import type { DealRow } from "../types/database";

const PROMO_CODE = "BLUEFRIDAY";
// Sale runs for 24h from whenever the customer first lands on the page.
const SALE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function BlueFridayPage() {
  const catalog = useCatalog();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saleEndsAt] = useState(() => Date.now() + SALE_WINDOW_MS);
  const [now, setNow] = useState(Date.now());
  const [budget, setBudget] = useState("");
  const [mysteryDeals, setMysteryDeals] = useState<DealRow[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchActiveDeals({ availableOnly: true, sort: "deal_score" })
      .then(setDeals)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, saleEndsAt - now);
  const timeParts = {
    h: String(Math.floor(remainingMs / 3600000)).padStart(2, "0"),
    m: String(Math.floor((remainingMs % 3600000) / 60000)).padStart(2, "0"),
    s: String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0"),
  };

  // Deepest discounts first — this is the whole point of the sale.
  const bestFlightDeals = useMemo(() => {
    return [...deals]
      .map((d) => ({ deal: d, savings: savingsPercent(d.price, getTypicalPrice(d, catalog.references)) ?? 0 }))
      .sort((a, b) => b.savings - a.savings)
      .slice(0, 8)
      .map((x) => x.deal);
  }, [deals, catalog.references]);

  // Deals closest to expiring — the actual "flash" hours.
  const flashHourDeals = useMemo(() => {
    return [...deals]
      .map((d) => ({ deal: d, hoursLeft: hoursUntil(d.expires_at) }))
      .filter((x): x is { deal: DealRow; hoursLeft: number } => x.hoursLeft != null && x.hoursLeft > 0)
      .sort((a, b) => a.hoursLeft - b.hoursLeft)
      .slice(0, 4)
      .map((x) => x.deal);
  }, [deals]);

  // Cheapest destination per country, for the "Blue Friday destinations from CAI" strip.
  const destinations = useMemo(() => {
    const byCountry = new Map<string, { airport: (typeof catalog.airports)[number]; minPrice: number }>();
    for (const d of deals) {
      const airport = catalog.airports.find((a) => a.code === d.to_airport);
      if (!airport) continue;
      const existing = byCountry.get(airport.country);
      if (!existing || d.price < existing.minPrice) byCountry.set(airport.country, { airport, minPrice: d.price });
    }
    return [...byCountry.values()].slice(0, 6);
  }, [deals, catalog.airports]);

  function copyCode() {
    navigator.clipboard.writeText(PROMO_CODE).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function revealMysteryFares(e: React.FormEvent) {
    e.preventDefault();
    const max = Number(budget);
    if (!max || max <= 0) return;
    const inBudget = deals.filter((d) => d.price <= max);
    const shuffled = [...inBudget].sort(() => Math.random() - 0.5);
    setMysteryDeals(shuffled.slice(0, 3));
  }

  return (
    <div className="-mx-4 -my-8 bg-[#FFFBF2] pb-16 sm:mx-0 sm:my-0">
      {/* Ticker */}
      <div dir="ltr" className="ticker-viewport flex items-center overflow-hidden bg-[#0F172A] py-2 text-xs font-bold text-white">
        <div className="ticker-track flex">
          {["a", "b"].map((suffix) => (
            <div key={suffix} className="flex shrink-0 items-center gap-8 px-4">
              {[
                "24 HOURS ONLY",
                "UP TO 33% OFF FLIGHTS",
                `CODE: ${PROMO_CODE}`,
                "MYSTERY FARES INSIDE",
                "FLASH DROPS EVERY HOUR",
              ].map((t) => (
                <span key={t} className="font-latin whitespace-nowrap">
                  {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Hero */}
      <div className="mx-auto max-w-4xl px-4 pt-14 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          ✨ عروض الجمعة السماوي
        </span>
        <h1 className="mt-5 text-3xl font-extrabold leading-tight text-gray-900 sm:text-4xl md:text-5xl">
          24 ساعة. جمعة سماوي واحدة.
          <br />
          <span className="text-blue-600">خصومات لحد 33% على الطيران.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-gray-600">
          أعمق خصومات السنة بتظهر دلوقتي وبتختفي في نص الليل. استخدم كود{" "}
          <span className="font-latin font-bold text-blue-600">{PROMO_CODE}</span> لخصم إضافي.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          <TimeBox value={timeParts.h} label="ساعة" />
          <TimeBox value={timeParts.m} label="دقيقة" />
          <TimeBox value={timeParts.s} label="ثانية" />
        </div>
        <p className="mt-2 text-sm text-gray-500">العرض بينتهي في نص الليل — متستناش.</p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="#deals">
            <Button className="bg-blue-600 hover:bg-blue-700">تسوّق العروض</Button>
          </a>
          <a href="#mystery">
            <Button variant="outline">جرّب Mystery Fare</Button>
          </a>
        </div>
      </div>

      {/* Promo code + trust row */}
      <div className="mx-auto mt-12 flex max-w-6xl flex-col gap-3 px-4 sm:flex-row">
        <button
          type="button"
          onClick={copyCode}
          className="flex flex-1 items-center gap-3 rounded-2xl border-2 border-dashed border-blue-200 bg-white p-4 text-start transition hover:border-blue-400"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
            🏷️
          </span>
          <span>
            <span className="block text-xs font-semibold text-blue-600">كود خصم إضافي</span>
            <span className="font-latin block text-lg font-extrabold text-gray-900">{PROMO_CODE}</span>
            <span className="block text-xs text-gray-400">{copied ? "✓ اتنسخ" : "دوس عشان تنسخ"}</span>
          </span>
        </button>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {["أفضل سعر", "حجز آمن", "دعم 24/7", "دفع بالواتساب"].map((label) => (
            <div key={label} className="flex flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white p-3 text-center text-xs font-semibold text-gray-700">
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Today's Best Flight Deals */}
      <section id="deals" className="mx-auto mt-14 max-w-6xl px-4">
        <div className="mb-5 flex items-center gap-2">
          <span aria-hidden>⚡</span>
          <h2 className="text-2xl font-bold text-gray-900">أفضل عروض النهاردة</h2>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">لحد 33% خصم</span>
        </div>
        {loading ? (
          <p className="text-gray-500">جاري التحميل...</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {bestFlightDeals.map((deal) => (
              <BlueFridayDealCard key={deal.id} deal={deal} catalog={catalog} tag="عرض ساخن" />
            ))}
          </div>
        )}
      </section>

      {/* Mystery Fare */}
      <section id="mystery" className="mx-auto mt-14 max-w-6xl px-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            🎁 Mystery Fare
          </span>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">قوللنا ميزانيتك، وهنكشفلك وجهة مفاجئة.</h2>
          <p className="mt-2 max-w-lg text-sm text-gray-600">
            اكتب اللي تقدر تصرفه، وهنطابقلك لحد 3 رحلات مفاجئة جوه ميزانيتك — واكتشف فين الجمعة السماوي هتاخدك.
          </p>
          <form onSubmit={revealMysteryFares} className="mt-5 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5">
              <span className="text-gray-400">$</span>
              <input
                type="number"
                min={1}
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="ميزانيتك (دولار)"
                className="w-32 outline-none"
              />
            </div>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              اكشف العروض
            </Button>
          </form>

          {mysteryDeals ? (
            mysteryDeals.length > 0 ? (
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {mysteryDeals.map((deal) => (
                  <BlueFridayDealCard key={deal.id} deal={deal} catalog={catalog} tag="مفاجأة" blurred />
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-gray-500">مفيش عروض جوه الميزانية دي دلوقتي — جرب رقم أكبر.</p>
            )
          ) : null}
        </div>
      </section>

      {/* Flash Hours */}
      {flashHourDeals.length > 0 ? (
        <section className="mx-auto mt-14 max-w-6xl px-4">
          <div className="mb-5 flex items-center gap-2">
            <span aria-hidden>⏰</span>
            <h2 className="text-2xl font-bold text-gray-900">ساعات الفلاش</h2>
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600">قربت تخلص</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {flashHourDeals.map((deal) => (
              <BlueFridayDealCard key={deal.id} deal={deal} catalog={catalog} tag="آخر فرصة" />
            ))}
          </div>
        </section>
      ) : null}

      {/* Destinations */}
      {destinations.length > 0 ? (
        <section className="mx-auto mt-14 max-w-6xl px-4">
          <div className="mb-5 flex items-center gap-2">
            <span aria-hidden>🛫</span>
            <h2 className="text-2xl font-bold text-gray-900">وجهات الجمعة السماوي من القاهرة</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {destinations.map(({ airport, minPrice }) => (
              <Link
                key={airport.code}
                to={`/search?from=CAI&to=${airport.code}`}
                className="rounded-xl border border-gray-200 bg-white p-4 text-center transition hover:border-blue-400 hover:shadow-md"
              >
                <p className="font-bold text-gray-900">{airport.city}</p>
                <p className="text-xs text-gray-400">{airport.country}</p>
                <p className="font-latin mt-2 text-sm font-bold text-blue-600">من ${minPrice}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* WhatsApp CTA */}
      <section className="mx-auto mt-14 max-w-6xl px-4">
        <div className="rounded-2xl bg-[#0F172A] p-8 text-center text-white">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-blue-600 text-2xl">💬</div>
          <h3 className="mt-4 text-xl font-bold">احجز على واتساب — دعم فوري</h3>
          <p className="mt-2 text-sm text-slate-300">
            كلّم فريق السفر بتاعنا لعروض الجمعة السماوي، تأكيد المقعد، والدفع. اذكر كود {PROMO_CODE}.
          </p>
          <a
            href={whatsAppLink(PLATFORM_WHATSAPP, `عايز أعرف عروض الجمعة السماوي — كود ${PROMO_CODE}`)}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold transition hover:bg-blue-500"
          >
            💬 تواصل عبر واتساب
          </a>
        </div>
      </section>

      <p className="mt-10 text-center text-xs text-gray-400">
        TripRing الجمعة السماوي · عروض طيران 24 ساعة ·{" "}
        <Link to="/" className="text-blue-600 hover:underline">
          الرجوع للرئيسية
        </Link>
      </p>
    </div>
  );
}

function TimeBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="font-latin flex size-16 items-center justify-center rounded-xl bg-[#0F172A] text-2xl font-extrabold text-white">
        {value}
      </div>
      <span className="mt-1 text-xs text-gray-500">{label}</span>
    </div>
  );
}

function BlueFridayDealCard({
  deal,
  catalog,
  tag,
  blurred,
}: {
  deal: DealRow;
  catalog: Catalog;
  tag: string;
  blurred?: boolean;
}) {
  const imageUrl = useDealImage(deal.to_airport, catalog, deal.id);
  const typical = getTypicalPrice(deal, catalog.references);
  const savings = savingsPercent(deal.price, typical);
  const hoursLeft = hoursUntil(deal.expires_at);

  return (
    <Link
      to={`/deals/${deal.id}`}
      className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:shadow-lg"
    >
      <div className="relative h-[110px] bg-gray-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className={`h-full w-full object-cover transition group-hover:scale-105 ${blurred ? "blur-sm" : ""}`}
          />
        ) : null}
        <span className="absolute start-2 top-2 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
          {tag}
        </span>
        {hoursLeft != null && hoursLeft > 0 ? (
          <span className="font-latin absolute end-2 top-2 rounded-md bg-red-600/90 px-2 py-0.5 text-[10px] font-bold text-white">
            {Math.floor(hoursLeft)}h
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <p className="text-xs text-gray-500">{blurred ? "وجهة مفاجئة" : formatRouteCities(deal, catalog.airports)}</p>
        <p className="mt-0.5 text-[11px] text-gray-400">
          {airportLabel(deal.from_airport, catalog.airports)} ← {blurred ? "؟؟؟" : airportLabel(deal.to_airport, catalog.airports)}
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-latin text-lg font-extrabold text-gray-900">${deal.price}</span>
          {typical ? <span className="font-latin text-xs text-gray-400 line-through">${typical}</span> : null}
        </div>
        {savings ? <p className="mt-1 text-xs font-bold text-emerald-600">-{savings}%</p> : null}
      </div>
    </Link>
  );
}
