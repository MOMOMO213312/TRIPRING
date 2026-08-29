import { useEffect, useRef, useState } from "react";

import { BOOKING_STATUS_LABELS, fetchAgencyBookings, updateBookingStatus, uploadTicketFile } from "../../lib/agency";
import { friendlyErrorMessage } from "../../lib/errors";
import type { BookingRow } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";

/** Bookings awaiting a payment/ticket decision: awaiting_payment, payment_uploaded, paid. */
function needsAttention(b: BookingRow): boolean {
  return b.status === "awaiting_payment" || b.status === "payment_uploaded" || b.status === "paid";
}

/** Real file upload (PDF/image) for issuing a ticket — replaces the old
 *  "paste a link" field. Uploads straight to the `tickets` storage bucket
 *  and marks the booking ticket_issued in one step once the upload succeeds. */
function TicketUpload({
  booking,
  uploading,
  onFile,
}: {
  booking: BookingRow;
  uploading: boolean;
  onFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
      {booking.ticket_url ? (
        <a
          href={booking.ticket_url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-[#0C7BB3] underline"
        >
          عرض التذكرة الحالية ↗
        </a>
      ) : null}
      <Button disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? "جاري رفع التذكرة..." : booking.ticket_url ? "🎫 استبدال ملف التذكرة" : "🎫 رفع التذكرة وتأكيد الإصدار"}
      </Button>
    </div>
  );
}

export function AgencyPaymentTab({
  agencyId,
  onChanged,
}: {
  agencyId: string;
  onChanged?: () => void;
}) {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [paymentRefDraft, setPaymentRefDraft] = useState<Record<string, string>>({});
  const [uploadingTicketId, setUploadingTicketId] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [awaiting, confirmed] = await Promise.all([
        fetchAgencyBookings(agencyId, "awaiting_payment"),
        fetchAgencyBookings(agencyId, "confirmed"),
      ]);
      setBookings([...awaiting, ...confirmed].filter(needsAttention));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل الحجوزات");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  async function markPaid(b: BookingRow) {
    setSavingId(b.id);
    setError(null);
    try {
      await updateBookingStatus(b.id, "paid", { paymentRef: paymentRefDraft[b.id] || b.payment_ref });
      await reload();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تأكيد الدفع");
    } finally {
      setSavingId(null);
    }
  }

  async function uploadAndIssueTicket(b: BookingRow, file: File) {
    setUploadingTicketId(b.id);
    setError(null);
    try {
      const ticketUrl = await uploadTicketFile(agencyId, b.id, file);
      await updateBookingStatus(b.id, "ticket_issued", { ticketUrl });
      await reload();
      onChanged?.();
    } catch (err) {
      setError(friendlyErrorMessage(err, "تعذر رفع التذكرة، جرّب تاني.", "AgencyPaymentTab.uploadTicket"));
    } finally {
      setUploadingTicketId(null);
    }
  }

  async function cancel(b: BookingRow) {
    setSavingId(b.id);
    setError(null);
    try {
      await updateBookingStatus(b.id, "cancelled");
      await reload();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إلغاء الحجز");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <div className="py-10 text-center text-sm text-slate-500">جاري التحميل...</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        راجع إثبات الدفع وحدّث الحالة النهائية للحجوزات — تظهر هنا الحجوزات بانتظار الدفع أو التي دفعت
        وتنتظر إصدار التذكرة.
      </p>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {bookings.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">لا توجد حجوزات تحتاج مراجعة الآن</p>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <Card key={b.id} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900">حجز #{b.booking_number}</span>{" "}
                  <Badge tone={b.status === "paid" ? "empty_seat" : "flash"}>
                    {BOOKING_STATUS_LABELS[b.status]}
                  </Badge>
                </div>
                <span className="text-sm text-slate-600">
                  {b.total_price ?? b.unit_price ?? "—"} {b.currency ?? ""}
                </span>
              </div>

              <div className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
                <p>👤 {b.customer_name}</p>
                <p dir="ltr" className="text-right">
                  📞 {b.customer_phone}
                </p>
                <p>
                  طريقة الدفع:{" "}
                  {b.payment_method === "bank_transfer"
                    ? "تحويل بنكي"
                    : b.payment_method === "instapay"
                      ? "InstaPay"
                      : b.payment_method === "vodafone_cash"
                        ? "فودافون كاش"
                        : "—"}
                </p>
                {b.payment_ref ? <p>مرجع الدفع الحالي: {b.payment_ref}</p> : null}
              </div>

              {b.payment_proof_url ? (
                <a
                  href={b.payment_proof_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-sm font-semibold text-[#0C7BB3] underline"
                >
                  عرض إثبات الدفع المرفوع ↗
                </a>
              ) : (
                <p className="text-xs text-slate-400">لم يرفع العميل إثبات دفع بعد</p>
              )}

              {(b.status === "awaiting_payment" || b.status === "payment_uploaded") && (
                <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                  <Input
                    label="مرجع الدفع (رقم العملية)"
                    value={paymentRefDraft[b.id] ?? b.payment_ref ?? ""}
                    onChange={(e) =>
                      setPaymentRefDraft((p) => ({ ...p, [b.id]: e.target.value }))
                    }
                    className="min-w-[180px]"
                  />
                  <Button disabled={savingId === b.id} onClick={() => markPaid(b)}>
                    {savingId === b.id ? "جاري الحفظ..." : "✅ تأكيد الدفع"}
                  </Button>
                  <Button variant="secondary" disabled={savingId === b.id} onClick={() => cancel(b)}>
                    إلغاء الحجز
                  </Button>
                </div>
              )}

              {b.status === "paid" && (
                <TicketUpload
                  booking={b}
                  uploading={uploadingTicketId === b.id}
                  onFile={(file) => uploadAndIssueTicket(b, file)}
                />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
