import { useEffect, useState } from "react";

import {
  adminApproveSupplierApplication,
  adminRejectSupplierApplication,
  fetchSupplierApplications,
  SUPPLIER_APPLICATION_STATUS_LABELS,
  SUPPLIER_ORG_TYPE_LABELS,
} from "../../lib/admin";
import { friendlyErrorMessage } from "../../lib/errors";
import type { SupplierApplicationRow } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export function AdminSupplierApplicationsTab() {
  const [apps, setApps] = useState<SupplierApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchSupplierApplications(showAll ? undefined : ["pending"]);
      setApps(rows);
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحميل طلبات الانضمام", "AdminSupplierApplicationsTab.load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll]);

  async function approve(app: SupplierApplicationRow) {
    setBusyId(app.id);
    try {
      await adminApproveSupplierApplication(app.id, noteDraft[app.id] || undefined);
      await load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر قبول الطلب", "AdminSupplierApplicationsTab.approve"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(app: SupplierApplicationRow) {
    setBusyId(app.id);
    try {
      await adminRejectSupplierApplication(app.id, noteDraft[app.id] || undefined);
      await load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر رفض الطلب", "AdminSupplierApplicationsTab.reject"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? "جاري التحميل..." : `${apps.length} طلب ${showAll ? "" : "بانتظار المراجعة"}`}
        </p>
        <Button type="button" variant="outline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "بانتظار المراجعة بس" : "عرض كل الطلبات"}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-3">
        {apps.map((app) => (
          <Card key={app.id} className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">
                  {app.company_name}{" "}
                  <span className="font-normal text-slate-400">— {SUPPLIER_ORG_TYPE_LABELS[app.org_type]}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {app.contact_name} · {app.contact_email}
                  {app.contact_phone ? ` · 📞 ${app.contact_phone}` : ""}
                  {app.contact_whatsapp ? ` · واتساب ${app.contact_whatsapp}` : ""}
                  {app.country_code ? ` · ${app.country_code}` : ""}
                </p>
                {app.website ? (
                  <a href={app.website} target="_blank" rel="noreferrer" className="text-xs text-[#0C7BB3] underline">
                    {app.website}
                  </a>
                ) : null}
              </div>
              <Badge
                tone={app.status === "rejected" ? "urgent" : app.status === "approved" ? "empty_seat" : "default"}
              >
                {SUPPLIER_APPLICATION_STATUS_LABELS[app.status]}
              </Badge>
            </div>

            {app.notes ? <p className="text-sm text-slate-600">📝 {app.notes}</p> : null}

            {app.status !== "pending" && app.review_note ? (
              <p className="text-xs text-slate-500">ملاحظة المراجعة: {app.review_note}</p>
            ) : null}

            {app.status === "pending" ? (
              <div className="space-y-2 border-t border-slate-100 pt-2">
                <input
                  type="text"
                  placeholder="ملاحظة مراجعة (اختياري)"
                  value={noteDraft[app.id] ?? ""}
                  onChange={(e) => setNoteDraft((prev) => ({ ...prev, [app.id]: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-[#BFE3F6]"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={busyId === app.id} onClick={() => approve(app)}>
                    ✔ قبول وإنشاء المورد
                  </Button>
                  <Button type="button" variant="outline" disabled={busyId === app.id} onClick={() => reject(app)}>
                    ✕ رفض
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        ))}
        {!loading && apps.length === 0 ? (
          <Card className="text-center text-sm text-slate-400">لا توجد طلبات {showAll ? "" : "بانتظار المراجعة"}.</Card>
        ) : null}
      </div>
    </div>
  );
}
