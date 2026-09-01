import { useEffect, useState } from "react";

import {
  fetchAgencyBookingServices,
  updateBookingServiceStatus,
  type BookingServiceQueueRow,
} from "../../lib/agency";
import { friendlyErrorMessage } from "../../lib/errors";
import { formatPrice } from "../../lib/utils";
import { BOOKING_SERVICE_STATUS_LABELS, type BookingServiceStatus } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

const FILTERS: { key: BookingServiceStatus | "all"; label: string }[] = [
  { key: "pending_confirmation", label: "بانتظار التأكيد" },
  { key: "confirmed_with_airline", label: "مؤكدة" },
  { key: "failed", label: "متعذّرة" },
  { key: "refunded", label: "مستردة" },
  { key: "all", label: "الكل" },
];

function statusTone(status: BookingServiceStatus): "default" | "flash" | "empty_seat" | "urgent" {
  if (status === "confirmed_with_airline") return "empty_seat";
  if (status === "failed") return "urgent";
  if (status === "refunded") return "default";
  return "flash";
}

// Which transitions make sense from each state — mirrors NEXT_STATUS_OPTIONS
// in AgencyBookingsTab (bookings-status kanban) but for the service lifecycle.
const NEXT_OPTIONS: Record<BookingServiceStatus, BookingServiceStatus[]> = {
  pending_confirmation: ["confirmed_with_airline", "failed"],
  confirmed_with_airline: ["failed", "refunded"],
  failed: ["refunded", "pending_confirmation"],
  refunded: [],
};

export function AgencyBookingServicesTab({ agencyId }: { agencyId: string }) {
  const [filter, setFilter] = useState<BookingServiceStatus | "all">("pending_confirmation");
  const [rows, setRows] = useState<BookingServiceQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAgencyBookingServices(agencyId, filter === "all" ? undefined : filter);
      setRows(data);
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحميل طلبات الخدمات", "AgencyBookingServicesTab.load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId, filter]);

  async function setStatus(row: BookingServiceQueueRow, status: BookingServiceStatus) {
    setSavingId(row.id);
    setError(null);
    try {
      await updateBookingServiceStatus(row.id, status);
      await reload();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث حالة الخدمة", "AgencyBookingServicesTab.update"));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        دي الخدمات الإضافية اللي طلبها العملاء (اختيار مقعد، شنطة زيادة، نقل...) — أكّدها لما تتأكد فعليًا مع شركة
        الطيران أو الجهة المزوّدة، عشان ما نوعدش العميل بحاجة لسه مش مضمونة.
      </p>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              filter === f.key
                ? "border-[#1E3A8A] bg-[#1E3A8A] text-white"
                : "border-slate-200 text-slate-600 hover:border-[#1E3A8A]/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">جاري التحميل...</p>
      ) : rows.length === 0 ? (
        <Card className="text-center text-sm text-slate-500">لا توجد طلبات خدمات في هذه الفئة حاليًا.</Card>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {row.service?.name ?? "خدمة"} × {row.quantity}
                    <span className="text-slate-400"> — {formatPrice(row.price * row.quantity)}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    حجز #{row.booking?.booking_number} · {row.booking?.customer_name} ·{" "}
                    {row.booking?.customer_phone}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(row.status)}>{BOOKING_SERVICE_STATUS_LABELS[row.status]}</Badge>
                  {NEXT_OPTIONS[row.status].map((next) => (
                    <Button
                      key={next}
                      type="button"
                      variant="outline"
                      disabled={savingId === row.id}
                      onClick={() => setStatus(row, next)}
                    >
                      {BOOKING_SERVICE_STATUS_LABELS[next]}
                    </Button>
                  ))}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
