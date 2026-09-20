import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AirlinePortalShell } from "../components/airlinePortal/AirlinePortalShell";
import {
  fetchAirlineOverview,
  fetchAirlineSettlements,
  type AirlineOverviewRow,
  type AirlineSettlementRow,
} from "../lib/airlinePortal";
import "../styles/airline-portal.css";
import { getLocale } from "../i18n/format";

const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة",
  pending: "قيد المراجعة",
  paid: "مدفوعة",
  disputed: "محل نزاع",
  cancelled: "ملغاة",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(getLocale(), { day: "2-digit", month: "2-digit", year: "numeric" });
}

function money(n: number, currency: string) {
  return `${n.toLocaleString(getLocale(), { minimumFractionDigits: 2 })} ${currency}`;
}

/** "كشوف الحساب" tab — Commercial/Settlement section of the design doc.
 *  Reads the same `supplier_settlements` table as Ground Portal; RLS is
 *  generic per supplier_users row so this needed no new backend work, just
 *  a front-end view scoped to the airline theme/shell. */
export function AirlinePortalSettlementsPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AirlineOverviewRow | null>(null);
  const [rows, setRows] = useState<AirlineSettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [overviewRows, settlements] = await Promise.all([
        fetchAirlineOverview(),
        fetchAirlineSettlements(),
      ]);
      if (overviewRows.length === 0) {
        navigate("/airline-portal/login");
        return;
      }
      setOverview(overviewRows[0]);
      setRows(settlements);
    } catch (e: any) {
      if (e?.message?.includes("JWT") || e?.code === "PGRST301") {
        navigate("/airline-portal/login");
        return;
      }
      setError("تعذر تحميل كشوف الحساب");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AirlinePortalShell overview={overview} active="settlements">
      <div className="ap-panel">
        <div className="ap-panel-title">كشوف الحساب</div>
        {error && <div className="ap-empty" style={{ color: "var(--ap-red)" }}>{error}</div>}
        {loading ? (
          <div className="ap-empty">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="ap-empty">لا توجد كشوف حساب بعد</div>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th>الفترة</th>
                <th>عدد العناصر</th>
                <th>إجمالي قيمة العملاء</th>
                <th>المستحق للشركة</th>
                <th>المدفوع</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.period_start)} — {formatDate(r.period_end)}</td>
                  <td>{r.items_count}</td>
                  <td>{money(r.gross_customer_amount, r.currency)}</td>
                  <td>{money(r.amount_due_supplier, r.currency)}</td>
                  <td>{money(r.amount_paid, r.currency)}</td>
                  <td><span className={`ap-pill ${r.status}`}>{STATUS_LABEL[r.status] ?? r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AirlinePortalShell>
  );
}
