import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";

const ITEMS: {
  to: string;
  labelKey: string;
  match: (p: string, h: string) => boolean;
  icon: (active: boolean) => React.ReactNode;
}[] = [
  {
    to: "/",
    labelKey: "nav.home",
    match: (p, h) => p === "/" && !h,
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="size-5">
        <path d="M4 11.5 12 4l8 7.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 10v9.5h12V10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/deals",
    labelKey: "nav.deals",
    match: (p) => p.startsWith("/deals"),
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="size-5">
        <path
          d="M4 5.5 12.5 4l7.5 7.5-8.5 8.5L4 12.5V5.5Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="9" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    to: "/search",
    labelKey: "nav.search",
    match: (p) => p.startsWith("/search"),
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="size-5">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m20 20-4.3-4.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: "/explore",
    labelKey: "nav.explore",
    match: (p) => p.startsWith("/explore"),
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="size-5">
        <circle cx="12" cy="12" r="9" />
        <path d="m14.5 9.5-2 5-3 1.5 2-5 3-1.5Z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/my-trips",
    labelKey: "nav.myTrips",
    match: (p) => p.startsWith("/my-trips"),
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.8} className="size-5">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

/** Fixed bottom tab bar, mobile only — desktop keeps the header's primary nav. */
export function BottomNav() {
  const { t } = useTranslation();
  const { pathname, hash } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label={t("nav.main")}
    >
      <div className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = item.match(pathname, hash);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition ${
                active ? "text-[#1E3A8A]" : "text-slate-500"
              }`}
            >
              {item.icon(active)}
              {t(item.labelKey)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
