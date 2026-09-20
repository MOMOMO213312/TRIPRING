import { useEffect, useState } from "react";

import { friendlyErrorMessage } from "../../lib/errors";
import {
  fetchSettlements,
  fetchSubscriptionRevenue,
  fetchSupplierBalances,
  fetchUnsettledItemsForSupplier,
  generateSupplierSettlement,
  markSettlementPaid,
  SETTLEMENT_STATUS_LABELS,
  type SubscriptionRevenueRow,
  type SupplierBalanceRow,
  type SupplierSettlementRow,
  type UnsettledSupplierItemRow,
} from "../../lib/orchestration";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { getLocale } from "../../i18n/format";

type SubTab = "balances" | "settlements" | "subscriptions";

export function AdminSettlementsTab() {
  const [subTab, setSubTab] = useState<SubTab>("balances");
  const [balances, setBalances] = useState<SupplierBalanceRow[]>([]);
  const [settlements, setSettlements] = useState<SupplierSettlementRow[]>([]);
  const [subs, setSubs] = useState<SubscriptionRevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [genFor, setGenFor] = useState<SupplierBalanceRow | null>(null);
  const [payFor, setPayFor] = useState<SupplierSettlementRow | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([fetchSupplierBalances(), fetchSettlements(), fetchSubscriptionRevenue()])
      .then(([b, s, sub]) => {
        setBalances(b);
        setSettlements(s);
        setSubs(sub);
      })
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل بيانات التسويات", "AdminSettlementsTab.load")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const subsTotal = subs.reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{loading ? "جاري التحميل..." : "مركز التسويات المالية مع الموردين"}</p>
        <Button type="button" variant="outline" onClick={load}>
          تحديث
        </Button>
      </div>

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setSubTab("balances")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            subTab === "balances" ? "bg-[#0C7BB3] text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          أرصدة الموردين
        </button>
        <button
          type="button"
          onClick={() => setSubTab("settlements")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            subTab === "settlements" ? "bg-[#0C7BB3] text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          سجل التسويات
        </button>
        <button
          type="button"
          onClick={() => setSubTab("subscriptions")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            subTab === "subscriptions" ? "bg-[#0C7BB3] text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          إيراد الاشتراكات
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {subTab === "balances" ? (
        <div className="space-y-2">
          {balances.length === 0 && !loading ? (
            <p className="text-sm text-slate-400">لا يوجد رصيد مسجل لأي مورد بعد.</p>
          ) : null}
          {balances.map((b) => (
            <Card key={b.supplier_id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{b.supplier_name}</p>
                <p className="text-xs text-slate-500">
                  إجمالي التكلفة {b.total_cost_owed} · غير مُسوّى {b.unsettled_cost} · مدفوع {b.total_paid_out}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    b.outstanding_balance > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  مستحق {b.outstanding_balance}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={b.unsettled_cost <= 0}
                  onClick={() => setGenFor(b)}
                >
                  توليد تسوية
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {subTab === "settlements" ? (
        <div className="space-y-2">
          {settlements.length === 0 && !loading ? (
            <p className="text-sm text-slate-400">لا يوجد تسويات بعد.</p>
          ) : null}
          {settlements.map((s) => (
            <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {s.period_start} → {s.period_end} ({s.items_count} عنصر)
                </p>
                <p className="text-xs text-slate-500">
                  مستحق للمورد {s.amount_due_supplier} {s.currency} · مدفوع {s.amount_paid}
                  {s.payment_ref ? ` · مرجع: ${s.payment_ref}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    s.status === "paid"
                      ? "bg-emerald-100 text-emerald-800"
                      : s.status === "disputed"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {SETTLEMENT_STATUS_LABELS[s.status]}
                </span>
                {s.status === "pending" || s.status === "draft" ? (
                  <Button type="button" onClick={() => setPayFor(s)}>
                    تسجيل السداد
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {subTab === "subscriptions" ? (
        <div className="space-y-2">
          <Card className="bg-[#0C7BB3]/5">
            <p className="text-sm text-slate-500">إجمالي إيراد الاشتراكات المسجل</p>
            <p className="text-2xl font-extrabold text-[#0C7BB3]">{subsTotal.toLocaleString(getLocale())}</p>
          </Card>
          {subs.length === 0 && !loading ? <p className="text-sm text-slate-400">لا يوجد قيود اشتراكات بعد.</p> : null}
          {subs.map((s) => (
            <Card key={s.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>
                {s.tier_name} ({s.billing_period}) — {new Date(s.occurred_at).toLocaleDateString(getLocale())}
              </span>
              <span className="font-bold text-[#0C7BB3]">
                {s.amount} {s.currency}
              </span>
            </Card>
          ))}
        </div>
      ) : null}

      <Modal open={!!genFor} onClose={() => setGenFor(null)} title="توليد تسوية مورّد">
        {genFor ? (
          <GenerateSettlementForm
            supplier={genFor}
            onDone={() => {
              setGenFor(null);
              load();
            }}
          />
        ) : null}
      </Modal>

      <Modal open={!!payFor} onClose={() => setPayFor(null)} title="تسجيل سداد تسوية">
        {payFor ? (
          <MarkPaidForm
            settlement={payFor}
            onDone={() => {
              setPayFor(null);
              load();
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function GenerateSettlementForm({ supplier, onDone }: { supplier: SupplierBalanceRow; onDone: () => void }) {
  const today = new Date();
  const defaultEnd = today.toISOString().slice(0, 10);
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const [preview, setPreview] = useState<UnsettledSupplierItemRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUnsettledItemsForSupplier(supplier.supplier_id)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [supplier.supplier_id]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await generateSupplierSettlement(supplier.supplier_id, periodStart, periodEnd);
      onDone();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر توليد التسوية", "AdminSettlementsTab.generate"));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        {supplier.supplier_name} — رصيد غير مُسوّى حاليًا: <span className="font-bold">{supplier.unsettled_cost}</span>
      </p>
      <Input label="من تاريخ" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
      <Input label="إلى تاريخ" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
      {preview ? <p className="text-xs text-slate-500">{preview.length} عنصر غير مُسوّى حاليًا لهذا المورد.</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <p className="text-xs text-slate-400">
        هيتم حساب التسوية تلقائيًا من العناصر غير المُسوّاة في الفترة المحددة (generate_supplier_settlement).
      </p>
      <div className="flex justify-end">
        <Button type="button" disabled={saving} onClick={submit}>
          {saving ? "جاري التوليد..." : "توليد التسوية"}
        </Button>
      </div>
    </div>
  );
}

function MarkPaidForm({ settlement, onDone }: { settlement: SupplierSettlementRow; onDone: () => void }) {
  const [paymentRef, setPaymentRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!paymentRef.trim()) {
      setError("مرجع السداد مطلوب");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await markSettlementPaid(settlement.id, paymentRef.trim());
      onDone();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تسجيل السداد", "AdminSettlementsTab.markPaid"));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        مبلغ مستحق للمورد: <span className="font-bold">{settlement.amount_due_supplier}</span> {settlement.currency}
      </p>
      <Input
        label="مرجع الدفع (رقم حوالة/إيصال)"
        value={paymentRef}
        onChange={(e) => setPaymentRef(e.target.value)}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="button" disabled={saving} onClick={submit}>
          {saving ? "جاري الحفظ..." : "تأكيد السداد"}
        </Button>
      </div>
    </div>
  );
}
