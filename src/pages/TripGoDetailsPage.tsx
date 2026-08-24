import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { createBooking, fetchAdditionalServices, fetchDealById, getAgencyWhatsApp } from "../lib/api";
import { PAYMENT_METHODS } from "../lib/payment-config";
import { airlineName, baggageBadgeLabel, formatRoute, stopsMetaLabel } from "../lib/deal-utils";
import { defaultTransfer, transportServices, tripGoTotal } from "../lib/tripgo";
import { setLastBooking } from "../lib/session";
import { cn, formatDate, formatPrice, formatTime, isValidEmail, isValidPhone, whatsAppLink } from "../lib/utils";
import { friendlyErrorMessage } from "../lib/errors";
import { useCatalog } from "../hooks/useCatalog";
import type { AdditionalServiceRow, DealRow, PaymentMethod } from "../types/database";

type Traveler = {
  full_name: string;
  date_of_birth: string;
  passport_number: string;
  nationality: string;
  traveler_type: "adult" | "child" | "infant";
};

const STEPS = [
  { key: "flight", title: "الرحلة", icon: "✈️" },
  { key: "pickup", title: "مكان الاستلام", icon: "📍" },
  { key: "transfer", title: "تفاصيل النقل", icon: "🕒" },
  { key: "vehicle", title: "وسيلة النقل", icon: "🚐" },
  { key: "passengers", title: "المسافرون", icon: "🧑‍🤝‍🧑" },
  { key: "review", title: "مراجعة الرحلة", icon: "🧾" },
  { key: "payment", title: "الدفع", icon: "💳" },
] as const;

export function TripGoDetailsPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const catalog = useCatalog();

  const [deal, setDeal] = useState<DealRow | null>(null);
  const [services, setServices] = useState<AdditionalServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Pickup + transfer details
  const [pickupLocation, setPickupLocation] = useState("");
  const [pickupArea, setPickupArea] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  // Passengers
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [travelers, setTravelers] = useState<Traveler[]>([
    { full_name: "", date_of_birth: "", passport_number: "", nationality: "EG", traveler_type: "adult" },
  ]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    Promise.all([fetchDealById(dealId), fetchAdditionalServices()])
      .then(([d, s]) => {
        setDeal(d);
        setServices(s);
        if (!d) {
          setError("الرحلة غير متاحة");
          return;
        }
        setFlightNumber(d.flight_number ?? "");
        const def = defaultTransfer(s);
        if (def) setSelectedVehicleId(def.id);
      })
      .catch((e) => setError(friendlyErrorMessage(e, "حصل خطأ في تحميل العرض، جرّب تاني.", "TripGoDetailsPage.load")))
      .finally(() => setLoading(false));
  }, [dealId]);

  useEffect(() => {
    setTravelers((prev) => {
      const blank = (traveler_type: Traveler["traveler_type"]): Traveler => ({
        full_name: "",
        date_of_birth: "",
        passport_number: "",
        nationality: "EG",
        traveler_type,
      });
      const byType = (t: Traveler["traveler_type"]) => prev.filter((p) => p.traveler_type === t);
      const resize = (existing: Traveler[], count: number, type: Traveler["traveler_type"]) => {
        if (existing.length === count) return existing;
        if (existing.length > count) return existing.slice(0, count);
        return [...existing, ...Array.from({ length: count - existing.length }, () => blank(type))];
      };
      const next = [
        ...resize(byType("adult"), adults, "adult"),
        ...resize(byType("child"), children, "child"),
        ...resize(byType("infant"), infants, "infant"),
      ];
      return next.length ? next : prev;
    });
  }, [adults, children, infants]);

  const vehicles = transportServices(services);
  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) ?? null;
  const currency = deal?.currency ?? "USD";
  const flightSubtotal = deal
    ? deal.price * adults + (deal.child_price ?? deal.price * 0.75) * children + (deal.infant_price ?? deal.price * 0.1) * infants
    : 0;
  const transferPrice = selectedVehicle?.price ?? 0;
  const total = tripGoTotal(flightSubtotal, transferPrice);

  function stepError(): string | null {
    if (STEPS[step].key === "pickup") {
      if (!pickupLocation.trim()) return "أدخل عنوان الاستلام (المنزل / الفندق)";
    }
    if (STEPS[step].key === "vehicle") {
      if (!selectedVehicle) return "اختر وسيلة النقل";
    }
    if (STEPS[step].key === "passengers") {
      if (!customerName.trim()) return "أدخل الاسم الكامل";
      if (!isValidPhone(customerPhone)) return "رقم الهاتف غير صالح — أدخله بالصيغة الدولية مثل +20xxxxxxxxxx";
      if (customerEmail.trim() && !isValidEmail(customerEmail)) return "البريد الإلكتروني غير صالح";
      const emptyTraveler = travelers.findIndex((t) => !t.full_name.trim());
      if (emptyTraveler !== -1) return `أدخل اسم المسافر رقم ${emptyTraveler + 1} كما في الجواز`;
    }
    return null;
  }

  function goNext() {
    const err = stepError();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (!deal || !dealId || !selectedVehicle) return;

    setSubmitting(true);
    setError(null);

    try {
      const fresh = await fetchDealById(dealId);
      if (!fresh) {
        setError("عذراً، هذه الرحلة لم تعد متاحة.");
        setSubmitting(false);
        return;
      }
      const seatsNeeded = adults + children;
      if (fresh.available_seats < seatsNeeded) {
        setError(
          fresh.available_seats <= 0
            ? "عذراً، المقاعد المتاحة في هذه الرحلة نفدت منذ قليل."
            : `عدد المقاعد المتاحة الآن (${fresh.available_seats}) أقل من عدد المسافرين (${seatsNeeded}).`,
        );
        setDeal(fresh);
        setSubmitting(false);
        return;
      }
      setDeal(fresh);
    } catch {
      // Best-effort — DB-level check on submit remains the source of truth.
    }

    try {
      const travelerPayload = travelers.map((t) => ({
        full_name: t.full_name,
        date_of_birth: t.date_of_birth || null,
        passport_number: t.passport_number || null,
        nationality: t.nationality || null,
        traveler_type: t.traveler_type,
      }));

      const result = await createBooking({
        dealId: deal.id,
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        adultsCount: adults,
        childrenCount: children,
        infantsCount: infants,
        paymentMethod,
        travelers: travelerPayload,
        services: [{ service_id: selectedVehicle.id, quantity: 1, unit_price: selectedVehicle.price }],
      });
      setLastBooking(result.booking_number, customerPhone || customerEmail || "");
      navigate("/confirmation", {
        state: {
          booking: result,
          deal,
          paymentMethod,
          travelers,
          customerName,
          customerPhone,
          customerEmail,
          adults,
          children,
          infants,
          tripGo: {
            pickupLocation,
            pickupArea,
            flightNumber,
            pickupTime,
            vehicle: selectedVehicle,
          },
        },
      });
    } catch (err) {
      setError(friendlyErrorMessage(err, "فشل إنشاء الحجز، جرّب تاني أو تواصل معانا.", "TripGoDetailsPage.createBooking"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || catalog.loading) return <p className="text-slate-500">جاري التحميل...</p>;
  if (!deal) {
    return (
      <Card className="text-center">
        <p className="text-red-600">{error ?? "الرحلة غير موجودة"}</p>
        <Link to="/tripgo" className="mt-4 inline-block text-[#0C7BB3]">
          العودة لـ TripGo
        </Link>
      </Card>
    );
  }
  if (deal.available_seats <= 0) {
    return <Card className="text-center text-slate-700">عذراً، المقاعد المتاحة في هذه الرحلة نفدت.</Card>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-xs font-bold text-[#0C7BB3]">🚐 TripGo</p>
        <h1 className="text-2xl font-bold text-slate-900">{formatRoute(deal)}</h1>
        <p className="text-slate-600">Flight + Transfer</p>
      </div>

      {/* Stepper */}
      <div className="-mx-1 flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex shrink-0 items-center gap-1">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-xs font-bold transition",
                i === step
                  ? "bg-[#0C7BB3] text-white"
                  : i < step
                    ? "bg-[#16A34A] text-white"
                    : "bg-slate-100 text-slate-400",
              )}
            >
              {i < step ? "✓" : s.icon}
            </div>
            {i < STEPS.length - 1 ? (
              <span className={cn("h-0.5 w-4", i < step ? "bg-[#16A34A]" : "bg-slate-200")} />
            ) : null}
          </div>
        ))}
      </div>
      <p className="-mt-3 text-sm font-bold text-slate-700">
        {step + 1}. {STEPS[step].title}
      </p>

      <form onSubmit={handleConfirm}>
        {STEPS[step].key === "flight" ? (
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-latin text-lg font-extrabold text-slate-900">{deal.from_airport}</span>
              <span className="mx-2 h-px flex-1 bg-slate-200" />
              <span className="font-latin text-lg font-extrabold text-slate-900">{deal.to_airport}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-latin font-bold">{formatTime(deal.departure_time)}</span>
              <span className="text-slate-400">→</span>
              <span className="font-latin font-bold">{formatTime(deal.arrival_time)}</span>
            </div>
            <dl className="space-y-2 text-sm">
              <Row label="التاريخ" value={formatDate(deal.departure_date)} />
              <Row label="شركة الطيران" value={airlineName(deal.airline_code, catalog.airlines)} />
              <Row label="التوقفات" value={stopsMetaLabel(deal.stops)} />
              {deal.duration_hours ? <Row label="المدة" value={`${deal.duration_hours} ساعة`} /> : null}
              {baggageBadgeLabel(deal) ? <Row label="الأمتعة" value={baggageBadgeLabel(deal)!} /> : null}
            </dl>
            <div className="rounded-xl border border-[#16A34A]/25 bg-[#F0FDF4] p-3 text-sm font-bold text-[#16A34A]">
              ✓ Airport Transfer Included — هيتحدد في الخطوات الجاية
            </div>
          </Card>
        ) : null}

        {STEPS[step].key === "pickup" ? (
          <Card className="space-y-4">
            <p className="text-sm text-slate-600">من فين هنستلمك عشان نوصّلك المطار؟</p>
            <Input
              label="عنوان الاستلام (المنزل / الفندق)"
              required
              placeholder="مثال: شقة 12، برج النيل، المهندسين"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
            />
            <Input
              label="المنطقة / الحي (اختياري)"
              placeholder="مثال: المهندسين، الجيزة"
              value={pickupArea}
              onChange={(e) => setPickupArea(e.target.value)}
            />
          </Card>
        ) : null}

        {STEPS[step].key === "transfer" ? (
          <Card className="space-y-4">
            <p className="text-sm text-slate-600">تفاصيل تنسيق النقل — عشان السائق يكون في انتظارك بالظبط.</p>
            <Input
              label="رقم الرحلة (اختياري)"
              placeholder="مثال: MS 123"
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value)}
            />
            <Input
              label="وقت الاستلام المفضل"
              type="time"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
            />
            <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <p className="flex items-center gap-1.5 font-semibold">
                <span aria-hidden>🚐</span> {pickupLocation || "عنوانك"} → المطار
              </p>
              <p className="flex items-center gap-1.5 font-semibold">
                <span aria-hidden>🚐</span> المطار → {catalog.airports.find((a) => a.code === deal.to_airport)?.city ?? deal.to_airport}
              </p>
            </div>
          </Card>
        ) : null}

        {STEPS[step].key === "vehicle" ? (
          <Card className="space-y-3">
            <p className="text-sm text-slate-600">اختار وسيلة النقل اللي تناسبك — كلها مشمولة كجزء من رحلة TripGo.</p>
            {vehicles.length === 0 ? (
              <p className="text-sm text-slate-500">لا توجد وسائل نقل متاحة حالياً.</p>
            ) : (
              <div className="space-y-2">
                {vehicles.map((v) => (
                  <label
                    key={v.id}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition",
                      selectedVehicleId === v.id ? "border-[#0C7BB3] bg-[#E5F4FB]" : "border-slate-200 bg-white hover:border-slate-300",
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="vehicle"
                        checked={selectedVehicleId === v.id}
                        onChange={() => setSelectedVehicleId(v.id)}
                      />
                      <span>
                        <span className="block font-semibold text-slate-900">{v.name}</span>
                        {v.description ? <span className="block text-xs text-slate-500">{v.description}</span> : null}
                      </span>
                    </span>
                    <span className="font-latin shrink-0 font-bold text-slate-900">{formatPrice(v.price, currency)}</span>
                  </label>
                ))}
              </div>
            )}
          </Card>
        ) : null}

        {STEPS[step].key === "passengers" ? (
          <Card className="space-y-4">
            <Input label="الاسم الكامل" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <Input
              label="رقم الهاتف"
              required
              type="tel"
              placeholder="+20xxxxxxxxxx"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
            <Input label="البريد الإلكتروني (اختياري)" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            <div className="grid grid-cols-3 gap-3">
              <Input label="بالغين" type="number" min={1} value={adults} onChange={(e) => setAdults(Number(e.target.value))} />
              <Input label="أطفال" type="number" min={0} value={children} onChange={(e) => setChildren(Number(e.target.value))} />
              <Input label="رضّع" type="number" min={0} value={infants} onChange={(e) => setInfants(Number(e.target.value))} />
            </div>
            <div className="space-y-3 border-t border-slate-100 pt-4">
              {travelers.map((t, i) => (
                <div key={i} className="space-y-3 rounded-lg border border-slate-100 p-3">
                  <p className="text-sm font-medium text-slate-600">
                    مسافر {i + 1} ({t.traveler_type === "adult" ? "بالغ" : t.traveler_type === "child" ? "طفل" : "رضيع"})
                  </p>
                  <Input
                    label="الاسم كما في الجواز"
                    required
                    value={t.full_name}
                    onChange={(e) => {
                      const next = [...travelers];
                      next[i] = { ...next[i], full_name: e.target.value };
                      setTravelers(next);
                    }}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="تاريخ الميلاد"
                      type="date"
                      value={t.date_of_birth}
                      onChange={(e) => {
                        const next = [...travelers];
                        next[i] = { ...next[i], date_of_birth: e.target.value };
                        setTravelers(next);
                      }}
                    />
                    <Input
                      label="رقم الجواز"
                      value={t.passport_number}
                      onChange={(e) => {
                        const next = [...travelers];
                        next[i] = { ...next[i], passport_number: e.target.value };
                        setTravelers(next);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {STEPS[step].key === "review" ? (
          <Card className="space-y-4">
            <h2 className="font-bold text-slate-900">مراجعة رحلة TripGo</h2>
            <dl className="space-y-2 text-sm">
              <Row label="المسار" value={formatRoute(deal)} />
              <Row label="التاريخ" value={formatDate(deal.departure_date)} />
              <Row label="المسافرون" value={`${adults} بالغ · ${children} طفل · ${infants} رضيع`} />
              <Row label="مكان الاستلام" value={pickupLocation || "—"} />
              {selectedVehicle ? <Row label="وسيلة النقل" value={`${selectedVehicle.name} — ${formatPrice(selectedVehicle.price, currency)}`} /> : null}
            </dl>
            <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">تذكرة الطيران</span>
                <span className="font-latin">{formatPrice(flightSubtotal, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">النقل من وإلى المطار</span>
                <span className="font-latin">{formatPrice(transferPrice, currency)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-bold">
                <span>إجمالي رحلة TripGo</span>
                <span className="font-latin text-[#0C7BB3]">{formatPrice(total, currency)}</span>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              ⚠️ السعر تقديري وغير نهائي — الضغط على "تأكيد حجز TripGo" يرسل طلب حجز للوكالة، هيتواصلوا معاك لتأكيد
              السعر والمقعد وتفاصيل الاستلام قبل الدفع الفعلي.
            </div>
          </Card>
        ) : null}

        {STEPS[step].key === "payment" ? (
          <Card className="space-y-4">
            <p className="text-sm text-slate-600">الدفع يدوي — أكمل التحويل ثم أرسل الإيصال عبر واتساب بعد تأكيد الوكالة.</p>
            {PAYMENT_METHODS.map((pm) => (
              <label
                key={pm.value}
                className={cn(
                  "block cursor-pointer rounded-xl border p-4",
                  paymentMethod === pm.value ? "border-accent bg-[#E5F4FB]" : "border-slate-200",
                )}
              >
                <input
                  type="radio"
                  name="payment"
                  value={pm.value}
                  checked={paymentMethod === pm.value}
                  onChange={() => setPaymentMethod(pm.value)}
                  className="me-2"
                />
                <span className="font-semibold">{pm.label}</span>
                <p className="mt-1 text-sm text-slate-600">{pm.details}</p>
              </label>
            ))}
            <div className="flex items-center justify-between rounded-xl bg-[#0C7BB3]/5 px-4 py-3">
              <span className="text-sm font-medium text-slate-700">إجمالي رحلة TripGo</span>
              <span className="text-lg font-extrabold text-[#0C7BB3]">{formatPrice(total, currency)}</span>
            </div>
          </Card>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex items-center gap-3">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={goBack}>
              رجوع
            </Button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <Button type="button" fullWidth onClick={goNext}>
              التالي
            </Button>
          ) : (
            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? "جاري تأكيد رحلة TripGo..." : "تأكيد حجز TripGo"}
            </Button>
          )}
        </div>
      </form>

      {step === STEPS.length - 1 ? (
        <a
          href={whatsAppLink(
            getAgencyWhatsApp(deal, catalog.agencies),
            `مرحباً، أريد تأكيد رحلة TripGo: ${formatRoute(deal)} — استلام من ${pickupLocation || "—"} — وسيلة النقل: ${selectedVehicle?.name ?? "—"}`,
          )}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-xs font-semibold text-slate-500 hover:text-[#0C7BB3]"
        >
          محتاج تأكيد تفاصيل الاستلام على واتساب؟ تواصل معنا
        </a>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
