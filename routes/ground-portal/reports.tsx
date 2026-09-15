import { useEffect, useState } from 'react';
import GroundPortalShell from './GroundPortalShell';
import { fetchSupplierReport, fetchGroundQueue, type SupplierReportRow } from '../../lib/groundPortal';
import '../../styles/ground-portal.css';

function formatInterval(iv: string | null): string {
  if (!iv) return '—';
  // Postgres interval text like "00:23:11" or "1 day 02:11:00"
  const match = iv.match(/(\d+):(\d+):(\d+)/);
  if (!match) return iv;
  const [, h, m] = match;
  return `${parseInt(h, 10)} س ${parseInt(m, 10)} د`;
}

export default function GroundPortalReports() {
  const [report, setReport] = useState<SupplierReportRow | null>(null);
  const [queue, setQueue] = useState<any[]>([]);
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
            <div className="gp-card-value" style={{ color: '#3fae7a' }}>
              {report.completed_count}
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-card-label">فشلت / لم يحضر الراكب</div>
            <div className="gp-card-value" style={{ color: '#e1524b' }}>
              {report.failed_count + report.no_show_count}
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-card-label">قيد التنفيذ حاليًا</div>
            <div className="gp-card-value" style={{ color: '#c9a227' }}>
              {report.open_count}
            </div>
          </div>
          <div className="gp-card">
            <div className="gp-card-label">تجاوزات SLA</div>
            <div className="gp-card-value" style={{ color: report.sla_breaches > 0 ? '#e1524b' : '#ede7d9' }}>
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
