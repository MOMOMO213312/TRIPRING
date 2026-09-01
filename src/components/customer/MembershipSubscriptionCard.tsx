import { useEffect, useRef, useState } from "react";

import { AuthGate } from "../AuthGate";
import {
  CUSTOMER_SUBSCRIPTION_STATUS_LABELS,
  expireDueSubscriptions,
  fetchActiveMembershipTiers,
  fetchMyLatestSubscription,
  submitCustomerSubscription,
  subscriptionIsActive,
} from "../../lib/membership";
import { friendlyErrorMessage } from "../../lib/errors";
import { PAYMENT_METHODS } from "../../lib/payment-config";
import type { BillingPeriod, CustomerSubscriptionRow, MembershipTierRow, PaymentMethod } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";

const TIER_LABELS: Record<string, string> = { basic: "Basic", smart: "Smart", premium: "Premium" };

/** Shows the customer's current membership status, or — when there's nothing
 *  usable (none yet / expired / rejected / cancelled) — a tier picker +
 *  payment form reusing the same manual bank/InstaPay/Vodafone Cash +
 *  proof-upload flow the booking flow already uses. */
export function MembershipSubscriptionCard() {
  const [sub, setSub] = useState<CustomerSubscriptionRow | null>(null);
  const [tiers, setTiers] = useState<Record<string, MembershipTierRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      await expireDueSubscriptions().catch(() => undefined); // best-effort, non-blocking
      const [s, tierRows] = await Promise.all([fetchMyLatestSubscription(), fetchActiveMembershipTiers()]);
      setSub(s);
      const tierMap: Record<string, MembershipTierRow> = {};
      for (const t of tierRows) tierMap[t.id] = t;
      setTiers(tierMap);
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحميل حالة الاشتراك", "MembershipSubscriptionCard.load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Card className="text-sm text-slate-500">جاري التحميل...</Card>;

  const isActive = subscriptionIsActive(sub);
  const needsNewSubscription = !sub || sub.status === "expired" || sub.status === "rejected" || sub.status === "cancelled";
  const tier = sub ? tiers[sub.tier_id] : null;

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {sub && !needsNewSubscription ? (
        <Card>
          <div className="flex items-center justify-between">
            <p className="font-bold text-slate-900">
              اشتراكك {tier ? `— ${TIER_LABELS[tier.tier] ?? tier.name}` : ""}
            </p>
            <Badge tone={isActive ? "empty_seat" : "default"}>{CUSTOMER_SUBSCRIPTION_STATUS_LABELS[sub.status]}</Badge>
          </div>
          {sub.status === "pending_payment" ? (
            <p className="mt-2 text-sm text-slate-600">طلبك بانتظار مراجعة الأدمن للتأكد من إثبات الدفع.</p>
          ) : isActive && sub.ends_at ? (
            <div className="mt-2 space-y-1 text-sm text-slate-600">
              <p>مفعّل حتى {new Date(sub.ends_at).toLocaleDateString("ar-EG")}</p>
              {tier ? (
                <p>
                  خصم {tier.discount_percentage}% على الحجوزات
                  {tier.priority_minutes > 0 ? ` · أولوية إشعارات ${tier.priority_minutes} دقيقة قبل الجميع` : ""}
                </p>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : (
        <SubscribeForm onDone={load} />
      )}
    </div>
  );
}

function SubscribeForm({ onDone }: { onDone: () => void }) {
  const [tiers, setTiers] = useState<MembershipTierRow[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [paymentRef, setPaymentRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loadingTiers, setLoadingTiers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchActiveMembershipTiers()
      .then((t) => {
        setTiers(t);
        if (t.length) setSelectedTierId(t[0].id);
      })
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل الباقات المتاحة", "SubscribeForm.load")))
      .finally(() => setLoadingTiers(false));
  }, []);

  async function submit() {
    if (!selectedTierId) {
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
      await submitCustomerSubscription({
        tierId: selectedTierId,
        billingPeriod,
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

  if (loadingTiers) return <Card className="text-sm text-slate-500">جاري تحميل الباقات...</Card>;

  if (!tiers.length) {
    return <Card className="text-center text-sm text-slate-400">لا توجد باقات متاحة حاليًا.</Card>;
  }

  return (
    <Card className="space-y-4">
      <div>
        <p className="font-bold text-slate-900">اشترك في عضوية TRIPRING</p>
        <p className="mt-1 text-sm text-slate-500">خصومات على الحجوزات + خدمات مجانية + أولوية في إشعارات الفرص.</p>
      </div>

      <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-1">
        {(["monthly", "yearly"] as BillingPeriod[]).map((bp) => (
          <button
            key={bp}
            type="button"
            onClick={() => setBillingPeriod(bp)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              billingPeriod === bp ? "bg-[#0C7BB3] text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {bp === "monthly" ? "شهري" : "سنوي (وفّر شهرين)"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {tiers.map((t) => {
          const price = billingPeriod === "yearly" ? t.price_yearly : t.price_monthly;
          return (
            <label
              key={t.id}
              className={`block cursor-pointer rounded-xl border p-3 ${
                selectedTierId === t.id ? "border-accent bg-[#E5F4FB]" : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="tier"
                className="me-2"
                checked={selectedTierId === t.id}
                onChange={() => setSelectedTierId(t.id)}
              />
              <span className="font-semibold">{TIER_LABELS[t.tier] ?? t.name}</span>
              <span className="ms-2 text-sm text-slate-600">
                {price} جنيه / {billingPeriod === "yearly" ? "سنة" : "شهر"} · خصم {t.discount_percentage}%
              </span>
              {t.description ? <p className="mt-1 text-xs text-slate-500">{t.description}</p> : null}
            </label>
          );
        })}
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

      {/* Browsing tiers and filling the form needs no account — only the
       *  final submit does, since it writes a row under the signed-in
       *  customer's id. */}
      <AuthGate title="سجّل الدخول عشان تكمل الاشتراك" description="اختيارك للباقة وبيانات الدفع محفوظة، سجّل دخولك أو اعمل حساب عشان نبعت الطلب.">
        {() => (
          <Button type="button" fullWidth disabled={submitting} onClick={submit}>
            {submitting ? "جاري الإرسال..." : "إرسال طلب الاشتراك"}
          </Button>
        )}
      </AuthGate>
    </Card>
  );
}
