import { useEffect, useState } from "react";

import {
  createAgency,
  fetchAllAgencies,
  getAgencyDocumentUrl,
  inviteAgencyUser,
  setAgencyActive,
  setAgencyVerificationStatus,
  updateAgencyAllowedCategories,
  updateAgencyCommission,
  uploadAgencyDocument,
} from "../../lib/admin";
import { friendlyErrorMessage } from "../../lib/errors";
import { PROVIDER_TYPES, PROVIDER_TYPE_LABELS } from "../../lib/serviceProviders";
import type { AgencyRow, ProviderType } from "../../types/database";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";

const VERIFICATION_LABELS: Record<AgencyRow["verification_status"], string> = {
  pending: "⏳ لسه ما اتراجعتش",
  verified: "✅ موثّقة",
  rejected: "❌ مرفوضة",
};

export function AdminAgenciesTab() {
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  function load() {
    setLoading(true);
    fetchAllAgencies()
      .then(setAgencies)
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل الوكالات", "AdminAgenciesTab.load")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleActive(agency: AgencyRow) {
    setBusyId(agency.id);
    try {
      await setAgencyActive(agency.id, !agency.is_active);
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث حالة الوكالة", "AdminAgenciesTab.toggle"));
    } finally {
      setBusyId(null);
    }
  }

  async function saveCommission(agency: AgencyRow, value: string) {
    const rate = Number(value);
    if (Number.isNaN(rate)) return;
    setBusyId(agency.id);
    try {
      await updateAgencyCommission(agency.id, rate);
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث نسبة العمولة", "AdminAgenciesTab.commission"));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleCategory(agency: AgencyRow, category: ProviderType) {
    const current = agency.allowed_categories ?? [];
    const next = current.includes(category) ? current.filter((c) => c !== category) : [...current, category];
    setBusyId(agency.id);
    try {
      await updateAgencyAllowedCategories(agency.id, next);
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث الفئات المسموحة", "AdminAgenciesTab.categories"));
    } finally {
      setBusyId(null);
    }
  }

  const pending = agencies.filter((a) => !a.is_active);
  const active = agencies.filter((a) => a.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? "جاري التحميل..." : `${active.length} وكالة نشطة، ${pending.length} بانتظار الموافقة`}
        </p>
        <Button type="button" onClick={() => setShowCreate(true)}>
          + إضافة وكالة
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {pending.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-bold text-amber-800">⏳ بانتظار الموافقة</h2>
          {pending.map((a) => (
            <AgencyRowCard
              key={a.id}
              agency={a}
              busy={busyId === a.id}
              onToggle={toggleActive}
              onCommission={saveCommission}
              onToggleCategory={toggleCategory}
              onRefresh={load}
            />
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <h2 className="text-sm font-bold text-slate-700">الوكالات النشطة</h2>
        {active.length === 0 && !loading ? <p className="text-sm text-slate-400">لا توجد وكالات نشطة بعد.</p> : null}
        {active.map((a) => (
          <AgencyRowCard
            key={a.id}
            agency={a}
            busy={busyId === a.id}
            onToggle={toggleActive}
            onCommission={saveCommission}
            onToggleCategory={toggleCategory}
            onRefresh={load}
          />
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="إضافة وكالة جديدة">
        <CreateAgencyForm
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

function AgencyRowCard({
  agency,
  busy,
  onToggle,
  onCommission,
  onToggleCategory,
  onRefresh,
}: {
  agency: AgencyRow;
  busy: boolean;
  onToggle: (a: AgencyRow) => void;
  onCommission: (a: AgencyRow, value: string) => void;
  onToggleCategory: (a: AgencyRow, category: ProviderType) => void;
  onRefresh: () => void;
}) {
  const [docsOpen, setDocsOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  async function changeStatus(status: "pending" | "verified" | "rejected") {
    setStatusSaving(true);
    setDocError(null);
    try {
      await setAgencyVerificationStatus(agency.id, status);
      onRefresh();
    } catch (e) {
      setDocError(friendlyErrorMessage(e, "تعذر تحديث حالة التوثيق", "AdminAgenciesTab.verification"));
    } finally {
      setStatusSaving(false);
    }
  }

  async function openDoc(path: string) {
    try {
      const url = await getAgencyDocumentUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setDocError(friendlyErrorMessage(e, "تعذر فتح الملف", "AdminAgenciesTab.viewDoc"));
    }
  }

  const docs = agency.verification_documents ?? [];

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{agency.name}</p>
          <p className="text-xs text-slate-500">
            {agency.phone ?? "بدون رقم"} · {agency.email ?? "بدون إيميل"}
          </p>
          {agency.commercial_register_number || agency.tourism_license_number ? (
            <p className="mt-1 text-xs text-slate-400">
              {agency.commercial_register_number ? `سجل تجاري: ${agency.commercial_register_number}` : null}
              {agency.commercial_register_number && agency.tourism_license_number ? " · " : ""}
              {agency.tourism_license_number ? `ترخيص سياحة: ${agency.tourism_license_number}` : null}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            عمولة %
            <input
              type="number"
              defaultValue={agency.commission_rate ?? 0}
              className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm"
              onBlur={(e) => onCommission(agency, e.target.value)}
            />
          </label>
          <Button
            type="button"
            variant={agency.is_active ? "outline" : "primary"}
            disabled={busy}
            onClick={() => onToggle(agency)}
          >
            {agency.is_active ? "إيقاف" : "الموافقة وتفعيل"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDocsOpen((v) => !v)}
            className="text-xs font-medium text-blue-700 hover:underline"
          >
            {docsOpen ? "إخفاء الوثائق" : `الوثائق والشهادات (${docs.length})`}
          </button>
          <button
            type="button"
            onClick={() => setInviteOpen((v) => !v)}
            className="text-xs font-medium text-blue-700 hover:underline"
          >
            {inviteOpen ? "إخفاء الدعوة" : "+ دعوة موظف"}
          </button>
        </div>
        <span className="text-xs">{VERIFICATION_LABELS[agency.verification_status]}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2">
        <span className="text-xs font-semibold text-slate-500">فئات الخدمات المسموحة للوكالة:</span>
        {PROVIDER_TYPES.map((category) => {
          const checked = (agency.allowed_categories ?? []).includes(category);
          return (
            <label key={category} className="flex items-center gap-1 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={checked}
                disabled={busy}
                onChange={() => onToggleCategory(agency, category)}
              />
              {PROVIDER_TYPE_LABELS[category]}
            </label>
          );
        })}
      </div>

      {inviteOpen ? <InviteAgencyUserForm agencyId={agency.id} onDone={() => setInviteOpen(false)} /> : null}

      {docsOpen ? (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          {docs.length === 0 ? (
            <p className="text-xs text-slate-400">لسه مفيش وثائق مرفوعة للوكالة دي.</p>
          ) : (
            <ul className="space-y-1">
              {docs.map((d, i) => (
                <li key={i} className="flex items-center justify-between text-xs">
                  <span className="text-slate-700">{d.label}</span>
                  <button type="button" className="text-blue-700 hover:underline" onClick={() => openDoc(d.url)}>
                    عرض الملف
                  </button>
                </li>
              ))}
            </ul>
          )}

          <AddAgencyDocument agencyId={agency.id} onDone={onRefresh} />

          {docError ? <p className="text-xs text-red-600">{docError}</p> : null}

          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              disabled={statusSaving || agency.verification_status === "verified"}
              onClick={() => changeStatus("verified")}
            >
              توثيق الوكالة
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={statusSaving || agency.verification_status === "rejected"}
              onClick={() => changeStatus("rejected")}
            >
              رفض
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function AddAgencyDocument({ agencyId, onDone }: { agencyId: string; onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!label.trim() || !file) {
      setError("اختار نوع الوثيقة والملف");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await uploadAgencyDocument(agencyId, label.trim(), file);
      setLabel("");
      setFile(null);
      onDone();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر رفع الملف", "AdminAgenciesTab.uploadDoc"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-2">
      <input
        type="text"
        placeholder="اسم الوثيقة (مثلاً: ترخيص السياحة)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="min-w-[180px] flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs"
      />
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-xs"
      />
      <Button type="button" variant="outline" disabled={saving} onClick={submit}>
        {saving ? "جاري الرفع..." : "رفع"}
      </Button>
      {error ? <p className="w-full text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function InviteAgencyUserForm({ agencyId, onDone }: { agencyId: string; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [agencyRole, setAgencyRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit() {
    if (!email.trim()) {
      setError("الإيميل مطلوب");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await inviteAgencyUser({
        agencyId,
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        agencyRole: agencyRole.trim() || undefined,
      });
      setSuccess(`تم إرسال دعوة إلى ${result.email} وربطه بالوكالة`);
      setEmail("");
      setFullName("");
      setAgencyRole("");
      onDone();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر إرسال الدعوة", "AdminAgenciesTab.invite"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3">
      <p className="text-xs text-slate-500">
        هيتبعت إيميل دعوة (من Supabase) عشان الموظف يحدد كلمة سر ويدخل. لو الإيميل عنده حساب بالفعل، هيترابط
        بالوكالة دي مباشرة من غير دعوة جديدة.
      </p>
      <input
        type="email"
        placeholder="الإيميل"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        dir="ltr"
      />
      <input
        type="text"
        placeholder="الاسم بالكامل (اختياري)"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      <input
        type="text"
        placeholder="الدور داخل الوكالة (اختياري، مثلاً: مدير)"
        value={agencyRole}
        onChange={(e) => setAgencyRole(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {success ? <p className="text-xs text-emerald-700">{success}</p> : null}
      <div className="flex justify-end">
        <Button type="button" disabled={saving} onClick={submit}>
          {saving ? "جاري الإرسال..." : "إرسال الدعوة"}
        </Button>
      </div>
    </div>
  );
}

function CreateAgencyForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [commission, setCommission] = useState("10");
  const [commercialRegisterNumber, setCommercialRegisterNumber] = useState("");
  const [tourismLicenseNumber, setTourismLicenseNumber] = useState("");
  const [commercialRegisterFile, setCommercialRegisterFile] = useState<File | null>(null);
  const [tourismLicenseFile, setTourismLicenseFile] = useState<File | null>(null);
  const [otherFile, setOtherFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("اسم الوكالة مطلوب");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const agency = await createAgency({
        name,
        phone: phone || null,
        email: email || null,
        whatsapp: whatsapp || null,
        commissionRate: commission ? Number(commission) : null,
        commercialRegisterNumber: commercialRegisterNumber || null,
        tourismLicenseNumber: tourismLicenseNumber || null,
      });

      // Documents are uploaded after the agency row exists, since files are
      // stored under `${agencyId}/...`. Uploading one failing shouldn't lose
      // the others, so each is attempted and errors are collected.
      const uploads: Array<[string, File | null]> = [
        ["السجل التجاري", commercialRegisterFile],
        ["ترخيص السياحة", tourismLicenseFile],
        ["وثيقة أخرى", otherFile],
      ];
      const uploadErrors: string[] = [];
      for (const [label, file] of uploads) {
        if (!file) continue;
        try {
          await uploadAgencyDocument(agency.id, label, file);
        } catch (e) {
          uploadErrors.push(friendlyErrorMessage(e, `تعذر رفع ${label}`, "AdminAgenciesTab.createUpload"));
        }
      }

      if (uploadErrors.length > 0) {
        setError(`تم إنشاء الوكالة لكن حصلت مشكلة في رفع بعض الملفات: ${uploadErrors.join(" / ")}`);
        setSaving(false);
        return;
      }

      onDone();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر إنشاء الوكالة", "AdminAgenciesTab.create"));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Input label="اسم الوكالة" value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="رقم الهاتف" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <Input label="الإيميل" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input label="واتساب" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
      <Input label="نسبة العمولة %" type="number" value={commission} onChange={(e) => setCommission(e.target.value)} />

      <div className="space-y-3 rounded-lg border border-slate-200 p-3">
        <p className="text-xs font-semibold text-slate-600">الشهادات والوثائق الرسمية المعتمدة</p>

        <Input
          label="رقم السجل التجاري"
          value={commercialRegisterNumber}
          onChange={(e) => setCommercialRegisterNumber(e.target.value)}
        />
        <label className="block text-xs text-slate-600">
          صورة السجل التجاري
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setCommercialRegisterFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-xs"
          />
        </label>

        <Input
          label="رقم ترخيص السياحة"
          value={tourismLicenseNumber}
          onChange={(e) => setTourismLicenseNumber(e.target.value)}
        />
        <label className="block text-xs text-slate-600">
          صورة ترخيص السياحة
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setTourismLicenseFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-xs"
          />
        </label>

        <label className="block text-xs text-slate-600">
          وثيقة إضافية (اختياري)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setOtherFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-xs"
          />
        </label>
        <p className="text-xs text-slate-400">JPG / PNG / WebP / PDF، لحد 8 ميجابايت للملف. الملفات دي خاصة ومحدش يشوفها غير الأدمن ووكالة نفسها.</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <p className="text-xs text-slate-400">
        ملحوظة: ده بينشئ سجل الوكالة بس. ربط حساب دخول (إيميل/باسورد) للوكالة لسه بيتم يدويًا من Supabase (جدول
        profiles → agency_id) لحد ما نضيف دعوة مستخدمين من هنا.
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
