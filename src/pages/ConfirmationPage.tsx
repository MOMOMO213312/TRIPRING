import { Link, useLocation } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useCatalog } from "../hooks/useCatalog";
import { getAgencyWhatsApp } from "../lib/api";
import { formatRoute } from "../lib/deal-utils";
import { formatPrice, whatsAppLink } from "../lib/utils";
import type { CreateBookingResult } from "../lib/api";
import type { DealRow, PaymentMethod } from "../types/database";

type LocationState = {
  booking: CreateBookingResult;
  deal: DealRow;
  paymentMethod: PaymentMethod;
  customerPhone: string;
  customerEmail?: string;
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
    return (
      <Card className="text-center">
        <p className="text-gray-600">لا توجد بيانات حجز. ابحث عن حجزك من صفحة رحلاتي.</p>
        <Link to="/my-trips" className="mt-4 inline-block">
          <Button>رحلاتي</Button>
        </Link>
      </Card>
    );
  }

  const { booking, deal, paymentMethod, customerPhone } = state;
  const waMessage = `مرحباً، أرسلت تحويلاً للحجز رقم ${booking.booking_number} — ${formatRoute(deal)} — ${formatPrice(booking.total_price, booking.currency)}`;

  return (
    <div className="mx-auto max-w-lg space-y-6 text-center">
      <div className="rounded-full bg-green-100 p-4 text-4xl">✓</div>
      <h1 className="text-2xl font-bold text-gray-900">تم إنشاء الحجز بنجاح</h1>
      <Card className="text-start">
        <dl className="space-y-3">
          <div>
            <dt className="text-sm text-gray-500">رقم الحجز</dt>
            <dd className="text-2xl font-extrabold text-accent">{booking.booking_number}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">المسار</dt>
            <dd className="font-semibold">{formatRoute(deal)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">المبلغ</dt>
            <dd className="font-semibold">{formatPrice(booking.total_price, booking.currency)}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">طريقة الدفع</dt>
            <dd>{PAYMENT_LABELS[paymentMethod]}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">الحالة</dt>
            <dd className="font-semibold text-amber-700">{STATUS_LABELS[booking.status] ?? booking.status}</dd>
          </div>
        </dl>
      </Card>
      <p className="text-sm text-gray-600">
        أكمل التحويل باستخدام طريقة الدفع المختارة، ثم أرسل إيصال التحويل عبر واتساب.
      </p>
      <div className="flex flex-col gap-3">
        <a href={whatsAppLink(getAgencyWhatsApp(deal, catalog.agencies), waMessage)} target="_blank" rel="noreferrer">
          <Button fullWidth variant="whatsapp">
            إرسال عبر واتساب
          </Button>
        </a>
        <Link to="/my-trips">
          <Button fullWidth variant="outline">
            عرض في رحلاتي
          </Button>
        </Link>
      </div>
      <p className="text-xs text-gray-500">
        احفظ رقم الحجز {booking.booking_number} ورقم هاتفك {customerPhone} للبحث لاحقاً
      </p>
    </div>
  );
}
