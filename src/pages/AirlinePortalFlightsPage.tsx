import { useCallback, useEffect, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { AirlinePortalShell } from "../components/airlinePortal/AirlinePortalShell";
import {
  fetchAirlineFlights,
  fetchAirlineFlightOfferDetail,
  fetchAirlineOverview,
  type AirlineFlightRow,
  type AirlineFlightOfferDetailRow,
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, AirlineFlightOfferDetailRow | null>>({});

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

  async function toggle(dealId: string) {
    if (expanded === dealId) {
      setExpanded(null);
      return;
    }
    setExpanded(dealId);
    if (!(dealId in details)) {
      try {
        const detail = await fetchAirlineFlightOfferDetail(dealId);
        setDetails((prev) => ({ ...prev, [dealId]: detail }));
      } catch {
        setDetails((prev) => ({ ...prev, [dealId]: null }));
      }
    }
  }

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
                <th></th>
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
              {rows.map((f) => {
                const detail = details[f.deal_id];
                return (
                  <Fragment key={f.deal_id}>
                    <tr onClick={() => toggle(f.deal_id)} style={{ cursor: "pointer" }}>
                      <td style={{ color: "var(--ap-cyan)" }}>{expanded === f.deal_id ? "▾" : "◂"}</td>
                      <td>{f.flight_number ?? "—"}</td>
                      <td>{f.from_airport} → {f.to_airport}</td>
                      <td>{formatDate(f.departure_date)}</td>
                      <td>{f.travel_class ?? "—"}</td>
                      <td>{f.available_seats}</td>
                      <td>{f.price} {f.currency}</td>
                      <td>{f.booking_count}</td>
                      <td><span className={`ap-pill ${f.status}`}>{f.status}</span></td>
                    </tr>
                    {expanded === f.deal_id && (
                      <tr>
                        <td colSpan={9} style={{ background: "var(--ap-panel-raised)", padding: 14 }}>
                          {!(f.deal_id in details) ? (
                            <div className="ap-empty">جاري تحميل تفاصيل الفير...</div>
                          ) : detail == null ? (
                            <div className="ap-empty">تعذر تحميل تفاصيل هذه الرحلة</div>
                          ) : (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, 1fr)",
                                gap: "10px 20px",
                                fontSize: 12.5,
                              }}
                            >
                              <div><span style={{ color: "var(--ap-mist)" }}>عائلة الفير: </span>{detail.fare_family ?? "—"}</div>
                              <div><span style={{ color: "var(--ap-mist)" }}>السعر الأساسي: </span>{detail.base_fare ?? "—"} {detail.currency}</div>
                              <div><span style={{ color: "var(--ap-mist)" }}>الضرائب والرسوم: </span>{detail.taxes_fees ?? "—"} {detail.currency}</div>
                              <div><span style={{ color: "var(--ap-mist)" }}>سعر الطفل: </span>{detail.child_price ?? "—"}</div>
                              <div><span style={{ color: "var(--ap-mist)" }}>سعر الرضيع: </span>{detail.infant_price ?? "—"}</div>
                              <div><span style={{ color: "var(--ap-mist)" }}>قابلة للاسترداد: </span>{detail.refundable == null ? "—" : detail.refundable ? "نعم" : "لا"}</div>
                              <div><span style={{ color: "var(--ap-mist)" }}>قابلة للتغيير: </span>{detail.changeable == null ? "—" : detail.changeable ? "نعم" : "لا"}</div>
                              <div><span style={{ color: "var(--ap-mist)" }}>رسوم التغيير: </span>{detail.change_fee ?? "—"}</div>
                              <div><span style={{ color: "var(--ap-mist)" }}>رسوم الإلغاء: </span>{detail.cancellation_fee ?? "—"}</div>
                              <div><span style={{ color: "var(--ap-mist)" }}>الأمتعة المسجلة: </span>{detail.baggage_kg != null ? `${detail.baggage_kg} كجم` : "—"}</div>
                              <div><span style={{ color: "var(--ap-mist)" }}>أمتعة الكابينة: </span>{detail.cabin_baggage_kg != null ? `${detail.cabin_baggage_kg} كجم` : "—"}</div>
                              <div><span style={{ color: "var(--ap-mist)" }}>عدد الحقائب: </span>{detail.checked_bags_count ?? "—"}</div>
                              <div><span style={{ color: "var(--ap-mist)" }}>سعر الوزن الإضافي: </span>{detail.extra_baggage_price ?? "—"}</div>
                              <div><span style={{ color: "var(--ap-mist)" }}>أقل فئة عضوية مطلوبة: </span>{detail.min_membership_tier ?? "—"}</div>
                              <div><span style={{ color: "var(--ap-mist)" }}>آخر تحقق من السعر: </span>{detail.price_checked_at ? formatDate(detail.price_checked_at) : "—"}</div>
                              {detail.fare_rules && (
                                <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
                                  <span style={{ color: "var(--ap-mist)" }}>قواعد الفير: </span>{detail.fare_rules}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AirlinePortalShell>
  );
}
