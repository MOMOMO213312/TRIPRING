import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { AirlineOverviewRow } from "../../lib/airlinePortal";
import "../../styles/airline-portal.css";

interface Props {
  overview?: AirlineOverviewRow | null;
  active: "overview" | "flights" | "bookings" | "ground" | "agreements" | "settlements" | "reports";
  children: ReactNode;
}

/** Same structural pattern as GroundPortalShell (topbar + ticker/KPI strip
 *  + nav + children), themed distinctly (see airline-portal.css) since
 *  this is a different supplier role (airline = owner of the flight
 *  product, not a ground execution desk). */
export function AirlinePortalShell({ overview, active, children }: Props) {
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/airline-portal/login");
  }

  return (
    <div data-airline-portal>
      <div className="ap-shell">
        <div className="ap-topbar">
          <div className="ap-brand">
            <span className="ap-brand-mark">AIRLINE CONTROL</span>
            <span className="ap-brand-sub">{overview?.airline_name ?? "—"}</span>
          </div>
          <nav style={{ display: "flex", gap: 16, fontSize: 13 }}>
            <Link to="/airline-portal/overview" style={{ color: active === "overview" ? "#3ec6e0" : "#8fa8c4" }}>
              نظرة عامة
            </Link>
            <Link to="/airline-portal/flights" style={{ color: active === "flights" ? "#3ec6e0" : "#8fa8c4" }}>
              الرحلات
            </Link>
            <Link to="/airline-portal/bookings" style={{ color: active === "bookings" ? "#3ec6e0" : "#8fa8c4" }}>
              الحجوزات
            </Link>
            <Link to="/airline-portal/ground" style={{ color: active === "ground" ? "#3ec6e0" : "#8fa8c4" }}>
              الخدمات الأرضية
            </Link>
            <Link to="/airline-portal/agreements" style={{ color: active === "agreements" ? "#3ec6e0" : "#8fa8c4" }}>
              العقود
            </Link>
            <Link to="/airline-portal/settlements" style={{ color: active === "settlements" ? "#3ec6e0" : "#8fa8c4" }}>
              كشوف الحساب
            </Link>
            <Link to="/airline-portal/reports" style={{ color: active === "reports" ? "#3ec6e0" : "#8fa8c4" }}>
              التقارير
            </Link>
          </nav>
          <button className="ap-signout" onClick={handleSignOut}>
            تسجيل الخروج
          </button>
        </div>

        {overview ? (
          <div className="ap-kpis">
            <div className="ap-kpi-cell">
              <div className="ap-kpi-num">{overview.active_flights}</div>
              <div className="ap-kpi-label">رحلات نشطة</div>
            </div>
            <div className="ap-kpi-cell">
              <div className="ap-kpi-num">{overview.departures_next_30d}</div>
              <div className="ap-kpi-label">مغادرات خلال 30 يوم</div>
            </div>
            <div className="ap-kpi-cell">
              <div className="ap-kpi-num green">{overview.active_bookings}</div>
              <div className="ap-kpi-label">حجوزات فعّالة</div>
            </div>
            <div className="ap-kpi-cell">
              <div className="ap-kpi-num">{overview.total_bookings}</div>
              <div className="ap-kpi-label">إجمالي الحجوزات</div>
            </div>
            <div className="ap-kpi-cell">
              <div className={`ap-kpi-num ${overview.ground_requests_open > 0 ? "amber" : "green"}`}>
                {overview.ground_requests_open}
              </div>
              <div className="ap-kpi-label">طلبات خدمة أرضية مفتوحة</div>
            </div>
          </div>
        ) : null}

        {children}
      </div>
    </div>
  );
}
