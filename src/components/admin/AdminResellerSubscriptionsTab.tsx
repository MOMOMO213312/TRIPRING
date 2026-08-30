import { useEffect, useState } from "react";

import {
  activateResellerSubscription,
  fetchAffiliatesByIds,
  fetchProfileNamesByIds,
  fetchResellerSubscriptionQueue,
  RESELLER_SUBSCRIPTION_STATUS_LABELS,
  rejectResellerSubscription,
} from "../../lib/admin";
import { friendlyErrorMessage } from "../../lib/errors";
import { supabase } from "../../lib/supabase";
import type { AffiliateResellerSubscriptionRow, AffiliateRow, ResellerSubscriptionPlanRow } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "تحويل بنكي",
  instapay: "InstaPay",
  vodafone_cash: "فودافون كاش",
};

export function AdminResellerSubscriptionsTab() {
  const [subs, setSubs] = useState<AffiliateResellerSubscriptionRow[]>([]);
  const [plans, setPlans] = useState<Record<string, ResellerSubscriptionPlanRow>>({});
  const [affiliates, setAffiliates] = useState<Record<string, AffiliateRow>>({});
  const [names, setNames] = useState<Record<string, { full_name: string | null; phone: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchResellerSubscriptionQueue(showAll ? undefined : ["pending_payment"]);
      setSubs(rows);

      const { data: planRows } = await supabase.from("reseller_subscription_plans").select("*");
      const planMap: Record<string, ResellerSubscriptionPlanRow> = {};
      for (const p of (planRows ?? []) as ResellerSubscriptionPlanRow[]) planMap[p.id] = p;
      setPlans(planMap);

      const affiliateIds = [...new Set(rows.map((r) => r.affiliate_id))];
      const affiliateRows = await fetchAffiliatesByIds(affiliateIds);
      const affiliateMap: Record<string, AffiliateRow> = {};
      for (const a of affiliateRows) affiliateMap[a.id] = a;
      setAffiliates(affiliateMap);

      const profileIds = [...new Set(affiliateRows.map((a) => a.profile_id))];
      try {
        const profileRows = await fetchProfileNamesByIds(profileIds);
        const nameMap: Record<string, { full_name: string | null; phone: string | null }> = {};
        for (const p of profileRows) nameMap[p.id] = { full_name: p.full_name, phone: p.phone };
        setNames(nameMap);
      } catch {
        // Non-critical — fall back to showing the affiliate's referral code only.
      }
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحميل طلبات الاشتراك", "AdminResellerSubscriptionsTab.load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll]);

  async function activate(sub: AffiliateResellerSubscriptionRow) {
    const plan = plans[sub.plan_id];
    if (!plan) return;
    setBusyId(sub.id);
    try {
      await activateResellerSubscription(sub.id, plan.duration_days);
      await load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تفعيل الاشتراك", "AdminResellerSubscriptionsTab.activate"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(sub: AffiliateResellerSubscriptionRow) {
    setBusyId(sub.id);
    try {
      await rejectResellerSubscription(sub.id);
      await load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر رفض الاشتراك", "AdminResellerSubscriptionsTab.reject"));
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
          const plan = plans[s.plan_id];
          const affiliate = affiliates[s.affiliate_id];
          const profile = affiliate ? names[affiliate.profile_id] : undefined;
          return (
            <Card key={s.id} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">
                    {profile?.full_name || affiliate?.referral_code || "أفلييت غير معروف"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {profile?.phone ? `📞 ${profile.phone} · ` : ""}
                    الباقة: {plan?.name ?? "—"} ({plan?.duration_days ?? "—"} يوم) · {plan?.price ?? "—"}{" "}
                    · طريقة الدفع: {s.payment_method ? PAYMENT_METHOD_LABELS[s.payment_method] ?? s.payment_method : "—"}
                    {s.payment_ref ? ` · مرجع: ${s.payment_ref}` : ""}
                  </p>
                </div>
                <Badge tone={s.status === "rejected" ? "urgent" : s.status === "active" ? "empty_seat" : "default"}>
                  {RESELLER_SUBSCRIPTION_STATUS_LABELS[s.status]}
                </Badge>
              </div>

              {s.payment_proof_url ? (
                <a
                  href={s.payment_proof_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-[#0C7BB3] underline"
                >
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
                  <Button type="button" disabled={busyId === s.id || !plan} onClick={() => activate(s)}>
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
