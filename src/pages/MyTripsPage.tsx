import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/EmptyState";
import { Input } from "../components/ui/Input";
import { lookupBooking } from "../lib/api";
import { setSessionContact } from "../lib/session";
import { formatDate, formatPrice } from "../lib/utils";
import { airlineName, airportLabel } from "../lib/deal-utils";
import { useCatalog } from "../hooks/useCatalog";
import type { BookingLookupResult } from "../types/database";

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
  const [bookingNumber, setBookingNumber] = useState("");
  const [contact, setContact] = useState("");
  const [booking, setBooking] = useState<BookingLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const result = await lookupBooking(bookingNumber, contact);
      setBooking(result);
      if (result) setSessionContact(contact);
      if (!result) setError("لم يتم العثور على حجز بهذه البيانات");
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطأ في البحث");
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">رحلاتي</h1>
        <p className="text-gray-600">ابحث برقم الحجز ورقم الهاتف أو البريد الإلكتروني — بدون تسجيل دخول</p>
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
              <dt className="text-gray-500">رقم الحجز</dt>
              <dd className="font-bold">{booking.booking_number}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">الحالة</dt>
              <dd>{STATUS_LABEL[booking.status] ?? booking.status}</dd>
            </div>
            {booking.deal ? (
              <div className="flex justify-between">
                <dt className="text-gray-500">الرحلة</dt>
                <dd>
                  {!catalog.loading
                    ? `${airportLabel(booking.deal.from_airport, catalog.airports)} → ${airportLabel(booking.deal.to_airport, catalog.airports)}`
                    : `${booking.deal.from_airport} → ${booking.deal.to_airport}`}
                </dd>
              </div>
            ) : null}
            {booking.deal ? (
              <div className="flex justify-between">
                <dt className="text-gray-500">تاريخ السفر</dt>
                <dd>{formatDate(booking.deal.departure_date)}</dd>
              </div>
            ) : null}
            {booking.deal?.airline_code ? (
              <div className="flex justify-between">
                <dt className="text-gray-500">شركة الطيران</dt>
                <dd>{!catalog.loading ? airlineName(booking.deal.airline_code, catalog.airlines) : booking.deal.airline_code}</dd>
              </div>
            ) : null}
            {booking.total_price ? (
              <div className="flex justify-between">
                <dt className="text-gray-500">المبلغ</dt>
                <dd>{formatPrice(booking.total_price, booking.currency)}</dd>
              </div>
            ) : null}
            {booking.payment_method ? (
              <div className="flex justify-between">
                <dt className="text-gray-500">طريقة الدفع</dt>
                <dd>{booking.payment_method}</dd>
              </div>
            ) : null}
          </dl>
          {booking.travelers.length > 0 ? (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="mb-2 text-sm font-medium text-gray-700">المسافرون</p>
              <ul className="space-y-1 text-sm text-gray-600">
                {booking.travelers.map((t, i) => (
                  <li key={i}>{t.full_name}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      ) : searched && !error && !loading ? (
        <EmptyState icon="🎫" title="لا توجد نتائج" subtitle="تأكد من رقم الحجز وبيانات التواصل وحاول مرة أخرى" />
      ) : null}
    </div>
  );
}
