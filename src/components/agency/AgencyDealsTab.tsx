import { useEffect, useState } from "react";

import { fetchAirlines, fetchAirports } from "../../lib/api";
import {
  createDeal,
  DEAL_STATUS_LABELS,
  fetchAgencyDeals,
  setDealStatus,
  updateDeal,
  type DealFormInput,
} from "../../lib/agency";
import type { AirlineRow, AirportRow, DealRow } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { AgencyBulkImportModal } from "./AgencyBulkImportModal";
import { AgencyDealForm } from "./AgencyDealForm";

function statusTone(status: DealRow["status"]): "default" | "flash" | "empty_seat" | "urgent" {
  if (status === "active") return "empty_seat";
  if (status === "cancelled" || status === "expired") return "urgent";
  if (status === "sold_out") return "flash";
  return "default";
}

export function AgencyDealsTab({ agencyId }: { agencyId: string }) {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [airports, setAirports] = useState<AirportRow[]>([]);
  const [airlines, setAirlines] = useState<AirlineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [d, ap, al] = await Promise.all([
        fetchAgencyDeals(agencyId),
        fetchAirports(),
        fetchAirlines(),
      ]);
      setDeals(d);
      setAirports(ap);
      setAirlines(al);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل العروض");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  async function handleCreate(input: DealFormInput) {
    setSubmitting(true);
    setError(null);
    try {
      await createDeal(agencyId, input);
      setShowForm(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء العرض");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(input: DealFormInput) {
    if (!editingDeal) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateDeal(editingDeal.id, input);
      setEditingDeal(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ التعديلات");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(deal: DealRow) {
    const next = deal.status === "active" ? "cancelled" : "active";
    try {
      await setDealStatus(deal.id, next);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث الحالة");
    }
  }

  if (loading) return <div className="py-10 text-center text-sm text-slate-500">جاري التحميل...</div>;

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {!showForm && !editingDeal ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowForm(true)}>+ إضافة عرض جديد</Button>
          <Button variant="outline" onClick={() => setShowBulkImport(true)}>
            📥 استيراد من إكسل
          </Button>
        </div>
      ) : null}

      {showBulkImport ? (
        <AgencyBulkImportModal
          agencyId={agencyId}
          airports={airports}
          airlines={airlines}
          onClose={() => setShowBulkImport(false)}
          onImported={reload}
        />
      ) : null}

      {showForm ? (
        <AgencyDealForm
          airports={airports}
          airlines={airlines}
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          submitting={submitting}
        />
      ) : null}

      {editingDeal ? (
        <AgencyDealForm
          airports={airports}
          airlines={airlines}
          initial={editingDeal}
          onSubmit={handleUpdate}
          onCancel={() => setEditingDeal(null)}
          submitting={submitting}
        />
      ) : null}

      <div className="space-y-3">
        {deals.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">لا توجد عروض بعد</p>
        ) : (
          deals.map((deal) => (
            <Card key={deal.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">
                    {deal.from_airport} → {deal.to_airport}
                  </span>
                  <Badge tone={statusTone(deal.status)}>{DEAL_STATUS_LABELS[deal.status]}</Badge>
                </div>
                <p className="text-sm text-slate-600">
                  {deal.departure_date} · {deal.price} {deal.currency} · {deal.available_seats} مقعد متاح
                </p>
                <p className="text-xs text-slate-400">ينتهي: {new Date(deal.expires_at).toLocaleString("ar-EG")}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingDeal(deal)}>
                  تعديل
                </Button>
                <Button
                  variant={deal.status === "active" ? "secondary" : "primary"}
                  onClick={() => toggleStatus(deal)}
                >
                  {deal.status === "active" ? "إيقاف" : "تفعيل"}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
