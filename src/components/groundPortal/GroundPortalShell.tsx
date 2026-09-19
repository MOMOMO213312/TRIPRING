import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../../lib/supabase";
import type { GroundQueueRow } from "../../lib/groundPortal";
import { PortalShell } from "../portal/PortalShell";
import type { PortalNavItem, PortalStat } from "../portal/PortalShell";
import "../../styles/ground-portal.css";

interface Props {
  supplierName?: string;
  queue?: GroundQueueRow[]; // pass the live queue in to drive the top stats
  active: "queue" | "airlines" | "agreements" | "reports" | "settlements";
  children: ReactNode;
}

const NAV: PortalNavItem[] = [
  { key: "queue", label: "الطابور", icon: "list", to: "/ground-portal/queue" },
  { key: "airlines", label: "شركات الطيران", icon: "plane", to: "/ground-portal/airlines" },
  { key: "agreements", label: "العقود والتسعير", icon: "file", to: "/ground-portal/agreements" },
  { key: "reports", label: "التقارير", icon: "chart", to: "/ground-portal/reports" },
  { key: "settlements", label: "كشف الحساب", icon: "wallet", to: "/ground-portal/settlements" },
];

/** Ground Handling chrome — thin wrapper over the shared <PortalShell>.
 *  Props API unchanged so the five ground pages did not need to change. */
export function GroundPortalShell({ supplierName, queue = [], active, children }: Props) {
  const navigate = useNavigate();

  const pending = queue.filter((r) => r.execution_status === "not_started").length;
  const inProgress = queue.filter(
    (r) => r.execution_status === "accepted" || r.execution_status === "in_progress",
  ).length;
  const slaRisk = queue.filter((r) => r.sla_state === "amber" || r.sla_state === "red").length;
  const doneToday = queue.filter((r) => r.execution_status === "completed").length;

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/ground-portal/login");
  }

  const stats: PortalStat[] | undefined =
    active === "queue"
      ? [
          { label: "بانتظار البدء", value: pending, tone: "amber" },
          { label: "جاري التنفيذ", value: inProgress },
          { label: "خطر SLA", value: slaRisk, tone: slaRisk > 0 ? "red" : "green" },
          { label: "تم إنجازها", value: doneToday, tone: "green" },
        ]
      : undefined;

  return (
    <PortalShell
      portal="ground"
      portalLabel="Ground Handling"
      roleLabel="خدمات أرضية"
      orgName={supplierName}
      userName={supplierName}
      nav={NAV}
      activeKey={active}
      stats={stats}
      onSignOut={handleSignOut}
    >
      {children}
    </PortalShell>
  );
}
