import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AgencyReviewsPanel } from "../components/AgencyReviewsPanel";
import { DealBadge } from "../components/DealBadge";
import { DealScoreRing } from "../components/DealScoreRing";
import { PriceHistoryChart } from "../components/PriceHistoryChart";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { createPriceAlert, fetchDealById, fetchDealPriceHistory, getAgencyWhatsApp, getTypicalPrice } from "../lib/api";
import type { PriceTrendPoint } from "../lib/api";
import {
  airlineName,
  dealReasons,
  dealTypeLabel,
  formatRoute,
  isLowSeats,
  savingsPercent,
  stopsLabel,
} from "../lib/deal-utils";
import { useCatalog, useDealImage } from "../hooks/useCatalog";
import { formatDate, formatPrice, formatTime, whatsAppLink } from "../lib/utils";
import type { DealPriceHistoryRow, DealRow } from "../types/database";

export function DealDetailPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const catalog = useCatalog();
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [history, setHistory] = useState<DealPriceHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    Promise.all([fetchDealById(dealId), fetchDealPriceHistory(dealId)])
      .then(([d, h]) => {
        setDeal(d);
        setHistory(h);
        if (!d) setError("العرض غير متاح أو انتهت صلاحيته");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "خطأ"))
      .finally(() => setLoading(false));
  }, [dealId]);

  const imageUrl = useDealImage(deal?.to_airport ?? "", catalog, deal?.id);

  if (loading || catalog.loading) return <p className="text-slate-500">جاري التحميل...</p>;
  if (error || !deal) {
    return (
      <Card className="text-center">
        <p className="text-red-600">{error ?? "العرض غير موجود"}</p>
        <Link to="/" className="mt-4 inline-block text-[#FF6B35]">
          العودة للرئيسية
        </Link>
      </Card>
    );
  }

  const currency = deal.currency ?? "USD";
  const typical = getTypicalPrice(deal, catalog.references);
  const savings = savingsPercent(deal.price, typical);
  const savingsAmount = typical ? Math.max(0, Math.round(typical - deal.price)) : null;
  const waMessage = `مرحباً، أريد حجز العرض ${deal.id}: ${formatRoute(deal)} — ${deal.price} ${currency}`;
  const agency = catalog.agencies.find((a) => a.id === deal.agency_id);
  const trendPoints: PriceTrendPoint[] = history
    .map((h) => ({ date: h.changed_at, price: h.new_price }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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

  return (
    <div className="space-y-6">
      <div className="relative h-48 overflow-hidden rounded-xl bg-slate-100 sm:h-64">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl text-slate-300">✈</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <p className="absolute bottom-3 start-3 text-xs font-semibold text-white/90">فرصة TripRing</p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">{formatRoute(deal)}</h1>
          <p className="mt-2 text-slate-600">
            {airlineName(deal.airline_code, catalog.airlines)} · {stopsLabel(deal.stops)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <DealBadge tone="good">{dealTypeLabel(deal.deal_type)}</DealBadge>
            {savings ? (
              <DealBadge tone="savings" icon="📉">
                وفّر {savings}%
              </DealBadge>
            ) : null}
            {isLowSeats(deal.available_seats) ? (
              <DealBadge tone="urgent" icon="⏳">
                {deal.available_seats} مقاعد متبقية
              </DealBadge>
            ) : null}
          </div>
        </div>
        {deal.deal_score != null ? <DealScoreRing score={deal.deal_score} size={72} showLabel /> : null}
      </div>

      {/* Price Analysis */}
      <Card className="space-y-4">
        <h2 className="font-bold text-slate-900">تحليل السعر</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-[#FFEDE5] p-4 text-center">
            <p className="text-xs font-medium text-slate-500">السعر الحالي</p>
            <p className="font-latin mt-1 text-2xl font-extrabold text-[#FF6B35]">
              {formatPrice(deal.price, currency)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-center">
            <p className="text-xs font-medium text-slate-500">السعر المعتاد</p>
            <p className="font-latin mt-1 text-2xl font-extrabold text-slate-400 line-through">
              {typical ? formatPrice(typical, currency) : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-[#F0FDF4] p-4 text-center">
            <p className="text-xs font-medium text-slate-500">أنت توفر</p>
            <p className="font-latin mt-1 text-2xl font-extrabold text-[#16A34A]">
              {savingsAmount ? `${formatPrice(savingsAmount, currency)}` : "—"}
            </p>
          </div>
        </div>
        {savings ? (
          <p className="rounded-lg bg-[#F0FDF4] px-4 py-2.5 text-center text-sm font-semibold text-[#16A34A]">
            هذا السعر أقل بـ {savings}% من السعر المعتاد على نفس المسار
          </p>
        ) : null}
      </Card>

      {deal.deal_score != null ? (
        <Card>
          <h2 className="mb-3 font-bold text-slate-900">ليه دي فرصة كويسة؟</h2>
          <ul className="space-y-2.5">
            {dealReasons(deal, history).map((r) => (
              <li key={r.text} className="flex items-center gap-2.5 text-sm text-slate-700">
                <ReasonIcon type={r.icon} />
                {r.text}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-slate-500">المغادرة</p>
          <p className="font-bold">{formatDate(deal.departure_date)}</p>
          <p className="text-slate-600">{formatTime(deal.departure_time)}</p>
          {deal.return_date ? (
            <>
              <p className="mt-2 text-sm text-slate-500">العودة</p>
              <p className="font-bold">{formatDate(deal.return_date)}</p>
            </>
          ) : null}
        </Card>
        <Card>
          <p className="text-sm text-slate-500">المقاعد المتاحة</p>
          <p className="text-3xl font-extrabold">{deal.available_seats}</p>
          {deal.baggage_kg ? <p className="text-sm text-slate-600">أمتعة: {deal.baggage_kg} كجم</p> : null}
          {deal.travel_class ? <p className="text-sm text-slate-600">الدرجة: {deal.travel_class}</p> : null}
        </Card>
      </div>

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

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:sticky sm:bottom-4 sm:shadow-lg">
        <div className="flex flex-col gap-3 sm:flex-row">
          {deal.available_seats > 0 ? (
            <Link to={`/book/${deal.id}`} className="flex-1">
              <Button fullWidth>احجز الآن</Button>
            </Link>
          ) : (
            <Button fullWidth disabled className="flex-1">
              نفدت المقاعد
            </Button>
          )}
          <a href={whatsAppLink(getAgencyWhatsApp(deal, catalog.agencies), waMessage)} target="_blank" rel="noreferrer" className="flex-1">
            <Button fullWidth variant="whatsapp">
              احجز عبر واتساب
            </Button>
          </a>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 rounded-lg border border-slate-200 py-2 font-semibold text-slate-600 transition hover:border-[#FF6B35] hover:text-[#FF6B35]"
          >
            {shareCopied ? "تم نسخ الرابط ✓" : "🔗 مشاركة"}
          </button>
          <button
            type="button"
            onClick={() => setAlertOpen(true)}
            className="flex-1 rounded-lg border border-slate-200 py-2 font-semibold text-slate-600 transition hover:border-[#FF6B35] hover:text-[#FF6B35]"
          >
            🔔 تنبيه سعر
          </button>
        </div>
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
      setError(e instanceof Error ? e.message : "حصل خطأ، حاول تاني");
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
