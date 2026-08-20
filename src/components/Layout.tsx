import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { Footer } from "./Footer";

export function Layout() {
  const location = useLocation();
  const { pathname, hash } = location;
  const isHome = pathname === "/";
  const [lang, setLang] = useState<"AR" | "EN">("AR");
  const [exploreOpen, setExploreOpen] = useState(false);
  const exploreRef = useRef<HTMLDivElement>(null);

  // Close the Explore dropdown on outside click.
  useEffect(() => {
    if (!exploreOpen) return;
    const onClick = (e: MouseEvent) => {
      if (exploreRef.current && !exploreRef.current.contains(e.target as Node)) {
        setExploreOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [exploreOpen]);

  // Close the dropdown whenever the route changes (e.g. after picking an option).
  useEffect(() => {
    setExploreOpen(false);
  }, [pathname, hash]);

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
    active ? "font-semibold text-[#0C7BB3]" : "text-slate-600 hover:text-[#0F172A]";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-[#0C7BB3] bg-white text-[#0F172A]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-b border-[#0C7BB3] px-4 py-2.5 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="hover:text-[#0F172A]">مساعدة ▾</span>
          </div>
        </div>

        <div>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3.5">
            <Link to="/" className="flex items-center gap-2 text-xl font-extrabold text-[#0F172A]">
              <img src="/logo.png" alt="TripRing" className="size-9 rounded-xl" />
              <span className="font-display">TripRing</span>
            </Link>

            <nav className="flex flex-wrap items-center gap-6 text-sm font-medium">
              <Link to="/" className={`border-b-2 pb-1 ${isHome && !hash ? "border-[#0C7BB3]" : "border-transparent"} ${linkClass(isHome && !hash)}`}>
                الرئيسية
              </Link>
              <Link to="/deals" className={`flex items-center gap-1.5 ${linkClass(pathname.startsWith("/deals"))}`}>
                العروض
                <span className="rounded-full bg-[#0C7BB3] px-1.5 py-0.5 text-[10px] font-bold text-white">Hot</span>
              </Link>
              <div ref={exploreRef} className="relative">
                <button
                  type="button"
                  onClick={() => setExploreOpen((o) => !o)}
                  className={`flex items-center gap-1 ${linkClass(pathname.startsWith("/search"))}`}
                  aria-expanded={exploreOpen}
                >
                  استكشف
                  <span className={`text-[10px] transition-transform ${exploreOpen ? "rotate-180" : ""}`}>▾</span>
                </button>
                {exploreOpen && (
                  <div className="absolute end-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                    <Link to="/#destinations" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      كل الوجهات
                    </Link>
                    <Link to="/search?scope=international" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      الرحلات الدولية
                    </Link>
                    <Link to="/search?scope=domestic" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      الرحلات الداخلية
                    </Link>
                    <Link to="/#budget" className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      الميزانية
                    </Link>
                  </div>
                )}
              </div>
            </nav>

            <div className="flex items-center gap-3 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setLang((l) => (l === "AR" ? "EN" : "AR"))}
                className="font-latin rounded-full border border-[#0C7BB3] px-3 py-1.5 text-[#0C7BB3] transition hover:bg-[#E5F4FB]"
              >
                {lang === "AR" ? "عربية" : "English"}
              </button>
              <button
                type="button"
                className="font-latin rounded-full border border-[#0C7BB3] px-3 py-1.5 text-[#0C7BB3] transition hover:bg-[#E5F4FB]"
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
