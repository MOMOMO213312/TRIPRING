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
    active ? "font-semibold text-[#2563EB]" : "hover:text-[#2563EB]";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="flex items-center gap-2 text-xl font-extrabold text-[#2563EB]">
            <span className="flex size-7 items-center justify-center rounded-full bg-[#2563EB] text-sm text-white">
              ✈️
            </span>
            TripRing
          </Link>

          <nav className="flex flex-wrap items-center gap-5 text-sm font-medium text-gray-700">
            <Link to="/" className={linkClass(isHome && !hash)}>
              الرئيسية
            </Link>
            <Link to="/deals" className={linkClass(pathname.startsWith("/deals"))}>
              العروض
              <span className="ms-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                Hot
              </span>
            </Link>
            <Link to="/#opportunities" className="hover:text-[#2563EB]">
              أفضل رحلات اليوم
            </Link>
            <Link to="/#budget" className="hover:text-[#2563EB]">
              ميزانيتي
            </Link>
            <Link to="/my-trips" className={linkClass(pathname === "/my-trips")}>
              رحلاتي
            </Link>
            <Link
              to="/blue-friday"
              className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700"
            >
              ✨ الجمعة السماوي
            </Link>
          </nav>

          <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
            <span className="font-latin rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold">
              EGP
            </span>
            <button
              type="button"
              onClick={() => setLang((l) => (l === "AR" ? "EN" : "AR"))}
              className="font-latin rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold hover:border-[#2563EB] hover:text-[#2563EB]"
              title="اللغة (قريباً: ترجمة كاملة)"
            >
              {lang} ▾
            </button>
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
