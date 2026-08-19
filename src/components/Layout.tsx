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
    active ? "font-semibold text-white" : "text-white/80 hover:text-white";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#0D9488] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs text-white/80">
          <div className="flex items-center gap-4">
            <span className="hover:text-white">مساعدة ▾</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/my-trips" className="hover:text-white">
              تتبع رحلتك
            </Link>
            <button
              type="button"
              onClick={() => setLang((l) => (l === "AR" ? "EN" : "AR"))}
              className="font-latin hover:text-white"
            >
              {lang === "AR" ? "عربية" : "English"}
            </button>
            <span className="font-latin">EGP ▾</span>
          </div>
        </div>

        <div className="border-t border-white/15">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3.5">
            <Link to="/" className="flex items-center gap-2 text-xl font-extrabold text-white">
              <span className="flex size-8 items-center justify-center rounded-full bg-[#FF6B35] text-sm text-white">
                ✈️
              </span>
              TripRing
            </Link>

            <nav className="flex flex-wrap items-center gap-6 text-sm font-medium">
              <Link to="/" className={`border-b-2 pb-1 ${isHome && !hash ? "border-[#FF6B35]" : "border-transparent"} ${linkClass(isHome && !hash)}`}>
                الرئيسية
              </Link>
              <Link to="/deals" className={`flex items-center gap-1.5 ${linkClass(pathname.startsWith("/deals"))}`}>
                العروض
                <span className="rounded-full bg-[#FF6B35] px-1.5 py-0.5 text-[10px] font-bold text-white">Hot</span>
              </Link>
              <Link to="/#opportunities" className="text-white/80 hover:text-white">
                اليوم
              </Link>
              <Link to="/#destinations" className="text-white/80 hover:text-white">
                الوجهات
              </Link>
              <Link to="/alerts" className="text-white/80 hover:text-white">
                تنبيه الأسعار
              </Link>
              <a href="#footer" className="text-white/80 hover:text-white">
                الدعم
              </a>
            </nav>

            <div className="flex items-center gap-3 text-sm font-semibold">
              <Link to="/my-trips" className="flex items-center gap-1.5 text-white/90 hover:text-white">
                <span aria-hidden>👤</span> سجل الدخول
              </Link>
              <Link
                to="/my-trips"
                className="rounded-full bg-[#FF6B35] px-4 py-2 text-white transition hover:bg-[#E8551F]"
              >
                أنشئ حساب
              </Link>
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
