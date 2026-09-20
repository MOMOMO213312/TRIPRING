import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { JourneyPanel } from "../components/JourneyPanel";
import { PaymentProofUpload } from "../components/PaymentProofUpload";
import { useCatalog } from "../hooks/useCatalog";
import { getAgencyWhatsApp, lookupBooking } from "../lib/api";
import { formatRoute } from "../lib/deal-utils";
import { getLastBooking } from "../lib/session";
import { whatsAppLink } from "../lib/utils";
import { transferKindLabel } from "../lib/tripgo";
import type { CreateBookingResult } from "../lib/api";
import type { BookingLookupResult, DealRow, PaymentMethod, TripGoDealRow } from "../types/database";
import { useCurrency } from "../hooks/useCurrency";

type TripGoState = {
  pickupLocation: string;
  pickupArea: string;
  flightNumber: string;
  transport: TripGoDealRow | null;
};

type LocationState = {
  booking: CreateBookingResult;
  deal: DealRow;
  paymentMethod: PaymentMethod;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  adults: number;
  children: number;
  infants: number;
  tripGo?: TripGoState;
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "تحويل بنكي",
  instapay: "InstaPay",
  vodafone_cash: "Vodafone Cash",
};

const STATUS_LABELS: Record<CreateBookingResult["status"], string> = {
  new: "جديد — بانتظار التواصل",
  contacted: "تم التواصل معك",
  awaiting_payment: "بانتظار الدفع",
  payment_uploaded: "تم استلام إثبات الدفع",
  paid: "تم تأكيد الدفع",
  ticket_issued: "تم إصدار التذكرة",
  cancelled: "ملغي",
};

export function ConfirmationPage() {
  const location = useLocation();
  const state = location.state as LocationState | null;

  if (!state?.booking) {
    // location.state is lost on refresh — fall back to the last booking
    // we remembered locally (set right after a successful booking) so the
    // user can jump straight to their booking instead of typing it in again.
    const lastBooking = getLastBooking();
    return (
      <Card className="text-center">
        <p className="text-slate-600">لا توجد بيانات حجز في هذه الصفحة (ربما بسبب تحديث الصفحة).</p>
        {lastBooking ? (
          <p className="mt-2 text-sm text-slate-500">
            آخر حجز عندك: <span className="font-bold text-accent">{lastBooking.bookingNumber}</span>
          </p>
        ) : null}
        <Link
          to="/my-trips"
          state={lastBooking ? { bookingNumber: lastBooking.bookingNumber, contact: lastBooking.contact, autoSearch: true } : undefined}
          className="mt-4 inline-block"
        >
          <Button>عرض حجزي في رحلاتي</Button>
        </Link>
      </Card>
    );
  }

  const { booking, deal, paymentMethod, customerName, customerPhone, customerEmail, adults, children, infants, tripGo } = state;

  return (
    <ConfirmationBody
      booking={booking}
      deal={deal}
      paymentMethod={paymentMethod}
      customerName={customerName}
      customerPhone={customerPhone}
      customerEmail={customerEmail}
      adults={adults}
      children={children}
      infants={infants}
      tripGo={tripGo}
    />
  );
}

function ConfirmationBody({
  booking,
  deal,
  paymentMethod,
  customerName,
  customerPhone,
  customerEmail,
  adults,
  children,
  infants,
  tripGo,
}: LocationState) {
  const { fmtIn } = useCurrency();
  // What the customer must actually transfer: the charge amount in the currency chosen at checkout (total × the rate
  // locked at booking time). Bookings created before multi-currency have no charge fields and are paid in the booking currency.
  const payableCurrency = booking.charge_currency ?? booking.currency;
  const payableAmount = booking.charge_amount != null ? Number(booking.charge_amount) : booking.total_price;
  const catalog = useCatalog();
  // The create_booking RPC returns only the top-level booking fields —
  // order_items (and therefore the per-item journey) are created by a DB
  // trigger right after, so we fetch the full record once via the same
  // lookup_booking RPC My Trips uses. Best-effort: if this fails or the
  // journey isn't ready yet, the rest of the confirmation page still works
  // fine without it (falls back to the single booking.status shown below).
  const [journey, setJourney] = useState<BookingLookupResult["journey"] | null>(null);

  useEffect(() => {
    const contact = customerPhone || customerEmail || "";
    if (!contact) return;
    lookupBooking(String(booking.booking_number), contact)
      .then((result) => setJourney(result?.journey ?? null))
      .catch(() => {
        /* silent — confirmation page must never block on this */
      });
  }, [booking.booking_number, customerPhone, customerEmail]);

  const travelerSummary = [
    `${adults} بالغ`,
    children ? `${children} طفل` : null,
    infants ? `${infants} رضيع` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const waMessage = [
    `مرحباً، أرسلت تحويلاً للحجز رقم ${booking.booking_number}`,
    `الاسم: ${customerName}`,
    `المسار: ${formatRoute(deal)}`,
    `المسافرون: ${travelerSummary}`,
    tripGo ? `مكان الاستلام: ${tripGo.pickupLocation}` : null,
    tripGo?.transport ? `وسيلة النقل: ${transferKindLabel(tripGo.transport.transport_type, tripGo.transport.vehicle_type)}` : null,
    `المبلغ: ${fmtIn(payableAmount, payableCurrency, true)}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center">
      <div className="rounded-full bg-green-100 p-4 text-4xl">✓</div>
      <h1 className="text-2xl font-bold text-slate-900">تم إنشاء الحجز بنجاح</h1>
      <Card className="text-start">
        {tripGo ? (
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0C7BB3] to-[#1E3A8A] px-3 py-1 text-xs font-bold text-white">
            🚐 رحلة TripGo — Flight + Transfer
          </span>
        ) : null}
        <dl className="space-y-3">
          <div>
            <dt className="text-sm text-slate-500">رقم الحجز</dt>
            <dd className="text-2xl font-extrabold text-accent">{booking.booking_number}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">المسار</dt>
            <dd className="font-semibold">{formatRoute(deal)}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">المبلغ المطلوب تحويله</dt>
            <dd className="font-latin text-lg font-bold">{fmtIn(payableAmount, payableCurrency, true)}</dd>
            {payableCurrency !== booking.currency ? (
              <p className="mt-1 text-xs text-slate-500">
                سعر الحجز {fmtIn(booking.total_price, booking.currency, true)} — اتحوّل لـ {payableCurrency} بسعر الصرف اللي اتثبّت وقت الحجز
                {booking.fx_rate ? ` (${Number(booking.fx_rate)})` : ""}.
              </p>
            ) : null}
          </div>
          <div>
            <dt className="text-sm text-slate-500">طريقة الدفع</dt>
            <dd>{PAYMENT_LABELS[paymentMethod]}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">الحالة</dt>
            <dd className="font-semibold text-amber-700">{STATUS_LABELS[booking.status] ?? booking.status}</dd>
          </div>
        </dl>

        {/* Per-item journey status (order_items/fulfillment_status), same
           panel My Trips shows — surfaced here too so the customer sees it
           from the first moment, not only when they look the booking up
           again later. Silently absent if the orchestration data isn't
           ready yet (older bookings, or the trigger hasn't run) — the
           single booking.status above always covers that case. */}
        {journey ? <JourneyPanel journey={journey} currency={booking.currency} /> : null}

        {tripGo ? (
          <div className="mt-4 space-y-2 rounded-2xl border border-[#16A34A]/25 bg-[#F0FDF4] p-3 text-sm">
            <p className="flex items-center gap-1.5 font-extrabold text-[#16A34A]">
              <span aria-hidden>✓</span> تفاصيل نقل المطار
            </p>
            <div className="flex justify-between">
              <span className="text-slate-500">مكان الاستلام</span>
              <span className="font-semibold text-slate-800">{tripGo.pickupLocation || "—"}</span>
            </div>
            {tripGo.pickupArea ? (
              <div className="flex justify-between">
                <span className="text-slate-500">المنطقة</span>
                <span className="font-semibold text-slate-800">{tripGo.pickupArea}</span>
              </div>
            ) : null}
            {tripGo.flightNumber ? (
              <div className="flex justify-between">
                <span className="text-slate-500">رقم الرحلة</span>
                <span className="font-latin font-semibold text-slate-800">{tripGo.flightNumber}</span>
              </div>
            ) : null}
            {tripGo.transport ? (
              <div className="flex justify-between">
                <span className="text-slate-500">وسيلة النقل</span>
                <span className="font-semibold text-slate-800">
                  {transferKindLabel(tripGo.transport.transport_type, tripGo.transport.vehicle_type)}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </Card>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        ⚠️ هذا <strong>طلب حجز</strong> وليس تذكرة مؤكدة بعد. سيتواصل معك فريق الوكالة لتأكيد السعر وتوفر المقعد. لا ترسل التحويل البنكي إلا بعد تأكيد الوكالة للسعر النهائي.
      </div>
      <p className="text-sm text-slate-600">
        بعد تأكيد الوكالة، أكمل التحويل باستخدام طريقة الدفع المختارة، ثم أرسل إيصال التحويل عبر واتساب أو ارفعه هنا مباشرة.
      </p>
      <div className="flex flex-col gap-3">
        <a href={whatsAppLink(getAgencyWhatsApp(deal, catalog.agencies), waMessage)} target="_blank" rel="noreferrer">
          <Button fullWidth variant="whatsapp">
            إرسال عبر واتساب
          </Button>
        </a>
        <PaymentProofUpload bookingNumber={String(booking.booking_number)} contact={customerPhone} />
        <Link to="/my-trips">
          <Button fullWidth variant="outline">
            عرض في رحلاتي
          </Button>
        </Link>
      </div>
      <p className="text-xs text-slate-500">
        احفظ رقم الحجز {booking.booking_number} ورقم هاتفك {customerPhone} للبحث لاحقاً
      </p>
    </div>
  );
}
