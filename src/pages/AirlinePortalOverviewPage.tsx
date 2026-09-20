import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AirlinePortalShell } from "../components/airlinePortal/AirlinePortalShell";
import {
  fetchAirlineOverview,
  fetchAirlineFlights,
  fetchAirlineGroundRequests,
  type AirlineOverviewRow,
  type AirlineFlightRow,
  type AirlineGroundRequestRow,
} from "../lib/airlinePortal";
import "../styles/airline-portal.css";
import { getLocale } from "../i18n/format";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(getLocale(), { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Landing page of the Airline Control Center — mirrors the doc's
 *  "Overview" section: upcoming flights, bookings snapshot, open ground
 *  requests. Deeper tabs (Flights/Bookings/Ground/Agreements) are their
 *  own pages, following the Ground Portal's file-per-tab convention. */
export function AirlinePortalOverviewPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AirlineOverviewRow | null>(null);
  const [upcoming, setUpcoming] = useState<AirlineFlightRow[]>([]);
  const [groundOpen, setGroundOpen] = useState<AirlineGroundRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [overviewRows, flights, ground] = await Promise.all([
        fetchAirlineOverview(),
        fetchAirlineFlights("active"),
        fetchAirlineGroundRequests(null),
      ]);
      if (overviewRows.length === 0) {
        navigate("/airline-portal/login");
        return;
      }
      setOverview(overviewRows[0]);
      setUpcoming(
        flights
          .filter((f) => f.departure_date >= new Date().toISOString().slice(0, 10))
          .slice(0, 8),
      );
      setGroundOpen(
        ground.filter((g) => g.execution_status === "not_started" || g.execution_status === "accepted" || g.execution_status === "in_progress"),
      );
    } catch (e: any) {
      if (e?.message?.includes("JWT") || e?.code === "PGRST301") {
        navigate("/airline-portal/login");
        return;
      }
      setError("تعذر تحميل نظرة عامة");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AirlinePortalShell overview={overview} active="overview">
      {loading ? (
        <div className="ap-empty">جاري التحميل...</div>
      ) : error ? (
        <div className="ap-empty">{error}</div>
      ) : (
        <>
          <div className="ap-panel">
            <div className="ap-panel-title">أقرب المغادرات</div>
            {upcoming.length === 0 ? (
              <div className="ap-empty">لا توجد رحلات قادمة</div>
            ) : (
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>رقم الرحلة</th>
                    <th>المسار</th>
                    <th>التاريخ</th>
                    <th>المقاعد المتاحة</th>
                    <th>السعر</th>
                    <th>عدد الحجوزات</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((f) => (
                    <tr key={f.deal_id}>
                      <td>{f.flight_number ?? "—"}</td>
                      <td>{f.from_airport} → {f.to_airport}</td>
                      <td>{formatDate(f.departure_date)}</td>
                      <td>{f.available_seats}</td>
                      <td>{f.price} {f.currency}</td>
                      <td>{f.booking_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="ap-panel">
            <div className="ap-panel-title">طلبات خدمة أرضية مفتوحة</div>
            {groundOpen.length === 0 ? (
              <div className="ap-empty">لا توجد طلبات مفتوحة حاليًا</div>
            ) : (
              <table className="ap-table">
                <thead>
                  <tr>
                    <th>الرحلة</th>
                    <th>الخدمة</th>
                    <th>مزوّد الخدمة الأرضية</th>
                    <th>الحالة</th>
                    <th>الراكب</th>
                  </tr>
                </thead>
                <tbody>
                  {groundOpen.map((g) => (
                    <tr key={g.order_item_id}>
                      <td>{g.flight_number ?? "—"} ({formatDate(g.departure_date)})</td>
                      <td>{g.service_name}</td>
                      <td>{g.ground_supplier_name ?? "لم يُسند بعد"}</td>
                      <td><span className={`ap-pill ${g.execution_status}`}>{g.execution_status}</span></td>
                      <td>{g.customer_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </AirlinePortalShell>
  );
}
