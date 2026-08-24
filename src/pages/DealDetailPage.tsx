import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { AgencyReviewsPanel } from "../components/AgencyReviewsPanel";
import { DealBadge } from "../components/DealBadge";
import { PackageAndServicesSelector, selectorTotal } from "../components/PackageAndServicesSelector";
import { PriceHistoryChart } from "../components/PriceHistoryChart";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import {
  createPriceAlert,
  fetchAdditionalServices,
  fetchDealById,
  fetchDealPriceHistory,
  fetchRouteDatePrices,
  fetchServicePackages,
  getAgencyWhatsApp,
} from "../lib/api";
import type { PriceTrendPoint, RouteDatePrice, ServicePackageWithServices } from "../lib/api";
import type { PackageTier } from "../lib/packages";
import {
  airlineName,
  dealReasons,
  dealTypeLabel,
  flexibleDateWindow,
  formatRoute,
  hasFareConditions,
  hasPriceBreakdown,
  isLowSeats,
  layoverLabel,
  stopsLabel,
} from "../lib/deal-utils";
import { friendlyErrorMessage } from "../lib/errors";
import { useCatalog, useDealImage } from "../hooks/useCatalog";
import { cn, formatDate, formatPrice, formatTime, whatsAppLink } from "../lib/utils";
import type { AdditionalServiceRow, DealPriceHistoryRow, DealRow } from "../types/database";

export function DealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const catalog = useCatalog();
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [history, setHistory] = useState<DealPriceHistoryRow[]>([]);
  const [routeDates, setRouteDates] = useState<RouteDatePrice[]>([]);
  const [services, setServices] = useState<AdditionalServiceRow[]>([]);
  const [packages, setPackages] = useState<ServicePackageWithServices[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<PackageTier | null>("smart");
  const [checkedServiceIds, setCheckedServiceIds] = useState<Set<string>>(new Set());

  function toggleService(serviceId: string) {
    setCheckedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  }

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    Promise.all([
      fetchDealById(dealId),
      fetchDealPriceHistory(dealId),
      fetchAdditionalServices(),
      fetchServicePackages(),
    ])
      .then(([d, h, s, pkgs]) => {
        setDeal(d);
        setHistory(h);
        setServices(s);
        setPackages(pkgs);
        if (!selectedPackage && pkgs.length > 0) setSelectedPackage(pkgs[0].tier);
        if (!d) {
          setError("العرض غير متاح أو انتهت صلاحيته");
          return;
        }
        // Flexible Dates — best-effort, never blocks the page.
        fetchRouteDatePrices(d.from_airport, d.to_airport)
          .then(setRouteDates)
          .catch(() => setRouteDates([]));
      })
      .catch((e) => {
        // Never show the raw Supabase/PostgREST error string to the
        // customer (e.g. "JSON object requested, multiple (or no) rows
        // returned") — log it for debugging and show a friendly Arabic
        // message instead.
        console.error("[DealDetailPage] failed to load deal:", e);
        setError("حصل خطأ في تحميل العرض، جرّب تاني أو ارجع للرئيسية.");
      })
      .finally(() => setLoading(false));
  }, [dealId]);

  const imageUrl = useDealImage(deal?.to_airport ?? "", catalog, deal?.id);

  if (loading || catalog.loading) return <p className="text-slate-500">جاري التحميل...</p>;
  if (error || !deal) {
    return (
      <Card className="text-center">
        <p className="text-red-600">{error ?? "العرض غير موجود"}</p>
        <Link to="/" className="mt-4 inline-block text-[#0C7BB3]">
          العودة للرئيسية
        </Link>
      </Card>
    );
  }

  const currency = deal.currency ?? "USD";
  const waMessage = `مرحباً، أريد حجز العرض ${deal.id}: ${formatRoute(deal)} — ${deal.price} ${currency}`;
  const agency = catalog.agencies.find((a) => a.id === deal.agency_id);
  const trendPoints: PriceTrendPoint[] = history
    .map((h) => ({ date: h.changed_at, price: h.new_price }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Flexible Dates — only real dates on file within ±3 days, sorted for display.
  const nearbyDates = flexibleDateWindow(routeDates, deal.departure_date, 3).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const cheaperAlternative = nearbyDates
    .filter((d) => d.date !== deal.departure_date && d.price < deal.price)
    .sort((a, b) => a.price - b.price)[0];

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: formatRoute(deal!), url });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    await navigator.clipboard.writeText(url);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }

  function handleContinue() {
    if (!deal) return;
    navigate(`/book/${deal.id}`, {
      state: {
        selectedPackage,
        selectedServiceIds: Array.from(checkedServiceIds),
      },
    });
  }

  const bookingRail = (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {hasPriceBreakdown(deal) ? (
        <div className="space-y-1 border-b border-slate-100 pb-3 text-xs text-slate-500">
          <div className="flex justify-between">
            <span>السعر الأساسي</span>
            <span className="font-latin">{formatPrice(deal.base_fare!, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span>ضرائب ورسوم</span>
            <span className="font-latin">{formatPrice(deal.taxes_fees!, currency)}</span>
          </div>
        </div>
      ) : null}

      {/* Fare bundle (Basic / Smart Trip / Premium Trip) + optional add-on services,
         same idea as the "اختر رحلتك" / "أضف خدماتك" panel from the opportunity
         detail mockup — computed from the deal price and the real additional_services
         catalog rather than a hardcoded price. */}
      <PackageAndServicesSelector
        basePrice={deal.price}
        currency={currency}
        packages={packages}
        services={services}
        selectedPackage={selectedPackage}
        onSelectPackage={setSelectedPackage}
        checkedServiceIds={checkedServiceIds}
        onToggleService={toggleService}
      />

      <div className="flex flex-col gap-2.5 border-t border-slate-100 pt-3">
        {deal.available_seats > 0 ? (
          <Button fullWidth onClick={handleContinue}>
            متابعة
          </Button>
        ) : (
          <Button fullWidth disabled>
            نفدت المقاعد
          </Button>
        )}
        <a href={whatsAppLink(getAgencyWhatsApp(deal, catalog.agencies), waMessage)} target="_blank" rel="noreferrer">
          <Button fullWidth variant="whatsapp">
            احجز عبر واتساب
          </Button>
        </a>
      </div>

      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={handleShare}
          className="flex-1 rounded-lg border border-slate-200 py-2 font-semibold text-slate-600 transition hover:border-[#0C7BB3] hover:text-[#0C7BB3]"
        >
          {shareCopied ? "تم النسخ ✓" : "🔗 مشاركة"}
        </button>
        <button
          type="button"
          onClick={() => setAlertOpen(true)}
          className="flex-1 rounded-lg border border-slate-200 py-2 font-semibold text-slate-600 transition hover:border-[#0C7BB3] hover:text-[#0C7BB3]"
        >
          🔔 تنبيه سعر
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {/* Hero — route + score live over the image, so the title block no longer needs its own row */}
      <div className="relative h-44 overflow-hidden rounded-2xl bg-slate-100 sm:h-56">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl text-slate-300">✈</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
          <div>
            <p className="text-[11px] font-semibold text-white/80">فرصة TripRing</p>
            <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">{formatRoute(deal)}</h1>
            <p className="mt-0.5 text-sm text-white/85">
              {airlineName(deal.airline_code, catalog.airlines)} · {stopsLabel(deal.stops)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <DealBadge tone="good">{dealTypeLabel(deal.deal_type)}</DealBadge>
        {isLowSeats(deal.available_seats) ? (
          <DealBadge tone="urgent" icon="⏳">
            {deal.available_seats} مقاعد متبقية
          </DealBadge>
        ) : null}
      </div>

      {/* Main grid: content on the right (RTL start), booking rail sticky on the left */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-5 lg:col-span-2">
          {/* Trip essentials — schedule, flight identity, fare conditions and baggage
             merged into one compact info card instead of four separate ones, so
             related facts read together instead of being scattered across the page. */}
          <Card className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">المغادرة</dt>
                <dd className="font-bold text-slate-900">{formatDate(deal.departure_date)}</dd>
                <dd className="text-sm text-slate-600">{formatTime(deal.departure_time)}</dd>
              </div>
              {deal.return_date ? (
                <div>
                  <dt className="text-xs text-slate-500">العودة</dt>
                  <dd className="font-bold text-slate-900">{formatDate(deal.return_date)}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs text-slate-500">المقاعد المتاحة</dt>
                <dd className="text-xl font-extrabold text-slate-900">{deal.available_seats}</dd>
              </div>
              {deal.travel_class ? (
                <div>
                  <dt className="text-xs text-slate-500">الدرجة</dt>
                  <dd className="font-semibold text-slate-800">{deal.travel_class}</dd>
                </div>
              ) : null}
              {deal.flight_number ? (
                <div>
                  <dt className="text-xs text-slate-500">رقم الرحلة</dt>
                  <dd className="font-latin font-semibold text-slate-800">{deal.flight_number}</dd>
                </div>
              ) : null}
              {deal.aircraft_type ? (
                <div>
                  <dt className="text-xs text-slate-500">نوع الطائرة</dt>
                  <dd className="font-semibold text-slate-800">{deal.aircraft_type}</dd>
                </div>
              ) : null}
              {deal.operating_airline_code && deal.operating_airline_code !== deal.airline_code ? (
                <div>
                  <dt className="text-xs text-slate-500">الناقل المشغّل</dt>
                  <dd className="font-semibold text-slate-800">
                    {airlineName(deal.operating_airline_code, catalog.airlines)}
                  </dd>
                </div>
              ) : null}
              {deal.arrival_date ? (
                <div>
                  <dt className="text-xs text-slate-500">تاريخ الوصول</dt>
                  <dd className="font-semibold text-slate-800">
                    {formatDate(deal.arrival_date)}
                    {deal.arrival_time ? ` · ${formatTime(deal.arrival_time)}` : ""}
                  </dd>
                </div>
              ) : null}
              {layoverLabel(deal.layover_minutes) ? (
                <div>
                  <dt className="text-xs text-slate-500">مدة التوقف</dt>
                  <dd className="font-semibold text-slate-800">{layoverLabel(deal.layover_minutes)}</dd>
                </div>
              ) : null}
              {deal.baggage_kg ? (
                <div>
                  <dt className="text-xs text-slate-500">الأمتعة</dt>
                  <dd className="font-semibold text-slate-800">{deal.baggage_kg} كجم</dd>
                </div>
              ) : null}
              {deal.cabin_baggage_kg ? (
                <div>
                  <dt className="text-xs text-slate-500">شنطة الكابينة</dt>
                  <dd className="font-semibold text-slate-800">{deal.cabin_baggage_kg} كجم</dd>
                </div>
              ) : null}
              {deal.checked_bags_count != null ? (
                <div>
                  <dt className="text-xs text-slate-500">عدد الشنط المسجّلة</dt>
                  <dd className="font-semibold text-slate-800">{deal.checked_bags_count}</dd>
                </div>
              ) : null}
              {deal.extra_baggage_price ? (
                <div>
                  <dt className="text-xs text-slate-500">سعر الشنطة الإضافية</dt>
                  <dd className="font-semibold text-slate-800">{formatPrice(deal.extra_baggage_price, currency)}</dd>
                </div>
              ) : null}
            </dl>

            {hasFareConditions(deal) ? (
              <div className="border-t border-slate-100 pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  {deal.fare_family ? <DealBadge tone="good">{deal.fare_family}</DealBadge> : null}
                  {deal.refundable != null ? (
                    <DealBadge tone={deal.refundable ? "excellent" : "neutral"}>
                      {deal.refundable ? "قابلة للاسترداد" : "غير قابلة للاسترداد"}
                    </DealBadge>
                  ) : null}
                  {deal.changeable != null ? (
                    <DealBadge tone={deal.changeable ? "excellent" : "neutral"}>
                      {deal.changeable ? "يمكن تغييرها" : "لا يمكن تغييرها"}
                    </DealBadge>
                  ) : null}
                </div>
                {deal.change_fee != null || deal.cancellation_fee != null ? (
                  <p className="mt-2 text-sm text-slate-600">
                    {deal.change_fee != null ? `رسوم التغيير: ${formatPrice(deal.change_fee, currency)}` : null}
                    {deal.change_fee != null && deal.cancellation_fee != null ? " · " : null}
                    {deal.cancellation_fee != null
                      ? `رسوم الإلغاء: ${formatPrice(deal.cancellation_fee, currency)}`
                      : null}
                  </p>
                ) : null}
                {deal.fare_rules ? <p className="mt-2 text-sm text-slate-600">{deal.fare_rules}</p> : null}
              </div>
            ) : null}
          </Card>

          {nearbyDates.length > 1 ? (
            <Card>
              <h2 className="mb-1 font-bold text-slate-900">تواريخ مرنة</h2>
              <p className="mb-3 text-xs text-slate-500">أسعار نفس المسار في تواريخ قريبة من رحلتك</p>
              {cheaperAlternative ? (
                <p className="mb-3 rounded-lg bg-[#F0FDF4] px-3 py-2 text-xs font-semibold text-[#16A34A]">
                  💡 وفّر {formatPrice(deal.price - cheaperAlternative.price, currency)} لو سافرت يوم{" "}
                  {formatDate(cheaperAlternative.date)}
                </p>
              ) : null}
              <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
                {nearbyDates.map((d) => {
                  const isCurrent = d.date === deal.departure_date;
                  return (
                    <Link
                      key={d.date}
                      to={isCurrent ? "#" : `/deals/${d.dealId}`}
                      className={cn(
                        "shrink-0 rounded-xl border px-3 py-2 text-center transition",
                        isCurrent
                          ? "border-[#0C7BB3] bg-[#E5F4FB]"
                          : d.price < deal.price
                            ? "border-[#DCFCE7] bg-[#F0FDF4] hover:border-[#16A34A]"
                            : "border-slate-200 bg-white hover:border-slate-300",
                      )}
                    >
                      <p className="text-[11px] font-medium text-slate-500">{formatDate(d.date)}</p>
                      <p
                        className={cn(
                          "font-latin text-sm font-bold",
                          isCurrent ? "text-[#0C7BB3]" : d.price < deal.price ? "text-[#16A34A]" : "text-slate-800",
                        )}
                      >
                        {formatPrice(d.price, currency)}
                      </p>
                      {isCurrent ? <p className="text-[10px] font-semibold text-[#0C7BB3]">رحلتك</p> : null}
                    </Link>
                  );
                })}
              </div>
            </Card>
          ) : null}

          {dealReasons(deal, history).length > 0 ? (
            <Card>
              <h2 className="mb-3 font-bold text-slate-900">ليه دي فرصة كويسة؟</h2>
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {dealReasons(deal, history).map((r) => (
                  <li key={r.text} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <ReasonIcon type={r.icon} />
                    {r.text}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Secondary detail sections that don't belong in the merged info
             card above collapse by default to keep the page short. */}

          {trendPoints.length >= 2 ? (
            <PriceHistoryChart title={`تاريخ سعر ${formatRoute(deal)}`} points={trendPoints} />
          ) : null}

          {deal.notes ? (
            <Card>
              <h2 className="mb-2 font-bold">ملاحظات</h2>
              <p className="text-slate-600">{deal.notes}</p>
            </Card>
          ) : null}

          {agency ? <AgencyReviewsPanel agency={agency} /> : null}
        </div>

        {/* Sticky booking rail — replaces the old full-width bar pinned to the bottom of every card */}
        <div className="lg:sticky lg:top-4">{bookingRail}</div>
      </div>

      <PriceAlertModal open={alertOpen} onClose={() => setAlertOpen(false)} deal={deal} />
    </div>
  );
}


function PriceAlertModal({ open, onClose, deal }: { open: boolean; onClose: () => void; deal: DealRow }) {
  const [contact, setContact] = useState("");
  const [budget, setBudget] = useState(String(deal.price));
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!contact.trim()) {
      setError("أدخل رقم تليفون أو إيميل");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const isEmail = contact.includes("@");
      await createPriceAlert({
        fromAirport: deal.from_airport,
        toAirport: deal.to_airport,
        maxBudget: Number(budget) || deal.price,
        dealId: deal.id,
        ...(isEmail ? { email: contact.trim() } : { phone: contact.trim() }),
      });
      setDone(true);
    } catch (e) {
      setError(friendlyErrorMessage(e, "حصل خطأ، حاول تاني", "PriceAlertModal.submit"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="إنشاء تنبيه سعر">
      {done ? (
        <p className="rounded-lg bg-green-50 p-4 text-center text-sm font-semibold text-green-700">
          تمام! هنبعتلك تنبيه لما سعر {formatRoute(deal)} ينزل تحت {budget} {deal.currency ?? "USD"}
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">هنبعتلك تنبيه لما سعر {formatRoute(deal)} ينزل عن الميزانية دي.</p>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">رقم تليفون أو إيميل</span>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="01000000000 أو you@email.com"
              className="field-input"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">الميزانية القصوى (USD)</span>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="field-input font-latin"
            />
          </label>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <Button fullWidth onClick={submit} disabled={submitting}>
            {submitting ? "جاري الإنشاء..." : "إنشاء التنبيه"}
          </Button>
        </div>
      )}
    </Modal>
  );
}

function ReasonIcon({ type }: { type: "down" | "seats" | "nonstop" | "fresh" | "score" }) {
  const common = "size-4 shrink-0 text-[#16A34A]";
  if (type === "down") {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8L13 15l-4-4-6 6" />
      </svg>
    );
  }
  if (type === "nonstop") {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (type === "fresh") {
    return (
      <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return (
    <svg className={common} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
