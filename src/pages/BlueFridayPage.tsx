import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { DestinationCard } from "../components/DestinationCard";
import { Button } from "../components/ui/Button";
import { fetchActiveDeals } from "../lib/api";
import { PLATFORM_WHATSAPP } from "../lib/constants";
import { airportLabel, formatRouteCities } from "../lib/deal-utils";
import { hoursUntil } from "../lib/filters";
import { formatPrice, whatsAppLink } from "../lib/utils";
import { useCatalog, useDealImage } from "../hooks/useCatalog";
import type { Catalog } from "../hooks/useCatalog";
import type { DealRow } from "../types/database";

const PROMO_CODE = "BLUEFRIDAY";
const MIN_DISCOUNT_PCT = 15; // a deal only counts as "Blue Friday" if it's at least this % off original_price

/** Real weekly Friday window in Cairo time — not a per-visitor countdown.
 *  Live from Friday 00:00 to Friday 24:00 Africa/Cairo; otherwise returns a
 *  countdown to the next Friday's start, so the urgency is genuine and
 *  identical for every visitor regardless of when they land. */
function getBlueFridayWindow(now: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));

  // The Cairo UTC offset right now, derived from the formatted parts (works
  // correctly even if Egypt ever reintroduces DST).
  const cairoLocalAsUtc = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")),
    Number(get("minute")),
    Number(get("second")),
  );
  const cairoOffsetMs = cairoLocalAsUtc - now;
  const cairoMidnightTodayReal =
    Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")), 0, 0, 0) - cairoOffsetMs;

  const isFriday = weekday === 5;
  const daysUntilFriday = (5 - weekday + 7) % 7;

  return isFriday
    ? { isLive: true, endsAt: cairoMidnightTodayReal + 86400000 }
    : { isLive: false, endsAt: cairoMidnightTodayReal + daysUntilFriday * 86400000 };
}

export function BlueFridayPage() {
  const catalog = useCatalog();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [budget, setBudget] = useState("");
  const [mysteryDeals, setMysteryDeals] = useState<DealRow[] | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchActiveDeals({ availableOnly: true, sort: "price_asc" })
      .then(setDeals)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { isLive, endsAt } = getBlueFridayWindow(now);
  const remainingMs = Math.max(0, endsAt - now);
  const timeParts = {
    h: String(Math.floor(remainingMs / 3600000)).padStart(2, "0"),
    m: String(Math.floor((remainingMs % 3600000) / 60000)).padStart(2, "0"),
    s: String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0"),
  };

  // Only deals genuinely discounted ≥MIN_DISCOUNT_PCT off original_price count
  // as "Blue Friday" deals — otherwise this is just the regular deals feed
  // with a blue coat of paint, which kills the urgency once customers notice.
  const blueFridayDeals = useMemo(() => {
    return deals.filter((d) => d.original_price && d.original_price > d.price && (1 - d.price / d.original_price) * 100 >= MIN_DISCOUNT_PCT);
  }, [deals]);

  // Cheapest real prices first — this is the whole point of the sale.
  const bestFlightDeals = useMemo(() => {
    return [...blueFridayDeals].sort((a, b) => a.price - b.price).slice(0, 8);
  }, [blueFridayDeals]);

  // Deals closest to expiring — the actual "flash" hours.
  const flashHourDeals = useMemo(() => {
    return [...blueFridayDeals]
      .map((d) => ({ deal: d, hoursLeft: hoursUntil(d.expires_at) }))
      .filter((x): x is { deal: DealRow; hoursLeft: number } => x.hoursLeft != null && x.hoursLeft > 0)
      .sort((a, b) => a.hoursLeft - b.hoursLeft)
      .slice(0, 4)
      .map((x) => x.deal);
  }, [blueFridayDeals]);

  // Cheapest destination per country, for the "Blue Friday destinations from CAI" strip.
  const destinations = useMemo(() => {
    const byCountry = new Map<
      string,
      { airport: (typeof catalog.airports)[number]; minPrice: number; currency: string }
    >();
    for (const d of blueFridayDeals) {
      const airport = catalog.airports.find((a) => a.code === d.to_airport);
      if (!airport) continue;
      const existing = byCountry.get(airport.country);
      if (!existing || d.price < existing.minPrice)
        byCountry.set(airport.country, { airport, minPrice: d.price, currency: d.currency ?? "USD" });
    }
    return [...byCountry.values()].slice(0, 6);
  }, [blueFridayDeals, catalog.airports]);

  function copyCode() {
    navigator.clipboard.writeText(PROMO_CODE).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function revealMysteryFares(e: React.FormEvent) {
    e.preventDefault();
    const max = Number(budget);
    if (!max || max <= 0) return;
    const inBudget = blueFridayDeals.filter((d) => d.price <= max);
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
                "EVERY FRIDAY",
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
          ✨ عروض الجمعة السماوي — كل جمعة
        </span>
        <h1 className="mt-5 text-3xl font-extrabold leading-tight text-slate-900 sm:text-4xl md:text-5xl">
          كل جمعة، من الفجر لنص الليل.
          <br />
          <span className="text-blue-600">خصومات لحد 33% على الطيران.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-slate-600">
          {isLive ? (
            <>
              أعمق خصومات الأسبوع شغالة دلوقتي وبتختفي في نص الليل. استخدم كود{" "}
              <span className="font-latin font-bold text-blue-600">{PROMO_CODE}</span> لخصم إضافي.
            </>
          ) : (
            "الجمعة السماوي شغالة كل يوم جمعة بس — تحت تلاقي العداد لبداية الجمعة الجاية."
          )}
        </p>

        <div className="mt-8 flex justify-center gap-3">
          {remainingMs >= 86400000 ? <TimeBox value={String(Math.floor(remainingMs / 86400000))} label="يوم" /> : null}
          <TimeBox value={remainingMs >= 86400000 ? String(Math.floor((remainingMs % 86400000) / 3600000)).padStart(2, "0") : timeParts.h} label="ساعة" />
          <TimeBox value={timeParts.m} label="دقيقة" />
          <TimeBox value={timeParts.s} label="ثانية" />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {isLive ? "العرض بينتهي في نص الليل — متستناش." : "استنى — العرض بيفتح تلقائي الساعة 12 بالليل."}
        </p>

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
            <span className="font-latin block text-lg font-extrabold text-slate-900">{PROMO_CODE}</span>
            <span className="block text-xs text-slate-400">{copied ? "✓ اتنسخ" : "دوس عشان تنسخ"}</span>
          </span>
        </button>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {["أفضل سعر", "حجز آمن", "دعم 24/7", "دفع بالواتساب"].map((label) => (
            <div key={label} className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white p-3 text-center text-xs font-semibold text-slate-700">
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Today's Best Flight Deals */}
      <section id="deals" className="mx-auto mt-14 max-w-6xl px-4">
        <div className="mb-5 flex items-center gap-2">
          <span aria-hidden>⚡</span>
          <h2 className="text-2xl font-bold text-slate-900">{isLive ? "أفضل عروض النهاردة" : "معاينة عروض الجمعة الجاية"}</h2>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">لحد 33% خصم</span>
        </div>
        {loading ? (
          <p className="text-slate-500">جاري التحميل...</p>
        ) : bestFlightDeals.length === 0 ? (
          <p className="text-slate-500">مفيش عروض بخصم كافي دلوقتي — تابعنا يوم الجمعة الجاية.</p>
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            🎁 Mystery Fare
          </span>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">قوللنا ميزانيتك، وهنكشفلك وجهة مفاجئة.</h2>
          <p className="mt-2 max-w-lg text-sm text-slate-600">
            اكتب اللي تقدر تصرفه، وهنطابقلك لحد 3 رحلات مفاجئة جوه ميزانيتك — واكتشف فين الجمعة السماوي هتاخدك.
          </p>
          <form onSubmit={revealMysteryFares} className="mt-5 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
              <span className="text-slate-400">$</span>
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
              <p className="mt-5 text-sm text-slate-500">مفيش عروض جوه الميزانية دي دلوقتي — جرب رقم أكبر.</p>
            )
          ) : null}
        </div>
      </section>

      {/* Flash Hours */}
      {flashHourDeals.length > 0 ? (
        <section className="mx-auto mt-14 max-w-6xl px-4">
          <div className="mb-5 flex items-center gap-2">
            <span aria-hidden>⏰</span>
            <h2 className="text-2xl font-bold text-slate-900">ساعات الفلاش</h2>
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
            <h2 className="text-2xl font-bold text-slate-900">وجهات الجمعة السماوي من القاهرة</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {destinations.map(({ airport, minPrice, currency }) => (
              <Link
                key={airport.code}
                to={`/search?from=CAI&to=${airport.code}`}
                className="rounded-xl border border-slate-200 bg-white p-4 text-center transition hover:border-blue-400 hover:shadow-md"
              >
                <p className="font-bold text-slate-900">{airport.city}</p>
                <p className="text-xs text-slate-400">{airport.country}</p>
                <p className="font-latin mt-2 text-sm font-bold text-blue-600">من {formatPrice(minPrice, currency)}</p>
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

      <p className="mt-10 text-center text-xs text-slate-400">
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
      <span className="mt-1 text-xs text-slate-500">{label}</span>
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
  const hoursLeft = hoursUntil(deal.expires_at);

  return (
    <Link
      to={`/deals/${deal.id}`}
      className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:shadow-lg"
    >
      <div className="relative h-[110px] bg-slate-100">
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
        <p className="text-xs text-slate-500">{blurred ? "وجهة مفاجئة" : formatRouteCities(deal, catalog.airports)}</p>
        <p className="mt-0.5 text-[11px] text-slate-400">
          {airportLabel(deal.from_airport, catalog.airports)} ← {blurred ? "؟؟؟" : airportLabel(deal.to_airport, catalog.airports)}
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-latin text-lg font-extrabold text-[#0C7BB3]">
            {formatPrice(deal.price, deal.currency ?? "USD")}
          </span>
        </div>
      </div>
    </Link>
  );
}
