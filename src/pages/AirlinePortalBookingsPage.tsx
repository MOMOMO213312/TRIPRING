import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AirlinePortalShell } from "../components/airlinePortal/AirlinePortalShell";
import {
  fetchAirlineBookings,
  fetchAirlineOverview,
  type AirlineBookingRow,
  type AirlineOverviewRow,
} from "../lib/airlinePortal";
import "../styles/airline-portal.css";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "الحجوزات" tab. Covers what get_my_airline_bookings actually returns
 *  today — booking number, route, customer, channel, status, totals.
 *  PNR / Ticket Status / Changes-Cancellation as distinct sub-views are not
 *  in the RPC yet (status covers new/ticket_issued/etc. only) — noted as a
 *  gap, not silently implied here. */
export function AirlinePortalBookingsPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AirlineOverviewRow | null>(null);
  const [rows, setRows] = useState<AirlineBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [overviewRows, bookings] = await Promise.all([
        fetchAirlineOverview(),
        fetchAirlineBookings(null),
      ]);
      if (overviewRows.length === 0) {
        navigate("/airline-portal/login");
        return;
      }
      setOverview(overviewRows[0]);
      setRows(bookings);
    } catch (e: any) {
      if (e?.message?.includes("JWT") || e?.code === "PGRST301") {
        navigate("/airline-portal/login");
        return;
      }
      setError("تعذر تحميل الحجوزات");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AirlinePortalShell overview={overview} active="bookings">
      <div className="ap-panel">
        <div className="ap-panel-title">كل الحجوزات</div>
        {error && <div className="ap-empty" style={{ color: "var(--ap-red)" }}>{error}</div>}
        {loading ? (
          <div className="ap-empty">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="ap-empty">لا توجد حجوزات على رحلاتك حتى الآن</div>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th>رقم الحجز</th>
                <th>الرحلة</th>
                <th>المسار</th>
                <th>تاريخ المغادرة</th>
                <th>العميل</th>
                <th>عدد المسافرين</th>
                <th>القناة</th>
                <th>الإجمالي</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.booking_id}>
                  <td>#{b.booking_number}</td>
                  <td>{b.flight_number ?? "—"}</td>
                  <td>{b.from_airport} → {b.to_airport}</td>
                  <td>{formatDate(b.departure_date)}</td>
                  <td>{b.customer_name}<br /><span style={{ color: "var(--ap-mist)", fontSize: 11 }}>{b.customer_phone}</span></td>
                  <td>{b.travelers_count}</td>
                  <td>{b.channel}</td>
                  <td>{b.total_price != null ? `${b.total_price} ${b.currency ?? ""}` : "—"}</td>
                  <td><span className={`ap-pill ${b.status}`}>{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AirlinePortalShell>
  );
}
