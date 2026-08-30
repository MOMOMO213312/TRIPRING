import { useEffect, useState } from "react";

import { createResellerPlan, fetchResellerPlans, updateResellerPlan } from "../../lib/admin";
import { friendlyErrorMessage } from "../../lib/errors";
import type { ResellerSubscriptionPlanRow } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";

/**
 * Manages the paid subscription plans an affiliate buys to unlock the
 * official no-markup price (see get_reseller_net_price RPC). Separate from
 * the referral-commission affiliate program — this is the "net-price
 * reseller" tier: the affiliate pays the platform, not the other way around.
 */
export function AdminResellerPlansTab() {
  const [plans, setPlans] = useState<ResellerSubscriptionPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    fetchResellerPlans()
      .then(setPlans)
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل الباقات", "AdminResellerPlansTab.load")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleActive(plan: ResellerSubscriptionPlanRow) {
    setBusyId(plan.id);
    try {
      await updateResellerPlan(plan.id, { is_active: !plan.is_active });
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث حالة الباقة", "AdminResellerPlansTab.toggle"));
    } finally {
      setBusyId(null);
    }
  }

  async function savePrice(plan: ResellerSubscriptionPlanRow, value: string) {
    const price = Number(value);
    if (Number.isNaN(price) || price < 0) return;
    setBusyId(plan.id);
    try {
      await updateResellerPlan(plan.id, { price });
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث السعر", "AdminResellerPlansTab.price"));
    } finally {
      setBusyId(null);
    }
  }

  async function saveDuration(plan: ResellerSubscriptionPlanRow, value: string) {
    const days = Number(value);
    if (Number.isNaN(days) || days <= 0) return;
    setBusyId(plan.id);
    try {
      await updateResellerPlan(plan.id, { duration_days: days });
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث المدة", "AdminResellerPlansTab.duration"));
    } finally {
      setBusyId(null);
    }
  }

  async function saveDescription(plan: ResellerSubscriptionPlanRow, value: string) {
    if (value === (plan.description ?? "")) return;
    setBusyId(plan.id);
    try {
      await updateResellerPlan(plan.id, { description: value.trim() || null });
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث الوصف", "AdminResellerPlansTab.description"));
    } finally {
      setBusyId(null);
    }
  }

  const active = plans.filter((p) => p.is_active);
  const inactive = plans.filter((p) => !p.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? "جاري التحميل..." : `${active.length} باقة نشطة${inactive.length ? `، ${inactive.length} متوقفة` : ""}`}
        </p>
        <Button type="button" onClick={() => setShowCreate(true)}>
          + إضافة باقة
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-2">
        {plans.map((p) => (
          <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[220px] flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-900">{p.name}</p>
                <Badge tone={p.is_active ? "empty_seat" : "default"}>{p.is_active ? "نشطة" : "متوقفة"}</Badge>
              </div>
              <p className="text-xs text-slate-500">
                {p.duration_days} يوم اشتراك · تتيح الوصول للسعر الرسمي بدون عمولة
              </p>
              <textarea
                defaultValue={p.description ?? ""}
                placeholder="وصف الباقة (يظهر للأفلييت)"
                rows={2}
                className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
                onBlur={(e) => saveDescription(p, e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                السعر
                <input
                  type="number"
                  defaultValue={p.price}
                  className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  onBlur={(e) => savePrice(p, e.target.value)}
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                المدة (يوم)
                <input
                  type="number"
                  defaultValue={p.duration_days}
                  className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                  onBlur={(e) => saveDuration(p, e.target.value)}
                />
              </label>
              <Button
                type="button"
                variant={p.is_active ? "outline" : "primary"}
                disabled={busyId === p.id}
                onClick={() => toggleActive(p)}
              >
                {p.is_active ? "إيقاف" : "تفعيل"}
              </Button>
            </div>
          </Card>
        ))}
        {!loading && plans.length === 0 ? (
          <Card className="text-center text-sm text-slate-400">لا توجد باقات بعد. ابدأ بإضافة واحدة.</Card>
        ) : null}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="إضافة باقة اشتراك جديدة">
        <CreatePlanForm
          onDone={() => {
            setShowCreate(false);
            load();
          }}
          onCancel={() => setShowCreate(false)}
        />
      </Modal>
    </div>
  );
}

function CreatePlanForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("اسم الباقة مطلوب");
      return;
    }
    const priceNum = Number(price);
    const durationNum = Number(durationDays);
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError("السعر لازم يكون رقم صحيح");
      return;
    }
    if (Number.isNaN(durationNum) || durationNum <= 0) {
      setError("المدة لازم تكون رقم أكبر من صفر");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createResellerPlan({
        name: name.trim(),
        description: description.trim() || null,
        price: priceNum,
        durationDays: durationNum,
      });
      onDone();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر إنشاء الباقة", "AdminResellerPlansTab.create"));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Input label="اسم الباقة" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: شهري" />
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">وصف الباقة (اختياري)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="يظهر للأفلييت وقت اختيار الباقة"
          rows={2}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <Input label="السعر" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
      <Input
        label="المدة بالأيام"
        type="number"
        value={durationDays}
        onChange={(e) => setDurationDays(e.target.value)}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          إلغاء
        </Button>
        <Button type="button" onClick={submit} disabled={saving}>
          {saving ? "جاري الحفظ..." : "إنشاء"}
        </Button>
      </div>
    </div>
  );
}
