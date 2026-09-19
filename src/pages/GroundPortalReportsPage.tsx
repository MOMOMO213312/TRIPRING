import { useEffect, useState } from "react";
import { GroundPortalShell } from "../components/groundPortal/GroundPortalShell";
import { fetchSupplierReport, fetchGroundQueue, type SupplierReportRow, type GroundQueueRow } from "../lib/groundPortal";
import "../styles/ground-portal.css";

function formatInterval(iv: string | null): string {
  if (!iv) return "—";
  // Postgres interval text like "00:23:11" or "1 day 02:11:00"
  const match = iv.match(/(\d+):(\d+):(\d+)/);
  if (!match) return iv;
  const [, h, m] = match;
  return `${parseInt(h, 10)} س ${parseInt(m, 10)} د`;
}

export function GroundPortalReportsPage() {
  const [report, setReport] = useState<SupplierReportRow | null>(null);
  const [queue, setQueue] = useState<GroundQueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchSupplierReport(), fetchGroundQueue()])
      .then(([r, q]) => {
        setReport(r);
        setQueue(q);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <GroundPortalShell active="reports" queue={queue}>
      <div className="gp-section-label">أداء المورد</div>

      {loading ? (
        <div className="gp-empty">جارِ التحميل...</div>
      ) : !report ? (
        <div className="gp-empty">لا توجد بيانات كافية بعد</div>
      ) : (
        <div className="gp-cards">
          <div className="gp-card">
            <div className="gp-card-label">مكتملة</div>
            <div className="gp-card-value" style={{ color: "#0e9f6e" }}>
              {report.completed_count}
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-card-label">فشلت / لم يحضر الراكب</div>
            <div className="gp-card-value" style={{ color: "#dc3a36" }}>
              {report.failed_count + report.no_show_count}
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-card-label">قيد التنفيذ حاليًا</div>
            <div className="gp-card-value" style={{ color: "#5b4bdb" }}>
              {report.open_count}
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-card-label">تجاوزات SLA</div>
            <div
              className="gp-card-value"
              style={{ color: report.sla_breaches > 0 ? "#dc3a36" : undefined }}
            >
              {report.sla_breaches}
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-card-label">متوسط وقت التنفيذ</div>
            <div className="gp-card-value">{formatInterval(report.avg_handling_time)}</div>
          </div>
        </div>
      )}
    </GroundPortalShell>
  );
}
