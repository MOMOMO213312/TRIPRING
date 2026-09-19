import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AirlinePortalShell } from "../components/airlinePortal/AirlinePortalShell";
import {
  fetchAirlineGroundRequests,
  fetchAirlineOverview,
  type AirlineGroundRequestRow,
  type AirlineOverviewRow,
  type GroundRequestExecutionStatus,
} from "../lib/airlinePortal";
import "../styles/airline-portal.css";

const FILTERS: { value: GroundRequestExecutionStatus | null; label: string }[] = [
  { value: null, label: "الكل" },
  { value: "not_started", label: "لم تبدأ" },
  { value: "accepted", label: "تم القبول" },
  { value: "in_progress", label: "جاري التنفيذ" },
  { value: "completed", label: "مكتملة" },
  { value: "failed", label: "فشلت" },
  { value: "no_show", label: "لم يحضر" },
];

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "الخدمات الأرضية" tab — طلبات الخدمات الأرضية المرتبطة برحلات الشركة.
 *  SLA/Incidents from the design doc aren't tracked as separate data yet
 *  (only fulfillment_status/execution_status + timestamps exist) — this
 *  page shows what's real, not an invented SLA column. */
export function AirlinePortalGroundPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AirlineOverviewRow | null>(null);
  const [rows, setRows] = useState<AirlineGroundRequestRow[]>([]);
  const [filter, setFilter] = useState<GroundRequestExecutionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (executionFilter: GroundRequestExecutionStatus | null) => {
    setLoading(true);
    try {
      const [overviewRows, requests] = await Promise.all([
        fetchAirlineOverview(),
        fetchAirlineGroundRequests(executionFilter),
      ]);
      if (overviewRows.length === 0) {
        navigate("/airline-portal/login");
        return;
      }
      setOverview(overviewRows[0]);
      setRows(requests);
    } catch (e: any) {
      if (e?.message?.includes("JWT") || e?.code === "PGRST301") {
        navigate("/airline-portal/login");
        return;
      }
      setError("تعذر تحميل طلبات الخدمة الأرضية");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  return (
    <AirlinePortalShell overview={overview} active="ground">
      <div className="ap-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div className="ap-panel-title" style={{ marginBottom: 0 }}>طلبات الخدمة الأرضية</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setFilter(f.value)}
                style={{
                  background: filter === f.value ? "var(--ap-cyan-soft)" : "transparent",
                  border: "1px solid var(--ap-hairline)",
                  color: filter === f.value ? "var(--ap-paper)" : "var(--ap-mist)",
                  borderRadius: 8,
                  padding: "5px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="ap-empty" style={{ color: "var(--ap-red)" }}>{error}</div>}
        {loading ? (
          <div className="ap-empty">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="ap-empty">لا توجد طلبات خدمة أرضية تطابق هذا الفلتر</div>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th>الرحلة</th>
                <th>المسار / التاريخ</th>
                <th>التذكرة / الراكب</th>
                <th>الخدمة</th>
                <th>تفاصيل التسليم</th>
                <th>الوكالة</th>
                <th>مزوّد الخدمة الأرضية</th>
                <th>حالة الحجز</th>
                <th>حالة التنفيذ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.order_item_id}>
                  <td>{g.flight_number ?? "—"}</td>
                  <td>{g.from_airport ?? "؟"} → {g.to_airport ?? "؟"}<br /><span style={{ color: "var(--ap-mist)", fontSize: 11 }}>{formatDate(g.departure_date)}</span></td>
                  <td>
                    {g.booking_number != null ? `#${g.booking_number}` : "—"}
                    <br />
                    <span style={{ color: "var(--ap-mist)", fontSize: 11 }}>
                      {g.passenger_names ?? g.customer_name}
                    </span>
                  </td>
                  <td>
                    {g.service_name}
                    {g.quantity > 1 && ` × ${g.quantity}`}
                    <br />
                    <span style={{ color: "var(--ap-mist)", fontSize: 11 }}>
                      {g.airport_leg === "departure" ? "مغادرة" : g.airport_leg === "arrival" ? "وصول" : "—"}
                    </span>
                  </td>
                  <td style={{ fontSize: 11.5 }}>
                    {g.delivery_location ?? "—"}
                    {g.delivery_method && <><br /><span style={{ color: "var(--ap-mist)" }}>{g.delivery_method}</span></>}
                  </td>
                  <td>{g.agency_name ?? "—"}</td>
                  <td>
                    {g.ground_supplier_name ?? "لم يُسند بعد"}
                    {g.sla_hours != null && (
                      <><br /><span style={{ color: "var(--ap-mist)", fontSize: 11 }}>SLA: {g.sla_hours} ساعة</span></>
                    )}
                  </td>
                  <td><span className={`ap-pill ${g.fulfillment_status}`}>{g.fulfillment_status}</span></td>
                  <td><span className={`ap-pill ${g.execution_status}`}>{g.execution_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AirlinePortalShell>
  );
}
