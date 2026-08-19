import { Link } from "react-router-dom";

/** Compact "تنبيهات الأسعار" teaser card for the homepage sidebar — links through
 *  to the full /alerts flow instead of duplicating its create-alert logic here. */
export function PriceAlertTeaserCard() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-[#EAF6FC] text-[#299FD1]" aria-hidden>
          🔔
        </span>
        <h3 className="font-bold text-gray-900">تنبيهات الأسعار</h3>
      </div>
      <p className="mb-4 text-sm text-gray-600">احصل على إشعار عند انخفاض الأسعار لمسارك</p>
      <Link
        to="/alerts"
        className="mb-3 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-medium text-gray-500 transition hover:border-[#299FD1]"
      >
        CAI - DXB
      </Link>
      <Link
        to="/alerts"
        className="block w-full rounded-xl bg-[#0F172A] py-2.5 text-center text-sm font-bold text-white transition hover:bg-slate-800"
      >
        إنشاء تنبيه
      </Link>
    </div>
  );
}

/** Compact "استكشف حسب الميزانية" teaser card — links down to the full budget
 *  explorer section already on the page instead of re-implementing it. */
export function BudgetTeaserCard() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-[#FBEAEA] text-[#DB2F2B]" aria-hidden>
          💰
        </span>
        <h3 className="font-bold text-gray-900">استكشف حسب الميزانية</h3>
      </div>
      <p className="mb-4 text-sm text-gray-600">اختر ما يناسب ميزانيتك</p>
      <Link
        to="/search?budget=100"
        className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
      >
        <span>أقل من $100</span>
        <span aria-hidden>‹</span>
      </Link>
    </div>
  );
}
