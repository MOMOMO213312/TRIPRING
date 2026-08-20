import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import {
  createBooking,
  fetchAdditionalServices,
  fetchDealById,
} from "../lib/api";
import { PAYMENT_METHODS } from "../lib/payment-config";
import { formatRoute } from "../lib/deal-utils";
import { setLastBooking } from "../lib/session";
import { formatPrice } from "../lib/utils";
import type { AdditionalServiceRow, DealRow, PaymentMethod } from "../types/database";

type Traveler = {
  full_name: string;
  date_of_birth: string;
  passport_number: string;
  nationality: string;
  traveler_type: "adult" | "child" | "infant";
};

const STEPS = ["المسافرون", "خدمات إضافية", "المراجعة", "الدفع"];

export function BookingPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [services, setServices] = useState<AdditionalServiceRow[]>([]);
  const [selectedServices, setSelectedServices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const [stepError, setStepError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    Promise.all([fetchDealById(dealId), fetchAdditionalServices()])
      .then(([d, s]) => {
        setDeal(d);
        setServices(s);
        if (!d) setError("العرض غير متاح");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "خطأ"))
      .finally(() => setLoading(false));
  }, [dealId]);

  // Resize the travelers array to match adults/children/infants counts
  // WITHOUT wiping names already typed for travelers that still exist —
  // only append blank rows for newly added travelers, and trim from the
  // end when a count goes down. Uses functional setState so this effect
  // doesn't need `travelers` in its deps (avoids re-running on every
  // keystroke) while still reading the latest travelers array.
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

  // Step buttons are type="button" (they must not trigger native form submit),
  // which means the browser's built-in `required` validation never fires when
  // moving between steps. This replicates that validation manually so a user
  // can't reach payment with empty name/phone/traveler fields.
  function validateStep(current: number): string | null {
    if (current === 0) {
      if (!customerName.trim()) return "من فضلك أدخل الاسم الكامل";
      if (!customerPhone.trim()) return "من فضلك أدخل رقم الهاتف";
      const emptyTraveler = travelers.findIndex((t) => !t.full_name.trim());
      if (emptyTraveler !== -1) return `من فضلك أدخل اسم المسافر رقم ${emptyTraveler + 1} كما في الجواز`;
    }
    return null;
  }

  function goToStep(next: number) {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setStep(next);
  }

  function servicesTotal(): number {
    return services.reduce((sum, s) => {
      const qty = selectedServices[s.id] ?? 0;
      return sum + s.price * qty;
    }, 0);
  }

  function estimatedTotal(): number {
    if (!deal) return 0;
    const base =
      deal.price * adults +
      (deal.child_price ?? deal.price * 0.75) * children +
      (deal.infant_price ?? deal.price * 0.1) * infants;
    return base + servicesTotal();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!deal) return;
    if (deal.available_seats <= 0) {
      setError("عذراً، المقاعد المتاحة في هذا العرض نفدت.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const servicePayload = services
        .filter((s) => (selectedServices[s.id] ?? 0) > 0)
        .map((s) => ({
          service_id: s.id,
          quantity: selectedServices[s.id] ?? 1,
          unit_price: s.price,
        }));

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
        services: servicePayload,
      });
      setLastBooking(result.booking_number, customerPhone || customerEmail || "");
      navigate("/confirmation", {
        state: {
          booking: result,
          deal,
          paymentMethod,
          travelers,
          services: selectedServices,
          customerPhone,
          customerEmail,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء الحجز");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-slate-500">جاري التحميل...</p>;
  if (!deal) {
    return (
      <Card className="text-center text-red-600">{error ?? "العرض غير موجود"}</Card>
    );
  }
  if (deal.available_seats <= 0) {
    return (
      <Card className="text-center text-slate-700">
        عذراً، المقاعد المتاحة في هذا العرض نفدت. جرّب البحث عن عرض آخر.
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إتمام الحجز</h1>
        <p className="text-slate-600">{formatRoute(deal)} · {formatPrice(deal.price, deal.currency ?? "USD")}</p>
      </div>

      <div className="flex gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex-1 rounded-lg px-2 py-2 text-center text-xs font-semibold sm:text-sm ${
              i === step ? "bg-accent text-white" : i < step ? "bg-[#FFD9C2] text-[#155E7A]" : "bg-slate-100 text-slate-500"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {step === 0 ? (
          <Card className="space-y-4">
            <h2 className="font-bold">بيانات التواصل</h2>
            <Input label="الاسم الكامل" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <Input label="رقم الهاتف" required type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            <Input label="البريد الإلكتروني (اختياري)" type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            <div className="grid grid-cols-3 gap-3">
              <Input label="بالغين" type="number" min={1} value={adults} onChange={(e) => setAdults(Number(e.target.value))} />
              <Input label="أطفال" type="number" min={0} value={children} onChange={(e) => setChildren(Number(e.target.value))} />
              <Input label="رضّع" type="number" min={0} value={infants} onChange={(e) => setInfants(Number(e.target.value))} />
            </div>
            <h3 className="pt-2 font-bold">بيانات المسافرين</h3>
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
            ))}
            {stepError ? <p className="text-sm text-red-600">{stepError}</p> : null}
            <Button type="button" fullWidth onClick={() => goToStep(1)}>
              التالي
            </Button>
          </Card>
        ) : null}

        {step === 1 ? (
          <Card className="space-y-4">
            <h2 className="font-bold">خدمات إضافية</h2>
            {services.length === 0 ? (
              <p className="text-slate-500">لا توجد خدمات إضافية متاحة حالياً</p>
            ) : (
              services.map((s) => (
                <label key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                  <span>
                    {s.type} — {formatPrice(s.price, deal.currency ?? "USD")}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={selectedServices[s.id] ?? 0}
                    onChange={(e) =>
                      setSelectedServices({ ...selectedServices, [s.id]: Number(e.target.value) })
                    }
                    className="w-16 rounded border border-slate-200 px-2 py-1 text-center"
                  />
                </label>
              ))
            )}
            <div className="flex gap-3">
              <Button type="button" variant="outline" fullWidth onClick={() => goToStep(0)}>
                السابق
              </Button>
              <Button type="button" fullWidth onClick={() => goToStep(2)}>
                التالي
              </Button>
            </div>
          </Card>
        ) : null}

        {step === 2 ? (
          <Card className="space-y-4">
            <h2 className="font-bold">مراجعة الحجز</h2>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              ⚠️ هذا السعر تقديري وغير نهائي. سيقوم فريق الوكالة بتأكيد السعر وتوفر المقعد فعلياً بعد إرسال طلبك، وقد يتغير السعر قبل التأكيد النهائي.
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">المسار</dt><dd>{formatRoute(deal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">الاسم</dt><dd>{customerName}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">الهاتف</dt><dd>{customerPhone}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">المسافرون</dt><dd>{adults} بالغ · {children} طفل · {infants} رضيع</dd></div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-bold">
                <dt>الإجمالي التقديري</dt>
                <dd>{formatPrice(estimatedTotal(), deal.currency ?? "USD")}</dd>
              </div>
            </dl>
            <div className="flex gap-3">
              <Button type="button" variant="outline" fullWidth onClick={() => goToStep(1)}>
                السابق
              </Button>
              <Button type="button" fullWidth onClick={() => goToStep(3)}>
                التالي
              </Button>
            </div>
          </Card>
        ) : null}

        {step === 3 ? (
          <Card className="space-y-4">
            <h2 className="font-bold">طريقة الدفع</h2>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              ⚠️ عند الضغط على "تأكيد الحجز" سيتم إرسال <strong>طلب حجز</strong> إلى الوكالة، وليس تذكرة مؤكدة. الوكالة ستتواصل معك لتأكيد السعر والمقعد قبل إتمام الدفع.
            </div>
            <p className="text-sm text-slate-600">الدفع يدوي — أكمل التحويل ثم أرسل الإيصال عبر واتساب بعد تأكيد الوكالة</p>
            {PAYMENT_METHODS.map((pm) => (
              <label
                key={pm.value}
                className={`block cursor-pointer rounded-xl border p-4 ${
                  paymentMethod === pm.value ? "border-accent bg-[#FFEDE5]" : "border-slate-200"
                }`}
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
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex gap-3">
              <Button type="button" variant="outline" fullWidth onClick={() => setStep(2)}>
                السابق
              </Button>
              <Button type="submit" fullWidth disabled={submitting}>
                {submitting ? "جاري الحجز..." : "تأكيد الحجز"}
              </Button>
            </div>
          </Card>
        ) : null}
      </form>
    </div>
  );
}
