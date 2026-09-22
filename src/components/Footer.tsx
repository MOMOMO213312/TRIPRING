import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 text-lg font-extrabold text-[#0C7BB3]">
            <span className="flex size-6 items-center justify-center rounded-full bg-[#0C7BB3] text-xs text-white">
              ✈️
            </span>
            TripRing
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {t("footer.tagline")}
          </p>
        </div>

        <div>
          <p className="text-sm font-bold text-slate-900">{t("footer.importantLinks")}</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>
              <Link to="/faq" className="hover:text-[#0C7BB3]">
                {t("footer.faq")}
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-[#0C7BB3]">
                {t("footer.terms")}
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-[#0C7BB3]">
                {t("footer.privacy")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-bold text-slate-900">{t("footer.platform")}</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-500">
            <li>
              <Link to="/deals" className="hover:text-[#0C7BB3]">
                {t("nav.deals")}
              </Link>
            </li>
            <li>
              <Link to="/my-trips" className="hover:text-[#0C7BB3]">
                {t("nav.myTrips")}
              </Link>
            </li>
            <li>
              <Link to="/blue-friday" className="hover:text-[#0C7BB3]">
                Blue Friday
              </Link>
            </li>
            <li>
              <Link to="/agency" className="hover:text-[#0C7BB3]">
                {t("footer.agencyPortal")}
              </Link>
            </li>
            <li>
              <Link to="/affiliate" className="hover:text-[#0C7BB3]">
                {t("footer.affiliatePortal")}
              </Link>
            </li>
            <li>
              <Link to="/become-a-supplier" className="hover:text-[#0C7BB3]">
                {t("footer.becomeSupplier")}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-100 py-5 text-center text-sm text-slate-500">
        {t("footer.copyright", { year: new Date().getFullYear() })}
        <p className="mt-1 text-xs text-slate-400">
          {t("footer.fxAttribution")}{" "}
          <a
            href="https://www.exchangerate-api.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-latin underline hover:text-[#0C7BB3]"
          >
            Rates By Exchange Rate API
          </a>
        </p>
      </div>
    </footer>
  );
}
