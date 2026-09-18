import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AirlinePortalShell } from "../components/airlinePortal/AirlinePortalShell";
import {
  fetchAirlineFlights,
  fetchAirlineOverview,
  type AirlineFlightRow,
  type AirlineOverviewRow,
} from "../lib/airlinePortal";
import "../styles/airline-portal.css";

type StatusFilter = "active" | "expired" | null;

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "نشطة" },
  { value: "expired", label: "منتهية" },
  { value: null, label: "الكل" },
];

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "الرحلات" tab — mirrors the design doc's Flight Operations section
 *  (schedule/status/availability). Routes & Airports sub-sections are not
 *  built yet — this page covers Flights/Schedule/Status/Availability only. */
export function AirlinePortalFlightsPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AirlineOverviewRow | null>(null);
  const [rows, setRows] = useState<AirlineFlightRow[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (statusFilter: StatusFilter) => {
    setLoading(true);
    try {
      const [overviewRows, flights] = await Promise.all([
        fetchAirlineOverview(),
        fetchAirlineFlights(statusFilter),
      ]);
      if (overviewRows.length === 0) {
        navigate("/airline-portal/login");
        return;
      }
      setOverview(overviewRows[0]);
      setRows(flights);
    } catch (e: any) {
      if (e?.message?.includes("JWT") || e?.code === "PGRST301") {
        navigate("/airline-portal/login");
        return;
      }
      setError("تعذر تحميل الرحلات");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  return (
    <AirlinePortalShell overview={overview} active="flights">
      <div className="ap-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="ap-panel-title" style={{ marginBottom: 0 }}>الرحلات</div>
          <div style={{ display: "flex", gap: 8 }}>
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
          <div className="ap-empty">لا توجد رحلات تطابق هذا الفلتر</div>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th>رقم الرحلة</th>
                <th>المسار</th>
                <th>تاريخ المغادرة</th>
                <th>الفئة</th>
                <th>المقاعد المتاحة</th>
                <th>السعر</th>
                <th>الحجوزات</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.deal_id}>
                  <td>{f.flight_number ?? "—"}</td>
                  <td>{f.from_airport} → {f.to_airport}</td>
                  <td>{formatDate(f.departure_date)}</td>
                  <td>{f.travel_class ?? "—"}</td>
                  <td>{f.available_seats}</td>
                  <td>{f.price} {f.currency}</td>
                  <td>{f.booking_count}</td>
                  <td><span className={`ap-pill ${f.status}`}>{f.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AirlinePortalShell>
  );
}
