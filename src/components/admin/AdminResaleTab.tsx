import { useEffect, useState } from "react";

import { fetchResaleQueue, RESALE_STATUS_LABELS, updateResaleReview } from "../../lib/admin";
import { friendlyErrorMessage } from "../../lib/errors";
import type { TicketResaleRow } from "../../lib/api";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export function AdminResaleTab() {
  const [resales, setResales] = useState<TicketResaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    fetchResaleQueue(showAll ? undefined : ["submitted", "under_review"])
      .then(setResales)
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل طلبات إعادة البيع", "AdminResaleTab.load")))
      .finally(() => setLoading(false));
  }

  useEffect(load, [showAll]);

  async function review(resale: TicketResaleRow, status: "verified" | "rejected" | "under_review") {
    setBusyId(resale.id);
    try {
      await updateResaleReview(resale.id, { status, verificationNotes: notes[resale.id] || null });
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث حالة الطلب", "AdminResaleTab.review"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? "جاري التحميل..." : `${resales.length} طلب ${showAll ? "" : "بانتظار المراجعة"}`}
        </p>
        <Button type="button" variant="outline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "بانتظار المراجعة بس" : "عرض كل الطلبات"}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-3">
        {resales.map((r) => (
          <Card key={r.id} className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">
                  {r.from_airport} → {r.to_airport} · {r.departure_date}
                </p>
                <p className="text-xs text-slate-500">
                  الراكب: {r.passenger_name} · PNR: {r.pnr_reference} · سعر مطلوب: {r.asking_price} {r.currency}
                </p>
              </div>
              <Badge tone={r.status === "rejected" ? "urgent" : r.status === "verified" ? "empty_seat" : "default"}>
                {RESALE_STATUS_LABELS[r.status]}
              </Badge>
            </div>
            {r.ticket_document_url ? (
              <a
                href={r.ticket_document_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-[#0C7BB3] underline"
              >
                عرض مستند التذكرة
              </a>
            ) : (
              <p className="text-xs text-slate-400">مفيش مستند مرفق</p>
            )}
            {["submitted", "under_review"].includes(r.status) ? (
              <div className="space-y-2 border-t border-slate-100 pt-2">
                <textarea
                  placeholder="ملاحظات المراجعة (اختياري)"
                  className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                  rows={2}
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={busyId === r.id} onClick={() => review(r, "verified")}>
                    ✔ تحقق واعتماد
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyId === r.id}
                    onClick={() => review(r, "under_review")}
                  >
                    تحت المراجعة
                  </Button>
                  <Button type="button" variant="outline" disabled={busyId === r.id} onClick={() => review(r, "rejected")}>
                    ✕ رفض
                  </Button>
                </div>
              </div>
            ) : r.verification_notes ? (
              <p className="border-t border-slate-100 pt-2 text-xs text-slate-500">ملاحظات: {r.verification_notes}</p>
            ) : null}
          </Card>
        ))}
        {!loading && resales.length === 0 ? (
          <Card className="text-center text-sm text-slate-400">لا توجد طلبات {showAll ? "" : "بانتظار المراجعة"}.</Card>
        ) : null}
      </div>
    </div>
  );
}
