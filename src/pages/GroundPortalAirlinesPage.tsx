import { useEffect, useState } from "react";
import { GroundPortalShell } from "../components/groundPortal/GroundPortalShell";
import { fetchGroundQueue, type GroundQueueRow } from "../lib/groundPortal";
import "../styles/ground-portal.css";

type AirlineBreakdown = {
  airlineCode: string;
  totalTasks: number;
  pending: number;
  inProgress: number;
  completed: number;
  slaRisk: number;
  nextDeparture: string | null;
};

/**
 * Derived entirely from the existing get_my_ground_operations_queue() RPC —
 * GroundQueueRow already carries airline_code per task, so this is a
 * client-side groupby, no new table/view/RPC. Falls back to
 * operating_airline_code for codeshare legs where airline_code is empty.
 */
function buildBreakdown(rows: GroundQueueRow[]): AirlineBreakdown[] {
  const byAirline = new Map<string, AirlineBreakdown>();

  for (const row of rows) {
    const code = row.airline_code || row.operating_airline_code || "غير معروف";
    let entry = byAirline.get(code);
    if (!entry) {
      entry = {
        airlineCode: code,
        totalTasks: 0,
        pending: 0,
        inProgress: 0,
        completed: 0,
        slaRisk: 0,
        nextDeparture: null,
      };
      byAirline.set(code, entry);
    }
    entry.totalTasks += 1;
    if (row.execution_status === "not_started") entry.pending += 1;
    if (row.execution_status === "accepted" || row.execution_status === "in_progress") entry.inProgress += 1;
    if (row.execution_status === "completed") entry.completed += 1;
    if (row.sla_state === "amber" || row.sla_state === "red") entry.slaRisk += 1;
    if (
      row.scheduled_departure_at &&
      (!entry.nextDeparture || row.scheduled_departure_at < entry.nextDeparture)
    ) {
      entry.nextDeparture = row.scheduled_departure_at;
    }
  }

  return Array.from(byAirline.values()).sort((a, b) => b.totalTasks - a.totalTasks);
}

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ar-EG", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function GroundPortalAirlinesPage() {
  const [queue, setQueue] = useState<GroundQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGroundQueue()
      .then(setQueue)
      .catch(() => setError("تعذر تحميل البيانات"))
      .finally(() => setLoading(false));
  }, []);

  const breakdown = buildBreakdown(queue);

  return (
    <GroundPortalShell active="airlines" queue={queue}>
      <div className="gp-section-label">شركات الطيران المتعاقدة — حسب المهام الحالية والمفتوحة</div>

      {error && (
        <div className="gp-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="gp-board" style={{ padding: breakdown.length ? 0 : undefined }}>
        {loading ? (
          <div className="gp-empty">جارِ التحميل...</div>
        ) : breakdown.length === 0 ? (
          <div className="gp-empty">لا توجد مهام مرتبطة بأي شركة طيران بعد</div>
        ) : (
          <table className="gp-table">
            <thead>
              <tr>
                <th>شركة الطيران</th>
                <th>إجمالي المهام</th>
                <th>بانتظار البدء</th>
                <th>جاري التنفيذ</th>
                <th>مكتملة</th>
                <th>خطر SLA</th>
                <th>أقرب رحلة</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((a) => (
                <tr key={a.airlineCode}>
                  <td style={{ fontWeight: 700 }}>{a.airlineCode}</td>
                  <td>{a.totalTasks}</td>
                  <td>{a.pending}</td>
                  <td>{a.inProgress}</td>
                  <td>{a.completed}</td>
                  <td style={{ color: a.slaRisk > 0 ? "#dc3a36" : undefined }}>{a.slaRisk}</td>
                  <td>{formatTime(a.nextDeparture)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </GroundPortalShell>
  );
}
