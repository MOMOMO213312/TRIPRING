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
    active ? "font-semibold text-[#1E3A8A]" : "text-slate-600 hover:text-[#0F172A]";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-[#FAFAFA] text-[#0F172A] shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3 border-b border-slate-200 px-4 py-2 text-xs">
          <button
            type="button"
            onClick={() => setLang((l) => (l === "AR" ? "EN" : "AR"))}
            className="font-latin rounded-full border border-[#1E3A8A]/40 px-3 py-1 text-[#1E3A8A] transition hover:bg-[#1E3A8A]/5"
          >
            {lang === "AR" ? "عربية" : "English"}
          </button>
          <button
            type="button"
            className="font-latin rounded-full border border-[#1E3A8A]/40 px-3 py-1 text-[#1E3A8A] transition hover:bg-[#1E3A8A]/5"
          >
            EGP ▾
          </button>
        </div>

        <div>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-start gap-8 px-4 py-3.5">
            <Link to="/" className="flex shrink-0 items-center gap-2 text-xl font-extrabold text-[#0F172A]">
              <img src="/logo.png" alt="TripRing" className="size-9 rounded-xl" />
              <span className="font-display">TripRing</span>
            </Link>

            <nav className="flex flex-wrap items-center gap-6 text-sm font-medium">
              <Link to="/" className={`border-b-2 pb-1 ${isHome && !hash ? "border-[#1E3A8A]" : "border-transparent"} ${linkClass(isHome && !hash)}`}>
                الرئيسية
              </Link>
              <Link to="/deals" className={`flex items-center gap-1.5 ${linkClass(pathname.startsWith("/deals"))}`}>
                العروض
                <span className="rounded-full bg-[#1E3A8A] px-1.5 py-0.5 text-[10px] font-bold text-white">Hot</span>
              </Link>
              <Link to="/explore" className={linkClass(pathname.startsWith("/explore"))}>
                استكشف
              </Link>
              <Link
                to="/tripgo"
                className={`flex items-center gap-1.5 ${linkClass(pathname.startsWith("/tripgo"))}`}
              >
                <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[#0C7BB3] to-[#1E3A8A] px-2.5 py-1 text-white">
                  🚐 TripGo
                </span>
                <span className="rounded-full border border-[#1E3A8A]/30 px-1.5 py-0.5 text-[10px] font-bold text-[#1E3A8A]">
                  ⚡ متقدم
                </span>
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className={isHome ? "" : "mx-auto max-w-6xl px-4 py-6"}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
