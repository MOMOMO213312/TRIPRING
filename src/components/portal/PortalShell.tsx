import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { PortalIcon } from "./PortalIcon";
import type { PortalIconName } from "./PortalIcon";
import "../../styles/portal-theme.css";

/** One shared dashboard chrome (dark sidebar + white topbar + light content)
 *  used by all five TripRing dashboards. Each portal only supplies its own
 *  accent (via `portal`), nav items and content — see portal-theme.css. */
export type PortalKind = "airline" | "agency" | "ground" | "admin" | "affiliate";

export interface PortalNavItem {
  key: string;
  label: string;
  icon: PortalIconName;
  /** Route navigation. Omit and pass `onClick` for in-page tab switching. */
  to?: string;
  onClick?: () => void;
  /** Small caption shown above this item when it differs from the previous item's section. */
  section?: string;
}

export interface PortalStat {
  label: string;
  value: ReactNode;
  tone?: "default" | "green" | "amber" | "red";
}

interface Props {
  portal: PortalKind;
  /** e.g. "Airline Portal" — small caption under the logo. */
  portalLabel: string;
  /** Role chip in the topbar (image: "Airline ▾"). */
  roleLabel: string;
  /** Organisation / person shown under the page title. */
  orgName?: string;
  userName?: string;
  nav: PortalNavItem[];
  activeKey: string;
  stats?: PortalStat[];
  onSignOut?: () => void;
  topbarExtra?: ReactNode;
  children: ReactNode;
}

export function PortalShell({
  portal,
  portalLabel,
  roleLabel,
  orgName,
  userName,
  nav,
  activeKey,
  stats,
  onSignOut,
  topbarExtra,
  children,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the user dropdown on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  // Close the mobile drawer whenever the active page changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [activeKey]);

  const activeItem = nav.find((n) => n.key === activeKey);
  const displayName = userName ?? orgName ?? "";
  const initial = (displayName.trim()[0] ?? "T").toUpperCase();

  let lastSection: string | undefined;

  return (
    <div className="pt-root" data-portal={portal}>
      {drawerOpen ? <div className="pt-overlay" onClick={() => setDrawerOpen(false)} /> : null}

      <aside className={`pt-side${drawerOpen ? " open" : ""}`}>
        <Link to="/" className="pt-logo" title="الرجوع لموقع TripRing">
          <img src="/logo.png" alt="" width={34} height={34} />
          <span className="pt-logo-text">
            <b>TripRing</b>
            <small>{portalLabel}</small>
          </span>
        </Link>

        <nav className="pt-nav" aria-label={portalLabel}>
          {nav.map((item) => {
            const showSection = item.section && item.section !== lastSection;
            if (item.section) lastSection = item.section;
            const cls = `pt-nav-item${item.key === activeKey ? " active" : ""}`;
            const inner = (
              <>
                <PortalIcon name={item.icon} />
                <span>{item.label}</span>
              </>
            );
            return (
              <div key={item.key}>
                {showSection ? <div className="pt-nav-section">{item.section}</div> : null}
                {item.to ? (
                  <Link to={item.to} className={cls} aria-current={item.key === activeKey ? "page" : undefined}>
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={cls}
                    aria-current={item.key === activeKey ? "page" : undefined}
                    onClick={() => {
                      item.onClick?.();
                      setDrawerOpen(false);
                    }}
                  >
                    {inner}
                  </button>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="pt-main">
        <header className="pt-topbar">
          <div className="pt-topbar-start">
            <button type="button" className="pt-burger" onClick={() => setDrawerOpen(true)} aria-label="القائمة">
              <PortalIcon name="menu" size={22} />
            </button>
            <div>
              <h1 className="pt-title">{activeItem?.label ?? portalLabel}</h1>
              {orgName ? <p className="pt-subtitle">{orgName}</p> : null}
            </div>
          </div>

          <div className="pt-topbar-end">
            {topbarExtra}
            <div className="pt-user" ref={menuRef}>
              <button type="button" className="pt-user-btn" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen}>
                <span className="pt-role">
                  <span className="pt-role-label">{roleLabel}</span>
                  <PortalIcon name="chevron" size={14} />
                </span>
                <span className="pt-avatar">{initial}</span>
              </button>
              {menuOpen ? (
                <div className="pt-menu">
                  {displayName ? <div className="pt-menu-name">{displayName}</div> : null}
                  {onSignOut ? (
                    <button type="button" className="pt-menu-item" onClick={onSignOut}>
                      <PortalIcon name="logout" size={16} />
                      تسجيل الخروج
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="pt-content">
          {stats && stats.length > 0 ? (
            <div className="pt-stats">
              {stats.map((s) => (
                <div key={s.label} className="pt-stat">
                  <div className="pt-stat-label">{s.label}</div>
                  <div className={`pt-stat-value ${s.tone ?? "default"}`}>{s.value}</div>
                </div>
              ))}
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
