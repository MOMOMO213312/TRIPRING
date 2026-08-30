import { useEffect, useRef, useState } from "react";

import {
  fetchActiveResellerPlans,
  fetchMyLatestResellerSubscription,
  submitResellerSubscription,
} from "../../lib/affiliate";
import { friendlyErrorMessage } from "../../lib/errors";
import { PAYMENT_METHODS } from "../../lib/payment-config";
import { RESELLER_SUBSCRIPTION_STATUS_LABELS } from "../../lib/admin";
import type { AffiliateResellerSubscriptionRow, PaymentMethod, ResellerSubscriptionPlanRow } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";

/** Shows the affiliate's current net-price-program subscription status, or —
 *  when there's nothing usable (none yet / expired / rejected / cancelled) —
 *  a plan picker + payment form reusing the same manual bank/InstaPay/Vodafone
 *  Cash + proof-upload flow the booking flow already uses. */
export function ResellerSubscriptionCard({
  affiliateId,
  onSubscriptionActive,
}: {
  affiliateId: string;
  onSubscriptionActive?: (sub: AffiliateResellerSubscriptionRow) => void;
}) {
  const [sub, setSub] = useState<AffiliateResellerSubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetchMyLatestResellerSubscription(affiliateId)
      .then((s) => {
        setSub(s);
        const isValidActive = s && s.status === "active" && s.ends_at && new Date(s.ends_at).getTime() > Date.now();
        if (isValidActive && s) onSubscriptionActive?.(s);
      })
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل حالة الاشتراك", "ResellerSubscriptionCard.load")))
      .finally(() => setLoading(false));
  }

  useEffect(load, [affiliateId]);

  if (loading) return <Card className="text-sm text-slate-500">جاري التحميل...</Card>;

  const isValidActive = !!sub && sub.status === "active" && !!sub.ends_at && new Date(sub.ends_at).getTime() > Date.now();
  const needsNewSubscription = !sub || sub.status === "expired" || sub.status === "rejected" || sub.status === "cancelled";

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {sub && !needsNewSubscription ? (
        <Card>
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-900">اشتراك برنامج السعر الرسمي</p>
            <Badge tone={isValidActive ? "empty_seat" : "default"}>{RESELLER_SUBSCRIPTION_STATUS_LABELS[sub.status]}</Badge>
          </div>
          {sub.status === "pending_payment" ? (
            <p className="mt-2 text-sm text-slate-600">طلبك بانتظار مراجعة الأدمن للتأكد من إثبات الدفع.</p>
          ) : isValidActive && sub.ends_at ? (
            <p className="mt-2 text-sm text-slate-600">
              مفعّل حتى {new Date(sub.ends_at).toLocaleDateString("ar-EG")} — تقدر تشوف السعر الرسمي وتعمل طلبات بيع.
            </p>
          ) : null}
        </Card>
      ) : (
        <SubscribeForm affiliateId={affiliateId} onDone={load} />
      )}
    </div>
  );
}

function SubscribeForm({ affiliateId, onDone }: { affiliateId: string; onDone: () => void }) {
  const [plans, setPlans] = useState<ResellerSubscriptionPlanRow[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [paymentRef, setPaymentRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchActiveResellerPlans()
      .then((p) => {
        setPlans(p);
        if (p.length) setSelectedPlanId(p[0].id);
      })
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل الباقات المتاحة", "SubscribeForm.load")))
      .finally(() => setLoadingPlans(false));
  }, []);

  async function submit() {
    if (!selectedPlanId) {
      setError("اختار باقة الأول");
      return;
    }
    if (!file) {
      setError("ارفع إثبات الدفع");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitResellerSubscription({
        affiliateId,
        planId: selectedPlanId,
        paymentMethod,
        paymentRef,
        proofFile: file,
      });
      onDone();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر إرسال طلب الاشتراك", "SubscribeForm.submit"));
      setSubmitting(false);
    }
  }

  if (loadingPlans) return <Card className="text-sm text-slate-500">جاري تحميل الباقات...</Card>;

  if (!plans.length) {
    return <Card className="text-center text-sm text-slate-400">لا توجد باقات متاحة حاليًا.</Card>;
  }

  return (
    <Card className="space-y-4">
      <div>
        <p className="font-bold text-slate-900">اشترك في برنامج السعر الرسمي</p>
        <p className="mt-1 text-sm text-slate-500">اختار باقة عشان تقدر تشوف السعر الرسمي للصفقات وتعمل طلبات بيع لعملائك.</p>
      </div>

      <div className="space-y-2">
        {plans.map((p) => (
          <label
            key={p.id}
            className={`block cursor-pointer rounded-xl border p-3 ${
              selectedPlanId === p.id ? "border-accent bg-[#E5F4FB]" : "border-slate-200"
            }`}
          >
            <input
              type="radio"
              name="plan"
              className="me-2"
              checked={selectedPlanId === p.id}
              onChange={() => setSelectedPlanId(p.id)}
            />
            <span className="font-semibold">{p.name}</span>
            <span className="ms-2 text-sm text-slate-600">
              {p.price} · {p.duration_days} يوم
            </span>
            {p.description ? <p className="mt-1 text-xs text-slate-500">{p.description}</p> : null}
          </label>
        ))}
      </div>

      <div className="space-y-2 border-t border-slate-100 pt-3">
        <p className="text-sm text-slate-600">اختار طريقة الدفع وحوّل قيمة الباقة</p>
        {PAYMENT_METHODS.map((pm) => (
          <label
            key={pm.value}
            className={`block cursor-pointer rounded-xl border p-3 ${
              paymentMethod === pm.value ? "border-accent bg-[#E5F4FB]" : "border-slate-200"
            }`}
          >
            <input
              type="radio"
              name="payment"
              className="me-2"
              checked={paymentMethod === pm.value}
              onChange={() => setPaymentMethod(pm.value)}
            />
            <span className="font-semibold">{pm.label}</span>
            <p className="mt-1 text-sm text-slate-600">{pm.details}</p>
          </label>
        ))}
      </div>

      <Input
        label="مرجع الدفع (رقم العملية) — اختياري"
        value={paymentRef}
        onChange={(e) => setPaymentRef(e.target.value)}
      />

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button type="button" variant="outline" fullWidth onClick={() => inputRef.current?.click()}>
          {file ? `✓ ${file.name}` : "📎 رفع إثبات الدفع (صورة أو PDF)"}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button type="button" fullWidth disabled={submitting} onClick={submit}>
        {submitting ? "جاري الإرسال..." : "إرسال طلب الاشتراك"}
      </Button>
    </Card>
  );
}
