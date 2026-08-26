import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

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
import { packagePrice, usePackageOptions } from "../lib/packages";
import type { PackageTier } from "../lib/packages";
import { friendlyErrorMessage } from "../lib/errors";
import { setLastBooking } from "../lib/session";
import { formatPrice, isValidEmail, isValidPhone } from "../lib/utils";
import type { AdditionalServiceRow, DealRow, PaymentMethod } from "../types/database";

type DealSelectionState = {
  selectedPackage?: PackageTier;
  selectedServiceIds?: string[];
};

type Traveler = {
  full_name: string;
  date_of_birth: string;
  passport_number: string;
  nationality: string;
  traveler_type: "adult" | "child" | "infant";
};

export function BookingPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const incomingSelection = (location.state as DealSelectionState | null) ?? null;
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [services, setServices] = useState<AdditionalServiceRow[]>([]);
  const [selectedServices, setSelectedServices] = useState<Record<string, number>>({});
  const [selectedPackage] = useState<PackageTier | null>(incomingSelection?.selectedPackage ?? null);
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
  const packageOptions = usePackageOptions();

  useEffect(() => {
    if (!dealId) return;
    Promise.all([fetchDealById(dealId), fetchAdditionalServices()])
      .then(([d, s]) => {
        setDeal(d);
        setServices(s);
        if (!d) {
          setError("العرض غير متاح");
          return;
        }
        // Pre-check the extra add-on services the customer picked on the deal-detail
        // page. Services already bundled for free inside the chosen package are
        // priced once via packageMarkup() below, not repeated here.
        const carriedIds = incomingSelection?.selectedServiceIds ?? [];
        if (carriedIds.length > 0) {
          setSelectedServices((prev) => {
            const next = { ...prev };
            for (const id of carriedIds) next[id] = 1;
            return next;
          });
        }
      })
      .catch((e) => {
        console.error("[BookingPage] failed to load deal:", e);
        setError("حصل خطأ في تحميل بيانات العرض، جرّب تاني.");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function validate(): string | null {
    if (!customerName.trim()) return "من فضلك أدخل الاسم الكامل";
    if (!customerPhone.trim()) return "من فضلك أدخل رقم الهاتف";
    if (!isValidPhone(customerPhone)) return "رقم الهاتف غير صالح — أدخله بالصيغة الدولية مثل +20xxxxxxxxxx";
    if (customerEmail.trim() && !isValidEmail(customerEmail)) return "البريد الإلكتروني غير صالح";
    const emptyTraveler = travelers.findIndex((t) => !t.full_name.trim());
    if (emptyTraveler !== -1) return `من فضلك أدخل اسم المسافر رقم ${emptyTraveler + 1} كما في الجواز`;
    return null;
  }

  function servicesTotal(): number {
    return services.reduce((sum, s) => {
      const qty = selectedServices[s.id] ?? 0;
      return sum + s.price * qty;
    }, 0);
  }

  function packageMarkup(): number {
    if (!deal || !selectedPackage) return 0;
    const pkg = packageOptions.find((p) => p.id === selectedPackage);
    if (!pkg) return 0;
    return packagePrice(deal.price, pkg) - deal.price;
  }

  function estimatedTotal(): number {
    if (!deal) return 0;
    const base =
      deal.price * adults +
      (deal.child_price ?? deal.price * 0.75) * children +
      (deal.infant_price ?? deal.price * 0.1) * infants;
    return base + packageMarkup() + servicesTotal();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!deal || !dealId) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    // Traveler details (name, DOB, passport) are the most effortful part of
    // this form, and price/seat data here is only as fresh as whatever the
    // agency last typed in manually off Amadeus — it can go stale between
    // page load and submit. Re-check right before creating the booking so a
    // seat that's gone, or a price the agency changed in the meantime, is
    // caught here with a clear message instead of silently charging a
    // different total than what was shown (the server always charges the
    // live deal price regardless — this is purely so the customer isn't
    // surprised by it).
    try {
      const fresh = await fetchDealById(dealId);
      if (!fresh) {
        setError("عذراً، هذا العرض لم يعد متاحاً.");
        setSubmitting(false);
        return;
      }
      const seatsNeeded = adults + children;
      if (fresh.available_seats < seatsNeeded) {
        setError(
          fresh.available_seats <= 0
            ? "عذراً، المقاعد المتاحة في هذا العرض نفدت منذ قليل."
            : `عدد المقاعد المتاحة الآن (${fresh.available_seats}) أقل من عدد المسافرين (${seatsNeeded}).`,
        );
        setDeal(fresh);
        setSubmitting(false);
        return;
      }
      const priceChanged =
        fresh.price !== deal.price ||
        (fresh.child_price ?? null) !== (deal.child_price ?? null) ||
        (fresh.infant_price ?? null) !== (deal.infant_price ?? null);
      if (priceChanged) {
        setDeal(fresh);
        setError(
          `تنبيه: سعر هذا العرض تغيّر منذ ما فتحت الصفحة (كان ${formatPrice(deal.price, deal.currency ?? "USD")}، بقى ${formatPrice(fresh.price, fresh.currency ?? "USD")}). راجع الإجمالي الجديد بالأسفل واضغط "تأكيد الحجز" تاني للمتابعة.`,
        );
        setSubmitting(false);
        return;
      }
      setDeal(fresh);
    } catch {
      // Network/availability check failure shouldn't trap the user — let
      // the booking attempt continue; the DB-level check on submit below is
      // still the source of truth and will block an actually-unavailable
      // booking.
    }

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
        farePackageTier: selectedPackage,
      });
      setLastBooking(result.booking_number, customerPhone || customerEmail || "");
      navigate("/confirmation", {
        state: {
          booking: result,
          deal,
          paymentMethod,
          travelers,
          services: selectedServices,
          customerName,
          customerPhone,
          customerEmail,
          adults,
          children,
          infants,
        },
      });
    } catch (err) {
      setError(friendlyErrorMessage(err, "فشل إنشاء الحجز، جرّب تاني أو تواصل معانا.", "BookingPage.createBooking"));
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

      {/* Single scrollable page instead of a multi-step wizard — every
         section is visible and editable at once so related info (contact,
         travelers, services, payment, totals) stays close together instead
         of being hidden behind "next" clicks. */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="space-y-4">
          <h2 className="font-bold">بيانات التواصل والمسافرين</h2>
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

        {services.length > 0 ? (
          <Card className="space-y-3">
            <h2 className="font-bold">خدمات إضافية (اختياري)</h2>
            {services.map((s) => (
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
            ))}
          </Card>
        ) : null}

        <Card className="space-y-4">
          <h2 className="font-bold">الملخص وطريقة الدفع</h2>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            ⚠️ السعر تقديري وغير نهائي، والضغط على "تأكيد الحجز" يرسل <strong>طلب حجز</strong> للوكالة وليس تذكرة
            مؤكدة — هيتواصلوا معاك لتأكيد السعر والمقعد قبل الدفع الفعلي.
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">المسار</dt><dd>{formatRoute(deal)}</dd></div>
            {selectedPackage ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">الباقة</dt>
                <dd className="font-semibold">
                  {packageOptions.find((p) => p.id === selectedPackage)?.label}
                  {" · "}
                  {formatPrice(packagePrice(deal.price, packageOptions.find((p) => p.id === selectedPackage)!), deal.currency ?? "USD")}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between"><dt className="text-slate-500">المسافرون</dt><dd>{adults} بالغ · {children} طفل · {infants} رضيع</dd></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-bold">
              <dt>الإجمالي التقديري</dt>
              <dd>{formatPrice(estimatedTotal(), deal.currency ?? "USD")}</dd>
            </div>
          </dl>
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">الدفع يدوي — أكمل التحويل ثم أرسل الإيصال عبر واتساب بعد تأكيد الوكالة</p>
            {PAYMENT_METHODS.map((pm) => (
              <label
                key={pm.value}
                className={`block cursor-pointer rounded-xl border p-4 ${
                  paymentMethod === pm.value ? "border-accent bg-[#E5F4FB]" : "border-slate-200"
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
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? "جاري التأكد من الحجز..." : "تأكيد الحجز"}
          </Button>
        </Card>
      </form>
    </div>
  );
}
