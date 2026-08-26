import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { AuthGate } from "../components/AuthGate";
import { EmptyState } from "../components/EmptyState";
import { CardsSkeleton } from "../components/LoadingSkeleton";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { createTicketResale, fetchActiveTicketResales, type TicketResaleRow } from "../lib/api";
import { PLATFORM_WHATSAPP } from "../lib/constants";
import { airlineName, airportLabel } from "../lib/deal-utils";
import { friendlyErrorMessage } from "../lib/errors";
import { useCatalog } from "../hooks/useCatalog";
import { formatDate, formatPrice, whatsAppLink, WhatsAppIcon } from "../lib/utils";
import type { ResaleReason } from "../types/database";

const REASON_LABEL: Record<ResaleReason, string> = {
  non_refundable: "غير قابلة للاسترداد",
  trip_cancelled: "تم إلغاء الرحلة",
  date_change: "تغيير الموعد",
  duplicate_booking: "حجز مكرر",
  other: "أخرى",
};

const REASON_OPTIONS = (Object.keys(REASON_LABEL) as ResaleReason[]).map((value) => ({
  value,
  label: REASON_LABEL[value],
}));

function ResaleCard({ resale, catalog }: { resale: TicketResaleRow; catalog: ReturnType<typeof useCatalog> }) {
  const waMessage = `مرحباً، أنا مهتم بتذكرة إعادة البيع: ${resale.from_airport} → ${resale.to_airport} بتاريخ ${resale.departure_date} (${formatPrice(resale.asking_price, resale.currency)})`;
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900">
            {airportLabel(resale.from_airport, catalog.airports)} → {airportLabel(resale.to_airport, catalog.airports)}
          </p>
          <p className="text-sm text-slate-600">{formatDate(resale.departure_date)}</p>
        </div>
        <Badge tone="savings">تذكرة موثّقة</Badge>
      </div>

      {resale.airline_code ? (
        <p className="text-sm text-slate-600">{airlineName(resale.airline_code, catalog.airlines)}</p>
      ) : null}

      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-extrabold text-slate-900">{formatPrice(resale.asking_price, resale.currency)}</p>
      </div>

      <a
        href={whatsAppLink(PLATFORM_WHATSAPP, waMessage)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1da851]"
      >
        <WhatsAppIcon className="size-4" />
        أنا مهتم — تواصل معنا
      </a>
    </Card>
  );
}

function ListTicketForm({ onPosted }: { onPosted: () => void }) {
  const catalog = useCatalog();
  const [formFrom, setFormFrom] = useState("");
  const [formTo, setFormTo] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [airlineCode, setAirlineCode] = useState("");
  const [passengerName, setPassengerName] = useState("");
  const [pnrReference, setPnrReference] = useState("");
  const [reason, setReason] = useState<ResaleReason>("other");
  const [originalPrice, setOriginalPrice] = useState(0);
  const [askingPrice, setAskingPrice] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const airportOptions = [
    { value: "", label: "اختر" },
    ...catalog.airports.map((a) => ({ value: a.code, label: `${a.city} (${a.code})` })),
  ];
  const airlineOptions = [
    { value: "", label: "غير محدد" },
    ...catalog.airlines.map((a) => ({ value: a.code, label: a.name })),
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formFrom || !formTo || !departureDate || !passengerName || !pnrReference || !originalPrice || !askingPrice) {
      setSubmitError("من فضلك أكمل الحقول المطلوبة");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createTicketResale({
        airlineCode,
        fromAirport: formFrom,
        toAirport: formTo,
        departureDate,
        returnDate,
        passengerName,
        pnrReference,
        reason,
        originalPrice,
        askingPrice,
      });
      onPosted();
    } catch (err) {
      setSubmitError(friendlyErrorMessage(err, "تعذر نشر التذكرة، جرّب تاني.", "TicketResalePage.submit"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-4 font-bold">بيانات التذكرة</h2>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Select
          label="من"
          required
          value={formFrom}
          onChange={(e) => setFormFrom(e.target.value)}
          options={airportOptions}
          placeholder="اختر مطار المغادرة"
        />
        <Select
          label="إلى"
          required
          value={formTo}
          onChange={(e) => setFormTo(e.target.value)}
          options={airportOptions}
          placeholder="اختر مطار الوصول"
        />
        <Input
          label="تاريخ السفر"
          type="date"
          required
          value={departureDate}
          onChange={(e) => setDepartureDate(e.target.value)}
        />
        <Input
          label="تاريخ العودة (اختياري)"
          type="date"
          value={returnDate}
          onChange={(e) => setReturnDate(e.target.value)}
        />
        <Select
          label="شركة الطيران"
          value={airlineCode}
          onChange={(e) => setAirlineCode(e.target.value)}
          options={airlineOptions}
        />
        <Select
          label="سبب البيع"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value as ResaleReason)}
          options={REASON_OPTIONS}
        />
        <Input
          label="اسم المسافر على التذكرة"
          required
          value={passengerName}
          onChange={(e) => setPassengerName(e.target.value)}
        />
        <Input
          label="رقم مرجع الحجز (PNR)"
          required
          value={pnrReference}
          onChange={(e) => setPnrReference(e.target.value)}
        />
        <Input
          label="السعر الأصلي (USD)"
          type="number"
          min={1}
          required
          value={originalPrice || ""}
          onChange={(e) => setOriginalPrice(Number(e.target.value))}
        />
        <Input
          label="السعر المطلوب (USD)"
          type="number"
          min={1}
          required
          value={askingPrice || ""}
          onChange={(e) => setAskingPrice(Number(e.target.value))}
        />
        <p className="sm:col-span-2 text-xs text-slate-500">
          سيتم مراجعة التذكرة والتحقق منها قبل ظهورها للمسافرين الآخرين
        </p>
        {submitError ? <p className="sm:col-span-2 text-sm text-red-600">{submitError}</p> : null}
        <div className="sm:col-span-2">
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? "جاري النشر..." : "نشر التذكرة"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function TicketResalePage() {
  const catalog = useCatalog();
  const [resales, setResales] = useState<TicketResaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function loadResales() {
    setLoading(true);
    fetchActiveTicketResales({ from: from || undefined, to: to || undefined })
      .then(setResales)
      .catch((e) => setError(friendlyErrorMessage(e, "حصل خطأ في التحميل، جرّب تاني.", "TicketResalePage.load")))
      .finally(() => setLoading(false));
  }

  useEffect(loadResales, [from, to]);

  const airportOptions = [
    { value: "", label: "الكل" },
    ...catalog.airports.map((a) => ({ value: a.code, label: `${a.city} (${a.code})` })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">سوق إعادة بيع التذاكر</h1>
          <p className="text-slate-600">تذاكر مؤكدة معروضة من مسافرين آخرين — تواصل معنا للاستفسار</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "إغلاق" : "أعرض تذكرتك"}</Button>
      </div>

      {showForm ? (
        <AuthGate
          title="سجّل الدخول لعرض تذكرتك"
          description="نحتاج تسجيل دخولك حتى نتمكن من التواصل معك بخصوص تذكرتك ومتابعة حالتها"
        >
          {() =>
            submitted ? (
              <Card className="text-green-700">تم استلام تذكرتك وسيتم مراجعتها قريباً</Card>
            ) : (
              <ListTicketForm
                onPosted={() => {
                  setSubmitted(true);
                  setShowForm(false);
                  loadResales();
                }}
              />
            )
          }
        </AuthGate>
      ) : null}

      <div className="flex flex-wrap gap-4">
        <Select label="من" value={from} onChange={(e) => setFrom(e.target.value)} options={airportOptions} className="max-w-xs" />
        <Select label="إلى" value={to} onChange={(e) => setTo(e.target.value)} options={airportOptions} className="max-w-xs" />
      </div>

      {loading ? (
        <CardsSkeleton count={3} />
      ) : error ? (
        <Card className="text-red-600">{error}</Card>
      ) : resales.length === 0 ? (
        <EmptyState
          icon="🎟️"
          title="لا توجد تذاكر معروضة حالياً"
          subtitle="جرّب وجهة أو مسار مختلف، أو راجع الصفحة لاحقاً"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resales.map((r) => (
            <ResaleCard key={r.id} resale={r} catalog={catalog} />
          ))}
        </div>
      )}
    </div>
  );
}
