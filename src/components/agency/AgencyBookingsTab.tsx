import { useEffect, useState } from "react";

import {
  BOOKING_STATUS_LABELS,
  fetchAgencyBookings,
  updateBookingStatus,
  type BookingStatusGroup,
} from "../../lib/agency";
import { whatsAppLink } from "../../lib/utils";
import type { BookingRow, BookingStatus } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Select } from "../ui/Select";

const GROUPS: { key: BookingStatusGroup; label: string }[] = [
  { key: "new", label: "جديدة" },
  { key: "awaiting_payment", label: "بانتظار الدفع" },
  { key: "confirmed", label: "مؤكدة" },
  { key: "cancelled", label: "ملغية" },
];

function statusTone(status: BookingStatus): "default" | "flash" | "empty_seat" | "urgent" {
  if (status === "paid" || status === "ticket_issued") return "empty_seat";
  if (status === "cancelled") return "urgent";
  if (status === "awaiting_payment" || status === "payment_uploaded") return "flash";
  return "default";
}

const NEXT_STATUS_OPTIONS: Record<BookingStatus, BookingStatus[]> = {
  new: ["contacted", "awaiting_payment", "cancelled"],
  contacted: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["payment_uploaded", "paid", "cancelled"],
  payment_uploaded: ["paid", "cancelled"],
  paid: ["ticket_issued", "cancelled"],
  ticket_issued: ["cancelled"],
  cancelled: ["new"],
};

export function AgencyBookingsTab({
  agencyId,
  onChanged,
}: {
  agencyId: string;
  onChanged?: () => void;
}) {
  const [group, setGroup] = useState<BookingStatusGroup>("new");
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<Record<string, BookingStatus>>({});

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAgencyBookings(agencyId, group);
      setBookings(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل الحجوزات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId, group]);

  async function applyStatus(booking: BookingRow) {
    const next = pendingStatus[booking.id];
    if (!next || next === booking.status) return;
    setSavingId(booking.id);
    setError(null);
    try {
      await updateBookingStatus(booking.id, next);
      await reload();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث حالة الحجز");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setGroup(g.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
              group === g.key ? "bg-[#FF6B35] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="py-10 text-center text-sm text-slate-500">جاري التحميل...</div>
      ) : bookings.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">لا توجد حجوزات في هذا التصنيف</p>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <Card key={b.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900">حجز #{b.booking_number}</span>{" "}
                  <Badge tone={statusTone(b.status)}>{BOOKING_STATUS_LABELS[b.status]}</Badge>
                </div>
                <span className="text-xs text-slate-400">
                  {new Date(b.created_at).toLocaleString("ar-EG")}
                </span>
              </div>

              <div className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
                <p>👤 {b.customer_name}</p>
                <p dir="ltr" className="text-right">
                  📞 {b.customer_phone}
                </p>
                <p>
                  🧑‍🤝‍🧑 {b.adults_count} بالغ
                  {b.children_count ? ` · ${b.children_count} طفل` : ""}
                  {b.infants_count ? ` · ${b.infants_count} رضيع` : ""}
                </p>
                <p>
                  💰 {b.total_price ?? b.unit_price ?? "—"} {b.currency ?? ""}
                </p>
                {b.notes ? <p className="sm:col-span-2 text-slate-500">📝 {b.notes}</p> : null}
              </div>

              <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                <a
                  href={whatsAppLink(
                    b.customer_phone,
                    `مرحباً ${b.customer_name}، بخصوص حجزك رقم ${b.booking_number}`
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button type="button" variant="whatsapp">
                    تواصل عبر واتساب
                  </Button>
                </a>
                <Select
                  label="تغيير الحالة إلى"
                  options={NEXT_STATUS_OPTIONS[b.status].map((s) => ({
                    value: s,
                    label: BOOKING_STATUS_LABELS[s],
                  }))}
                  value={pendingStatus[b.id] ?? ""}
                  placeholder="اختر الحالة الجديدة"
                  onChange={(e) =>
                    setPendingStatus((p) => ({ ...p, [b.id]: e.target.value as BookingStatus }))
                  }
                  className="min-w-[180px]"
                />
                <Button
                  disabled={!pendingStatus[b.id] || savingId === b.id}
                  onClick={() => applyStatus(b)}
                >
                  {savingId === b.id ? "جاري الحفظ..." : "تحديث"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
