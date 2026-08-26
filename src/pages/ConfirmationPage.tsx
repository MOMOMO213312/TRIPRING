import { Link, useLocation } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PaymentProofUpload } from "../components/PaymentProofUpload";
import { useCatalog } from "../hooks/useCatalog";
import { getAgencyWhatsApp } from "../lib/api";
import { formatRoute } from "../lib/deal-utils";
import { getLastBooking } from "../lib/session";
import { formatPrice, whatsAppLink } from "../lib/utils";
import { transferKindLabel } from "../lib/tripgo";
import type { CreateBookingResult } from "../lib/api";
import type { DealRow, PaymentMethod, TripGoDealRow } from "../types/database";

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
  const catalog = useCatalog();

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

  const { booking, deal, paymentMethod, customerName, customerPhone, adults, children, infants, tripGo } = state;
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
    `المبلغ: ${formatPrice(booking.total_price, booking.currency)}`,
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
            <dt className="text-sm text-slate-500">المبلغ</dt>
            <dd className="font-semibold">{formatPrice(booking.total_price, booking.currency)}</dd>
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
