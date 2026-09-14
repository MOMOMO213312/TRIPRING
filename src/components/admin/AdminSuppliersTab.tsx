import { useEffect, useState } from "react";

import { friendlyErrorMessage } from "../../lib/errors";
import {
  createSupplier,
  createSupplierContract,
  fetchAllSuppliers,
  fetchSupplierContracts,
  setSupplierContractStatus,
  SUPPLIER_STATUS_LABELS,
  SUPPLIER_TYPE_LABELS,
  updateSupplier,
  type SupplierCommercialModel,
  type SupplierContractRow,
  type SupplierContractStatus,
  type SupplierOrgType,
  type SupplierRow,
  type SupplierStatus,
} from "../../lib/orchestration";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";

const COMMERCIAL_MODEL_LABELS: Record<SupplierCommercialModel, string> = {
  markup: "Markup %",
  commission: "عمولة %",
  fixed_fee: "رسم ثابت",
};

const CONTRACT_STATUS_LABELS: Record<SupplierContractStatus, string> = {
  draft: "مسودة",
  active: "نشط",
  suspended: "معلق",
  ended: "منتهي",
};

export function AdminSuppliersTab() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchAllSuppliers()
      .then(setSuppliers)
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل الموردين", "AdminSuppliersTab.load")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? "جاري التحميل..." : `${suppliers.length} مورد مسجل — السجل المركزي لكل موردي TripRing`}
        </p>
        <Button type="button" onClick={() => setShowCreate(true)}>
          + إضافة مورد
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-2">
        {suppliers.length === 0 && !loading ? (
          <p className="text-sm text-slate-400">لا يوجد موردين مسجلين بعد.</p>
        ) : null}
        {suppliers.map((s) => (
          <SupplierCard
            key={s.id}
            supplier={s}
            expanded={expandedId === s.id}
            onToggleExpand={() => setExpandedId(expandedId === s.id ? null : s.id)}
            onRefresh={load}
          />
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="إضافة مورد جديد">
        <CreateSupplierForm
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

function SupplierCard({
  supplier,
  expanded,
  onToggleExpand,
  onRefresh,
}: {
  supplier: SupplierRow;
  expanded: boolean;
  onToggleExpand: () => void;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(status: SupplierStatus) {
    setBusy(true);
    setError(null);
    try {
      await updateSupplier(supplier.id, { status });
      onRefresh();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث حالة المورد", "AdminSuppliersTab.status"));
    } finally {
      setBusy(false);
    }
  }

  async function savePriority(value: string) {
    const n = Number(value);
    if (Number.isNaN(n)) return;
    setBusy(true);
    try {
      await updateSupplier(supplier.id, { priority: n });
      onRefresh();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث الأولوية", "AdminSuppliersTab.priority"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-slate-900">{supplier.name}</p>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {SUPPLIER_TYPE_LABELS[supplier.type]}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                supplier.status === "active"
                  ? "bg-emerald-100 text-emerald-800"
                  : supplier.status === "pending"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-500"
              }`}
            >
              {SUPPLIER_STATUS_LABELS[supplier.status]}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {supplier.contact_phone ?? "بدون رقم"} · {supplier.contact_email ?? "بدون إيميل"}
            {supplier.reliability_score !== null ? ` · موثوقية ${supplier.reliability_score}%` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            الأولوية
            <input
              type="number"
              defaultValue={supplier.priority}
              className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-sm"
              onBlur={(e) => savePriority(e.target.value)}
            />
          </label>
          {supplier.status !== "active" ? (
            <Button type="button" variant="primary" disabled={busy} onClick={() => changeStatus("active")}>
              تفعيل
            </Button>
          ) : (
            <Button type="button" variant="outline" disabled={busy} onClick={() => changeStatus("inactive")}>
              إيقاف
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onToggleExpand}>
            {expanded ? "إخفاء العقود" : "العقود"}
          </Button>
        </div>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {expanded ? <SupplierContractsPanel supplierId={supplier.id} /> : null}
    </Card>
  );
}

function SupplierContractsPanel({ supplierId }: { supplierId: string }) {
  const [contracts, setContracts] = useState<SupplierContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  function load() {
    setLoading(true);
    fetchSupplierContracts(supplierId)
      .then(setContracts)
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل العقود", "AdminSuppliersTab.contracts")))
      .finally(() => setLoading(false));
  }

  useEffect(load, [supplierId]);

  async function toggleStatus(c: SupplierContractRow) {
    try {
      await setSupplierContractStatus(c.id, c.status === "active" ? "suspended" : "active");
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث حالة العقد", "AdminSuppliersTab.contractStatus"));
    }
  }

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600">
          {loading ? "جاري التحميل..." : `${contracts.length} عقد`}
        </p>
        <Button type="button" variant="outline" onClick={() => setShowNew((v) => !v)}>
          {showNew ? "إلغاء" : "+ عقد جديد"}
        </Button>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {showNew ? (
        <NewContractForm
          supplierId={supplierId}
          onDone={() => {
            setShowNew(false);
            load();
          }}
        />
      ) : null}
      <div className="space-y-2">
        {contracts.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-2 text-xs">
            <div>
              <span className="font-semibold">{COMMERCIAL_MODEL_LABELS[c.commercial_model]}</span>{" "}
              {c.commercial_model === "markup"
                ? `${c.markup_percent ?? 0}%`
                : c.commercial_model === "commission"
                  ? `${c.commission_percent ?? 0}%`
                  : `${c.fixed_fee_amount ?? 0} ${c.currency}`}
              {" · "}
              {c.settlement_terms ?? "بدون شروط تسوية محددة"}
              {c.sla_hours ? ` · SLA ${c.sla_hours}س` : ""}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 font-semibold ${
                  c.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                }`}
              >
                {CONTRACT_STATUS_LABELS[c.status]}
              </span>
              {c.status !== "ended" ? (
                <button type="button" className="text-[#0C7BB3] underline" onClick={() => toggleStatus(c)}>
                  {c.status === "active" ? "تعليق" : "تفعيل"}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewContractForm({ supplierId, onDone }: { supplierId: string; onDone: () => void }) {
  const [model, setModel] = useState<SupplierCommercialModel>("commission");
  const [rate, setRate] = useState("10");
  const [settlementTerms, setSettlementTerms] = useState("أسبوعي");
  const [slaHours, setSlaHours] = useState("24");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await createSupplierContract({
        supplierId,
        commercialModel: model,
        markupPercent: model === "markup" ? Number(rate) : null,
        commissionPercent: model === "commission" ? Number(rate) : null,
        fixedFeeAmount: model === "fixed_fee" ? Number(rate) : null,
        settlementTerms,
        slaHours: slaHours ? Number(slaHours) : null,
      });
      onDone();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر إنشاء العقد", "AdminSuppliersTab.newContract"));
      setSaving(false);
    }
  }

  return (
    <div className="mb-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <label className="block text-xs text-slate-600">
        النموذج التجاري
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as SupplierCommercialModel)}
          className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        >
          <option value="commission">عمولة %</option>
          <option value="markup">Markup %</option>
          <option value="fixed_fee">رسم ثابت</option>
        </select>
      </label>
      <Input
        label={model === "fixed_fee" ? "قيمة الرسم" : "النسبة %"}
        type="number"
        value={rate}
        onChange={(e) => setRate(e.target.value)}
      />
      <Input label="شروط التسوية" value={settlementTerms} onChange={(e) => setSettlementTerms(e.target.value)} />
      <Input label="SLA (ساعات)" type="number" value={slaHours} onChange={(e) => setSlaHours(e.target.value)} />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="button" disabled={saving} onClick={submit}>
          {saving ? "جاري الحفظ..." : "حفظ العقد"}
        </Button>
      </div>
    </div>
  );
}

function CreateSupplierForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<SupplierOrgType>("ground_provider");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("اسم المورد مطلوب");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createSupplier({
        name: name.trim(),
        type,
        contactPhone: phone || null,
        contactEmail: email || null,
      });
      onDone();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر إنشاء المورد", "AdminSuppliersTab.create"));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Input label="اسم المورد" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="block space-y-1.5 text-sm font-medium text-slate-700">
        نوع المورد
        <select
          value={type}
          onChange={(e) => setType(e.target.value as SupplierOrgType)}
          className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
        >
          <option value="ground_provider">مزود خدمات أرضية</option>
          <option value="transport_provider">مزود نقل (GoAir)</option>
          <option value="rental_provider">مزود تأجير سيارات</option>
          <option value="airline">شركة طيران</option>
          <option value="agency">وكالة سياحة</option>
          <option value="hotel_provider">مزود فنادق</option>
          <option value="experience_provider">مزود تجارب/أنشطة</option>
        </select>
      </label>
      <Input label="رقم الهاتف" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Input label="الإيميل" value={email} onChange={(e) => setEmail(e.target.value)} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <p className="text-xs text-slate-400">
        هيتسجل بحالة "بانتظار المراجعة". فعّله بعد ما تضيف عقد تجاري من كارت المورد.
      </p>
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
