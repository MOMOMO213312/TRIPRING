import { useEffect, useState } from "react";

import {
  activateCustomerSubscription,
  CUSTOMER_SUBSCRIPTION_STATUS_LABELS,
  fetchCustomerSubscriptionQueue,
  fetchMembershipTiers,
  fetchProfileNamesByIds,
  MEMBERSHIP_TIER_LABELS,
  rejectCustomerSubscription,
} from "../../lib/admin";
import { friendlyErrorMessage } from "../../lib/errors";
import type { CustomerSubscriptionRow, MembershipTierRow, ProfileRow } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "تحويل بنكي",
  instapay: "InstaPay",
  vodafone_cash: "فودافون كاش",
};

const BILLING_LABELS: Record<string, string> = { monthly: "شهري", yearly: "سنوي" };

export function AdminCustomerSubscriptionsTab() {
  const [subs, setSubs] = useState<CustomerSubscriptionRow[]>([]);
  const [tiers, setTiers] = useState<Record<string, MembershipTierRow>>({});
  const [names, setNames] = useState<Record<string, Pick<ProfileRow, "id" | "full_name" | "phone">>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchCustomerSubscriptionQueue(showAll ? undefined : ["pending_payment"]);
      setSubs(rows);

      const tierRows = await fetchMembershipTiers();
      const tierMap: Record<string, MembershipTierRow> = {};
      for (const t of tierRows) tierMap[t.id] = t;
      setTiers(tierMap);

      const customerIds = [...new Set(rows.map((r) => r.customer_id))];
      try {
        const profileRows = await fetchProfileNamesByIds(customerIds);
        const nameMap: Record<string, Pick<ProfileRow, "id" | "full_name" | "phone">> = {};
        for (const p of profileRows) nameMap[p.id] = p;
        setNames(nameMap);
      } catch {
        // Non-critical — fall back to showing the raw customer id.
      }
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحميل طلبات الاشتراك", "AdminCustomerSubscriptionsTab.load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll]);

  async function activate(sub: CustomerSubscriptionRow) {
    setBusyId(sub.id);
    try {
      await activateCustomerSubscription(sub.id, sub.billing_period);
      await load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تفعيل الاشتراك", "AdminCustomerSubscriptionsTab.activate"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(sub: CustomerSubscriptionRow) {
    setBusyId(sub.id);
    try {
      await rejectCustomerSubscription(sub.id);
      await load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر رفض الاشتراك", "AdminCustomerSubscriptionsTab.reject"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? "جاري التحميل..." : `${subs.length} طلب ${showAll ? "" : "بانتظار المراجعة"}`}
        </p>
        <Button type="button" variant="outline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "بانتظار المراجعة بس" : "عرض كل الطلبات"}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-3">
        {subs.map((s) => {
          const tier = tiers[s.tier_id];
          const profile = names[s.customer_id];
          const price = tier ? (s.billing_period === "yearly" ? tier.price_yearly : tier.price_monthly) : null;
          return (
            <Card key={s.id} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{profile?.full_name || "عميل غير معروف"}</p>
                  <p className="text-xs text-slate-500">
                    {profile?.phone ? `📞 ${profile.phone} · ` : ""}
                    الباقة: {tier ? MEMBERSHIP_TIER_LABELS[tier.tier] : "—"} ({BILLING_LABELS[s.billing_period]}) ·{" "}
                    {price ?? "—"} جنيه · طريقة الدفع:{" "}
                    {s.payment_method ? PAYMENT_METHOD_LABELS[s.payment_method] ?? s.payment_method : "—"}
                    {s.payment_ref ? ` · مرجع: ${s.payment_ref}` : ""}
                  </p>
                </div>
                <Badge tone={s.status === "rejected" ? "urgent" : s.status === "active" ? "empty_seat" : "default"}>
                  {CUSTOMER_SUBSCRIPTION_STATUS_LABELS[s.status]}
                </Badge>
              </div>

              {s.payment_proof_url ? (
                <a href={s.payment_proof_url} target="_blank" rel="noreferrer" className="text-sm text-[#0C7BB3] underline">
                  عرض إثبات الدفع
                </a>
              ) : (
                <p className="text-xs text-slate-400">مفيش إثبات دفع مرفق</p>
              )}

              {s.status === "active" && s.ends_at ? (
                <p className="text-xs text-slate-500">سارٍ حتى {new Date(s.ends_at).toLocaleDateString("ar-EG")}</p>
              ) : null}

              {s.status === "pending_payment" ? (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                  <Button type="button" disabled={busyId === s.id || !tier} onClick={() => activate(s)}>
                    ✔ تفعيل الاشتراك
                  </Button>
                  <Button type="button" variant="outline" disabled={busyId === s.id} onClick={() => reject(s)}>
                    ✕ رفض
                  </Button>
                </div>
              ) : null}
            </Card>
          );
        })}
        {!loading && subs.length === 0 ? (
          <Card className="text-center text-sm text-slate-400">لا توجد طلبات {showAll ? "" : "بانتظار المراجعة"}.</Card>
        ) : null}
      </div>
    </div>
  );
}
