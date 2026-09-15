import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { GroundQueueRow } from "../../lib/groundPortal";
import "../../styles/ground-portal.css";

interface Props {
  supplierName?: string;
  queue?: GroundQueueRow[]; // pass the live queue in to drive the ticker
  active: "queue" | "reports" | "settlements";
  children: ReactNode;
}

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

  return (
    <div data-ground-portal>
      <div className="gp-shell">
        <div className="gp-topbar">
          <div className="gp-brand">
            <span className="gp-brand-mark">GROUND OPS</span>
            <span className="gp-brand-sub">{supplierName ?? "—"}</span>
          </div>
          <nav style={{ display: "flex", gap: 16, fontSize: 13 }}>
            <Link
              to="/ground-portal/queue"
              style={{ color: active === "queue" ? "#c9a227" : "#93a4c2" }}
            >
              الطابور
            </Link>
            <Link
              to="/ground-portal/reports"
              style={{ color: active === "reports" ? "#c9a227" : "#93a4c2" }}
            >
              التقارير
            </Link>
            <Link
              to="/ground-portal/settlements"
              style={{ color: active === "settlements" ? "#c9a227" : "#93a4c2" }}
            >
              كشف الحساب
            </Link>
          </nav>
          <button className="gp-signout" onClick={handleSignOut}>
            تسجيل الخروج
          </button>
        </div>

        <div className="gp-ticker">
          <div className="gp-ticker-cell">
            <div className="gp-ticker-num brass">{pending}</div>
            <div className="gp-ticker-label">بانتظار البدء</div>
          </div>
          <div className="gp-ticker-cell">
            <div className="gp-ticker-num">{inProgress}</div>
            <div className="gp-ticker-label">جاري التنفيذ</div>
          </div>
          <div className="gp-ticker-cell">
            <div className={`gp-ticker-num ${slaRisk > 0 ? "red" : "green"}`}>{slaRisk}</div>
            <div className="gp-ticker-label">خطر SLA</div>
          </div>
          <div className="gp-ticker-cell">
            <div className="gp-ticker-num green">{doneToday}</div>
            <div className="gp-ticker-label">تم إنجازها</div>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
