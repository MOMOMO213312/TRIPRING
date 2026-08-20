import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/EmptyState";
import { Input } from "../components/ui/Input";
import { PaymentProofUpload } from "../components/PaymentProofUpload";
import { lookupBooking } from "../lib/api";
import { setSessionContact } from "../lib/session";
import { formatDate, formatPrice } from "../lib/utils";
import { airlineName, airportLabel } from "../lib/deal-utils";
import { useCatalog } from "../hooks/useCatalog";
import type { BookingLookupResult } from "../types/database";

type PrefillState = { bookingNumber?: string; contact?: string; autoSearch?: boolean };

const STATUS_LABEL: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  awaiting_payment: "بانتظار الدفع",
  payment_uploaded: "تم رفع إثبات الدفع",
  paid: "تم الدفع",
  ticket_issued: "تم إصدار التذكرة",
  cancelled: "ملغي",
};

export function MyTripsPage() {
  const catalog = useCatalog();
  const location = useLocation();
  const prefill = (location.state as PrefillState | null) ?? null;
  const [bookingNumber, setBookingNumber] = useState(prefill?.bookingNumber ?? "");
  const [contact, setContact] = useState(prefill?.contact ?? "");
  const [booking, setBooking] = useState<BookingLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function runSearch(num: string, contactValue: string) {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const result = await lookupBooking(num, contactValue);
      setBooking(result);
      if (result) setSessionContact(contactValue);
      if (!result) setError("لم يتم العثور على حجز بهذه البيانات");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ في البحث");
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }

  // Coming from ConfirmationPage after a page refresh: run the lookup
  // automatically instead of making the user retype what they just entered.
  useEffect(() => {
    if (prefill?.autoSearch && prefill.bookingNumber && prefill.contact) {
      runSearch(prefill.bookingNumber, prefill.contact);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    await runSearch(bookingNumber, contact);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">رحلاتي</h1>
        <p className="text-slate-600">ابحث برقم الحجز ورقم الهاتف أو البريد الإلكتروني — بدون تسجيل دخول</p>
      </div>

      <Card>
        <form onSubmit={handleSearch} className="space-y-4">
          <Input
            label="رقم الحجز"
            required
            value={bookingNumber}
            onChange={(e) => setBookingNumber(e.target.value)}
            placeholder="مثال: 1001"
          />
          <Input
            label="رقم الهاتف أو البريد الإلكتروني"
            required
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "جاري البحث..." : "بحث"}
          </Button>
        </form>
      </Card>

      {error ? <Card className="text-red-600">{error}</Card> : null}

      {booking ? (
        <Card>
          <h2 className="mb-4 font-bold">تفاصيل الحجز</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">رقم الحجز</dt>
              <dd className="font-bold">{booking.booking_number}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">الحالة</dt>
              <dd>{STATUS_LABEL[booking.status] ?? booking.status}</dd>
            </div>
            {booking.deal ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">الرحلة</dt>
                <dd>
                  {!catalog.loading
                    ? `${airportLabel(booking.deal.from_airport, catalog.airports)} → ${airportLabel(booking.deal.to_airport, catalog.airports)}`
                    : `${booking.deal.from_airport} → ${booking.deal.to_airport}`}
                </dd>
              </div>
            ) : null}
            {booking.deal ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">تاريخ السفر</dt>
                <dd>{formatDate(booking.deal.departure_date)}</dd>
              </div>
            ) : null}
            {booking.deal?.airline_code ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">شركة الطيران</dt>
                <dd>{!catalog.loading ? airlineName(booking.deal.airline_code, catalog.airlines) : booking.deal.airline_code}</dd>
              </div>
            ) : null}
            {booking.total_price ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">المبلغ</dt>
                <dd>{formatPrice(booking.total_price, booking.currency)}</dd>
              </div>
            ) : null}
            {booking.payment_method ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">طريقة الدفع</dt>
                <dd>{booking.payment_method}</dd>
              </div>
            ) : null}
          </dl>
          {booking.travelers.length > 0 ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">المسافرون</p>
              <ul className="space-y-1 text-sm text-slate-600">
                {booking.travelers.map((t, i) => (
                  <li key={i}>{t.full_name}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {booking.services.length > 0 ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">خدمات إضافية</p>
              <ul className="space-y-1 text-sm text-slate-600">
                {booking.services.map((s, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{s.type} × {s.quantity}</span>
                    <span>{formatPrice(s.unit_price * s.quantity, booking.currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {booking.status === "ticket_issued" && booking.ticket_url ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <a
                href={booking.ticket_url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg bg-[#0C7BB3] py-2.5 text-center text-sm font-semibold text-white"
              >
                🎫 عرض/تحميل التذكرة
              </a>
            </div>
          ) : null}
          {!["paid", "ticket_issued", "cancelled"].includes(booking.status) ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <PaymentProofUpload
                bookingNumber={String(booking.booking_number)}
                contact={contact}
                onUploaded={() => runSearch(bookingNumber, contact)}
              />
            </div>
          ) : null}
        </Card>
      ) : searched && !error && !loading ? (
        <EmptyState icon="🎫" title="لا توجد نتائج" subtitle="تأكد من رقم الحجز وبيانات التواصل وحاول مرة أخرى" />
      ) : null}
    </div>
  );
}
