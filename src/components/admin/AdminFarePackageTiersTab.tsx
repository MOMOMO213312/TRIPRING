import { useEffect, useState } from "react";

import { fetchFarePackageTiersAdmin, FARE_PACKAGE_TIER_LABELS, updateFarePackageTier } from "../../lib/admin";
import { friendlyErrorMessage } from "../../lib/errors";
import type { FarePackageTierRow, PaidMembershipTier } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

/**
 * Manages the 3 fare bundle tiers shown on DealDetail/BookingPage (تذكرة فقط /
 * Smart Trip / Premium Trip — see lib/packages.ts) — label + markup % + active/inactive.
 * Separate from AdminMembershipTiersTab (the paid customer subscription), even though
 * both happen to use the same Basic/Smart/Premium tier names.
 */
export function AdminFarePackageTiersTab() {
  const [tiers, setTiers] = useState<FarePackageTierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTier, setBusyTier] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetchFarePackageTiersAdmin()
      .then(setTiers)
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل باقات الرحلة", "AdminFarePackageTiersTab.load")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function save(tier: FarePackageTierRow, patch: Partial<FarePackageTierRow>) {
    setBusyTier(tier.tier);
    try {
      await updateFarePackageTier(tier.tier, patch);
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر حفظ التعديل", "AdminFarePackageTiersTab.save"));
    } finally {
      setBusyTier(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        {loading
          ? "جاري التحميل..."
          : "الباقات دي بتظهر لأي عميل عند اختيار باقة رحلة في صفحة الحجز/تفاصيل العرض — أي تعديل هنا يتحدث فورًا في الفرونت اند."}
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-3">
        {tiers.map((t) => (
          <Card key={t.tier} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-900">
                  {FARE_PACKAGE_TIER_LABELS[t.tier as PaidMembershipTier] ?? t.tier}
                </p>
                <Badge tone={t.is_active ? "empty_seat" : "default"}>{t.is_active ? "نشطة" : "متوقفة"}</Badge>
              </div>
              <Button
                type="button"
                variant={t.is_active ? "outline" : "primary"}
                disabled={busyTier === t.tier}
                onClick={() => save(t, { is_active: !t.is_active })}
              >
                {t.is_active ? "إيقاف" : "تفعيل"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex min-w-[10rem] flex-1 items-center gap-1.5 text-xs text-slate-600">
                الاسم المعروض للعميل
                <input
                  type="text"
                  defaultValue={t.label}
                  className="w-full flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  onBlur={(e) => e.target.value.trim() && e.target.value !== t.label && save(t, { label: e.target.value.trim() })}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                نسبة الزيادة على سعر التذكرة %
                <input
                  type="number"
                  step="0.1"
                  defaultValue={Number(t.markup_percent) * 100}
                  className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v) && v >= 0) save(t, { markup_percent: v / 100 });
                  }}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                ترتيب العرض
                <input
                  type="number"
                  defaultValue={t.sort_order}
                  className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v)) save(t, { sort_order: v });
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
