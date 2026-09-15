import { useEffect, useState } from "react";
import { GroundPortalShell } from "../components/groundPortal/GroundPortalShell";
import { fetchSettlements, fetchGroundQueue, type SettlementRow, type GroundQueueRow } from "../lib/groundPortal";
import "../styles/ground-portal.css";

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة",
  pending: "قيد المراجعة",
  paid: "مدفوعة",
  disputed: "محل نزاع",
  cancelled: "ملغاة",
};

function money(n: number, currency: string) {
  return `${n.toLocaleString("ar-EG", { minimumFractionDigits: 2 })} ${currency}`;
}

export function GroundPortalSettlementsPage() {
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [queue, setQueue] = useState<GroundQueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchSettlements(), fetchGroundQueue()])
      .then(([s, q]) => {
        setRows(s);
        setQueue(q);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <GroundPortalShell active="settlements" queue={queue}>
      <div className="gp-section-label">كشوف الحساب</div>

      <div className="gp-board" style={{ padding: rows.length ? 0 : undefined }}>
        {loading ? (
          <div className="gp-empty">جارِ التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="gp-empty">لا توجد كشوف حساب بعد</div>
        ) : (
          <table className="gp-table">
            <thead>
              <tr>
                <th>الفترة</th>
                <th>عدد المهام</th>
                <th>المستحق</th>
                <th>المدفوع</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.period_start} — {r.period_end}
                  </td>
                  <td>{r.items_count}</td>
                  <td>{money(r.amount_due_supplier, r.currency)}</td>
                  <td>{money(r.amount_paid, r.currency)}</td>
                  <td>{STATUS_LABEL[r.status] ?? r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </GroundPortalShell>
  );
}
