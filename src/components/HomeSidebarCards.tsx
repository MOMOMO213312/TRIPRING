import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

/** Compact "تنبيهات الأسعار" teaser card for the homepage sidebar — links through
 *  to the full /alerts flow instead of duplicating its create-alert logic here. */
export function PriceAlertTeaserCard() {
  const { t } = useTranslation("home");
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-[#E5F4FB] text-[#0C7BB3]" aria-hidden>
          🔔
        </span>
        <h3 className="font-bold text-slate-900">{t("sidebar.alertsTitle")}</h3>
      </div>
      <p className="mb-4 text-sm text-slate-600">{t("sidebar.alertsText")}</p>
      <Link
        to="/alerts"
        className="mb-3 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:border-[#0C7BB3]"
      >
        CAI - DXB
      </Link>
      <Link
        to="/alerts"
        className="block w-full rounded-xl bg-[#0F172A] py-2.5 text-center text-sm font-bold text-white transition hover:bg-slate-800"
      >
        {t("sidebar.createAlert")}
      </Link>
    </div>
  );
}

/** Compact "استكشف حسب الميزانية" teaser card — scrolls down to the full budget
 *  explorer section already on the page (same #budget anchor the header nav
 *  link uses) instead of duplicating one fixed budget option here. */
export function BudgetTeaserCard() {
  const { t } = useTranslation("home");
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-[#FFE8DC] text-[#0C7BB3]" aria-hidden>
          💰
        </span>
        <h3 className="font-bold text-slate-900">{t("sidebar.budgetTitle")}</h3>
      </div>
      <p className="mb-4 text-sm text-slate-600">{t("sidebar.budgetText")}</p>
      <Link
        to="/#budget"
        className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
      >
        <span>{t("sidebar.budgetAll")}</span>
        <span aria-hidden className="ltr:rotate-180">‹</span>
      </Link>
    </div>
  );
}
