import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { Footer } from "./Footer";

export function Layout() {
  const location = useLocation();
  const { pathname, hash } = location;
  const isHome = pathname === "/";
  const [lang, setLang] = useState<"AR" | "EN">("AR");

  // Smooth-scroll to the section referenced by the URL hash (e.g. /#budget), retrying
  // briefly since homepage sections render after their data finishes loading.
  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    let attempts = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(id);
      attempts += 1;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        clearInterval(timer);
      } else if (attempts > 20) {
        clearInterval(timer);
      }
    }, 150);
    return () => clearInterval(timer);
  }, [hash, pathname]);

  const linkClass = (active: boolean) =>
    active ? "font-semibold text-primary" : "text-slate-600 hover:text-navy";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-primary bg-white text-navy">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-b border-primary px-4 py-2.5 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="hover:text-navy">مساعدة ▾</span>
          </div>
        </div>

        <div>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3.5">
            <Link to="/" className="flex items-center gap-2 text-xl font-extrabold text-navy">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm text-white">
                ✈️
              </span>
              TripRing
            </Link>

            <nav className="flex flex-wrap items-center gap-6 text-sm font-medium">
              <Link to="/" className={`border-b-2 pb-1 ${isHome && !hash ? "border-primary" : "border-transparent"} ${linkClass(isHome && !hash)}`}>
                الرئيسية
              </Link>
              <Link to="/deals" className={`flex items-center gap-1.5 ${linkClass(pathname.startsWith("/deals"))}`}>
                العروض
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">Hot</span>
              </Link>
              <Link to="/#opportunities" className="text-slate-600 hover:text-navy">
                اليوم
              </Link>
              <Link to="/#destinations" className="text-slate-600 hover:text-navy">
                الوجهات
              </Link>
              <Link to="/alerts" className="text-slate-600 hover:text-navy">
                تنبيه الأسعار
              </Link>
              <a href="#footer" className="text-slate-600 hover:text-navy">
                الدعم
              </a>
            </nav>

            <div className="flex items-center gap-3 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setLang((l) => (l === "AR" ? "EN" : "AR"))}
                className="font-latin rounded-full border border-primary px-3 py-1.5 text-primary transition hover:bg-primary-light"
              >
                {lang === "AR" ? "عربية" : "English"}
              </button>
              <button
                type="button"
                className="font-latin rounded-full border border-primary px-3 py-1.5 text-primary transition hover:bg-primary-light"
              >
                EGP ▾
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className={isHome ? "" : "mx-auto max-w-6xl px-4 py-8"}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
