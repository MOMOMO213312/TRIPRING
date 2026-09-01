import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { Footer } from "./Footer";
import { AnnouncementTicker } from "./notifications/AnnouncementTicker";
import { PublicNotificationBell } from "./notifications/PublicNotificationBell";

const NAV_ITEMS = [
  { to: "/", label: "الرئيسية", match: (p: string, h: string) => p === "/" && !h },
  { to: "/deals", label: "العروض", match: (p: string) => p.startsWith("/deals") },
  { to: "/explore", label: "اكتشف", match: (p: string) => p.startsWith("/explore") },
  { to: "/tripgo", label: "tripgo", match: (p: string) => p.startsWith("/tripgo") },
];

export function Layout() {
  const location = useLocation();
  const { pathname, hash } = location;
  const isHome = pathname === "/";
  const [lang, setLang] = useState<"AR" | "EN">("AR");
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Close the mobile menu on every navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, hash]);

  const navLinkClass = (active: boolean) =>
    `border-b-2 pb-0.5 transition-colors ${
      active ? "border-[#1E3A8A] font-semibold text-[#1E3A8A]" : "border-transparent text-slate-600 hover:text-[#0F172A]"
    }`;

  const mobileLinkClass = (active: boolean) =>
    `block rounded-lg px-3 py-2.5 text-[15px] ${
      active ? "bg-[#1E3A8A]/5 font-semibold text-[#1E3A8A]" : "text-slate-700 hover:bg-slate-50"
    }`;

  return (
    <div className="min-h-screen bg-slate-50">
      <AnnouncementTicker />
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          {/* Logo */}
          <Link to="/" className="flex shrink-0 items-center gap-2 text-lg font-extrabold text-[#0F172A]">
            <img src="/logo.png" alt="TripRing" className="size-8 rounded-lg" />
            <span className="font-display">TripRing</span>
          </Link>

          {/* Primary navigation — centered on desktop */}
          <nav className="hidden flex-1 items-center justify-center gap-8 text-sm font-medium md:flex">
            {NAV_ITEMS.map((item) => (
              <Link key={item.to} to={item.to} className={navLinkClass(item.match(pathname, hash))}>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Utility controls */}
          <div className="mr-auto flex items-center gap-2 md:mr-0">
            <PublicNotificationBell />
            <div className="hidden items-center gap-2 text-xs md:flex">
              <button
                type="button"
                onClick={() => setLang((l) => (l === "AR" ? "EN" : "AR"))}
                className="font-latin rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:border-[#1E3A8A]/40 hover:text-[#1E3A8A]"
              >
                {lang === "AR" ? "العربية" : "English"}
              </button>
              <button
                type="button"
                className="font-latin rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:border-[#1E3A8A]/40 hover:text-[#1E3A8A]"
              >
                EGP
              </button>
            </div>
            <Link
              to="/my-trips"
              title="رحلاتي"
              aria-label="رحلاتي"
              className={`flex size-8 items-center justify-center rounded-full border transition ${
                pathname.startsWith("/my-trips")
                  ? "border-[#1E3A8A] text-[#1E3A8A]"
                  : "border-slate-200 text-slate-600 hover:border-[#1E3A8A]/40 hover:text-[#1E3A8A]"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" strokeLinecap="round" />
              </svg>
            </Link>

            {/* Hamburger — mobile only */}
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="القائمة"
              aria-expanded={menuOpen}
              className="flex size-8 items-center justify-center rounded-full border border-slate-200 text-slate-700 md:hidden"
            >
              {menuOpen ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
                  <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <Link key={item.to} to={item.to} className={mobileLinkClass(item.match(pathname, hash))}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="my-3 border-t border-slate-100" />
            <div className="flex items-center gap-2 px-3 text-xs">
              <button
                type="button"
                onClick={() => setLang((l) => (l === "AR" ? "EN" : "AR"))}
                className="font-latin rounded-full border border-slate-200 px-3 py-1.5 text-slate-600"
              >
                {lang === "AR" ? "العربية" : "English"}
              </button>
              <button type="button" className="font-latin rounded-full border border-slate-200 px-3 py-1.5 text-slate-600">
                EGP
              </button>
            </div>
          </div>
        )}
      </header>
      <main className={isHome ? "" : "mx-auto max-w-6xl px-4 py-6"}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
