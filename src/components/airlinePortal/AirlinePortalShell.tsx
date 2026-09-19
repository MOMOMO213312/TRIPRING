import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../../lib/supabase";
import type { AirlineOverviewRow } from "../../lib/airlinePortal";
import { PortalShell } from "../portal/PortalShell";
import type { PortalNavItem, PortalStat } from "../portal/PortalShell";
import "../../styles/airline-portal.css";

type ActiveKey =
  | "overview"
  | "flights"
  | "bookings"
  | "ground"
  | "agreements"
  | "services"
  | "settlements"
  | "reports";

interface Props {
  overview?: AirlineOverviewRow | null;
  active: ActiveKey;
  children: ReactNode;
}

const NAV: PortalNavItem[] = [
  { key: "overview", label: "نظرة عامة", icon: "dashboard", to: "/airline-portal/overview" },
  { key: "flights", label: "الرحلات", icon: "plane", to: "/airline-portal/flights" },
  { key: "bookings", label: "الحجوزات", icon: "list", to: "/airline-portal/bookings" },
  { key: "ground", label: "الخدمات الأرضية", icon: "truck", to: "/airline-portal/ground" },
  { key: "agreements", label: "العقود", icon: "file", to: "/airline-portal/agreements" },
  { key: "services", label: "الخدمات الإضافية", icon: "layers", to: "/airline-portal/services" },
  { key: "settlements", label: "كشوف الحساب", icon: "wallet", to: "/airline-portal/settlements" },
  { key: "reports", label: "التقارير", icon: "chart", to: "/airline-portal/reports" },
];

/** Airline Control Center chrome — now a thin wrapper over the shared
 *  <PortalShell> (same sidebar/topbar as the other four dashboards). The
 *  props API is unchanged, so none of the airline pages had to change. */
export function AirlinePortalShell({ overview, active, children }: Props) {
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/airline-portal/login");
  }

  const stats: PortalStat[] | undefined =
    overview && active === "overview"
      ? [
          { label: "رحلات نشطة", value: overview.active_flights },
          { label: "مغادرات خلال 30 يوم", value: overview.departures_next_30d },
          { label: "حجوزات فعّالة", value: overview.active_bookings, tone: "green" },
          { label: "إجمالي الحجوزات", value: overview.total_bookings },
          {
            label: "طلبات خدمة أرضية مفتوحة",
            value: overview.ground_requests_open,
            tone: overview.ground_requests_open > 0 ? "amber" : "green",
          },
        ]
      : undefined;

  return (
    <PortalShell
      portal="airline"
      portalLabel="Airline Portal"
      roleLabel="شركة طيران"
      orgName={overview?.airline_name ?? undefined}
      userName={overview?.airline_name ?? undefined}
      nav={NAV}
      activeKey={active}
      stats={stats}
      onSignOut={handleSignOut}
    >
      {children}
    </PortalShell>
  );
}
