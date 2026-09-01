import { useEffect, useState } from "react";

import { fetchMembershipTiers, MEMBERSHIP_TIER_LABELS, updateMembershipTier } from "../../lib/admin";
import { friendlyErrorMessage } from "../../lib/errors";
import type { MembershipTierRow } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

/**
 * Manages the 3 paid customer membership tiers (Basic/Smart/Premium): price,
 * discount %, priority-alert minutes, and active/inactive. The set of tiers
 * itself is fixed (membership_tier is a DB enum + unique tier column), so
 * this is edit-only — no create/delete, unlike AdminResellerPlansTab.
 */
export function AdminMembershipTiersTab() {
  const [tiers, setTiers] = useState<MembershipTierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetchMembershipTiers()
      .then(setTiers)
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل باقات الاشتراك", "AdminMembershipTiersTab.load")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function save(tier: MembershipTierRow, patch: Partial<MembershipTierRow>) {
    setBusyId(tier.id);
    try {
      await updateMembershipTier(tier.id, patch);
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر حفظ التعديل", "AdminMembershipTiersTab.save"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {loading ? "جاري التحميل..." : "الأسعار والخصومات قابلة للتعديل هنا مباشرة، تتحدث فورًا للعملاء."}
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-3">
        {tiers.map((t) => (
          <Card key={t.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-900">{MEMBERSHIP_TIER_LABELS[t.tier]}</p>
                <Badge tone={t.is_active ? "empty_seat" : "default"}>{t.is_active ? "نشطة" : "متوقفة"}</Badge>
              </div>
              <Button
                type="button"
                variant={t.is_active ? "outline" : "primary"}
                disabled={busyId === t.id}
                onClick={() => save(t, { is_active: !t.is_active })}
              >
                {t.is_active ? "إيقاف" : "تفعيل"}
              </Button>
            </div>

            <textarea
              defaultValue={t.description ?? ""}
              placeholder="وصف الباقة (يظهر للعميل)"
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
              onBlur={(e) => e.target.value !== (t.description ?? "") && save(t, { description: e.target.value.trim() || null })}
            />

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                شهري
                <input
                  type="number"
                  defaultValue={t.price_monthly}
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v) && v >= 0) save(t, { price_monthly: v });
                  }}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                سنوي
                <input
                  type="number"
                  defaultValue={t.price_yearly}
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v) && v >= 0) save(t, { price_yearly: v });
                  }}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                خصم %
                <input
                  type="number"
                  defaultValue={t.discount_percentage}
                  className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v) && v >= 0 && v <= 100) save(t, { discount_percentage: v });
                  }}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                أولوية إشعار (دقيقة)
                <input
                  type="number"
                  defaultValue={t.priority_minutes}
                  className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v) && v >= 0) save(t, { priority_minutes: v });
                  }}
                />
              </label>
            </div>
          </Card>
        ))}
        {!loading && tiers.length === 0 ? (
          <Card className="text-center text-sm text-slate-400">لا توجد باقات — تأكد من تشغيل الـ migration.</Card>
        ) : null}
      </div>
    </div>
  );
}
