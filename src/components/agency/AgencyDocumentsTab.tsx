import { useEffect, useState } from "react";

import { fetchMyAgency, getMyAgencyDocumentUrl, uploadMyAgencyDocument } from "../../lib/agency";
import type { AgencyRow } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

const VERIFICATION_LABELS: Record<AgencyRow["verification_status"], string> = {
  pending: "⏳ بانتظار مراجعة الإدارة",
  verified: "✅ موثّقة",
  rejected: "❌ مرفوضة — راجع الوثائق وارفعها من جديد",
};

const VERIFICATION_TONE: Record<AgencyRow["verification_status"], "flash" | "empty_seat" | "urgent"> = {
  pending: "flash",
  verified: "empty_seat",
  rejected: "urgent",
};

const SUGGESTED_LABELS = ["السجل التجاري", "ترخيص السياحة", "البطاقة الضريبية"];

export function AgencyDocumentsTab({ agencyId }: { agencyId: string }) {
  const [agency, setAgency] = useState<AgencyRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState(SUGGESTED_LABELS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const a = await fetchMyAgency(agencyId);
      setAgency(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل بيانات التوثيق");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  async function submitUpload() {
    if (!file) {
      setError("اختار الملف أولاً");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadMyAgencyDocument(agencyId, label.trim() || "وثيقة", file);
      setFile(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر رفع الملف");
    } finally {
      setUploading(false);
    }
  }

  async function openDoc(path: string) {
    try {
      const url = await getMyAgencyDocumentUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر فتح الملف");
    }
  }

  if (loading) return <div className="py-10 text-center text-sm text-slate-500">جاري التحميل...</div>;
  if (!agency) return <p className="text-sm text-red-600">تعذر إيجاد بيانات الوكالة</p>;

  const docs = agency.verification_documents ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        ارفع الشهادات والوثائق الرسمية المعتمدة لوكالتك (السجل التجاري، ترخيص السياحة، البطاقة الضريبية، وغيرها).
        تراجع الإدارة الوثائق وتحدّث حالة التوثيق.
      </p>

      <Card className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700">حالة التوثيق</span>
        <Badge tone={VERIFICATION_TONE[agency.verification_status]}>
          {VERIFICATION_LABELS[agency.verification_status]}
        </Badge>
      </Card>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <Card className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">الوثائق المرفوعة ({docs.length})</p>
        {docs.length === 0 ? (
          <p className="text-sm text-slate-400">لسه مفيش وثائق مرفوعة.</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-700">
                  {d.label} <span className="text-xs text-slate-400">— {new Date(d.uploaded_at).toLocaleDateString("ar-EG")}</span>
                </span>
                <button type="button" className="font-semibold text-[#0C7BB3] hover:underline" onClick={() => openDoc(d.url)}>
                  عرض الملف
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">رفع وثيقة جديدة</p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[200px] flex-1 text-xs text-slate-600">
            نوع الوثيقة
            <select
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            >
              {SUGGESTED_LABELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
              <option value="وثيقة أخرى">وثيقة أخرى</option>
            </select>
          </label>
          <label className="min-w-[200px] flex-1 text-xs text-slate-600">
            الملف
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-xs"
            />
          </label>
          <Button disabled={uploading} onClick={submitUpload}>
            {uploading ? "جاري الرفع..." : "رفع الوثيقة"}
          </Button>
        </div>
        <p className="text-xs text-slate-400">JPG / PNG / WebP / PDF، لحد 8 ميجابايت للملف.</p>
      </Card>
    </div>
  );
}
