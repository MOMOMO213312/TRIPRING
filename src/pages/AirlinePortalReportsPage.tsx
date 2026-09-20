import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AirlinePortalShell } from "../components/airlinePortal/AirlinePortalShell";
import {
  buildAirlinePerformanceReport,
  fetchAirlineBookings,
  fetchAirlineOverview,
  type AirlineOverviewRow,
  type AirlinePerformanceReport,
} from "../lib/airlinePortal";
import "../styles/airline-portal.css";
import { getLocale } from "../i18n/format";

const MONTH_LABEL: Record<string, string> = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل", "05": "مايو", "06": "يونيو",
  "07": "يوليو", "08": "أغسطس", "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
};

function formatMonth(m: string) {
  const [y, mm] = m.split("-");
  return `${MONTH_LABEL[mm] ?? mm} ${y}`;
}

function money(n: number, currency: string | null) {
  return `${n.toLocaleString(getLocale(), { maximumFractionDigits: 0 })} ${currency ?? ""}`.trim();
}

/** "التقارير" tab — Reports section of the design doc. Aggregates the same
 *  data get_my_airline_bookings() already returns (route, price, currency,
 *  status, created_at) into KPI cards + revenue-by-route + a monthly
 *  trend — no new RPC needed for the volumes a single airline sees here. */
export function AirlinePortalReportsPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AirlineOverviewRow | null>(null);
  const [report, setReport] = useState<AirlinePerformanceReport | null>(null);
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
      setReport(buildAirlinePerformanceReport(bookings));
    } catch (e: any) {
      if (e?.message?.includes("JWT") || e?.code === "PGRST301") {
        navigate("/airline-portal/login");
        return;
      }
      setError("تعذر تحميل التقرير");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const maxRouteRevenue = report?.byRoute[0]?.revenue ?? 0;
  const maxMonthRevenue = report ? Math.max(0, ...report.byMonth.map((m) => m.revenue)) : 0;

  return (
    <AirlinePortalShell overview={overview} active="reports">
      {error && <div className="ap-empty" style={{ color: "var(--ap-red)" }}>{error}</div>}
      {loading ? (
        <div className="ap-empty">جاري التحميل...</div>
      ) : !report || report.totalBookings === 0 ? (
        <div className="ap-panel"><div className="ap-empty">لا توجد بيانات حجوزات كافية بعد لبناء تقرير</div></div>
      ) : (
        <>
          <div className="ap-cards">
            <div className="ap-card">
              <div className="ap-card-label">إجمالي الحجوزات</div>
              <div className="ap-card-value">{report.totalBookings}</div>
            </div>
            <div className="ap-card">
              <div className="ap-card-label">إجمالي الإيرادات</div>
              <div className="ap-card-value">{money(report.totalRevenue, report.currency)}</div>
            </div>
            <div className="ap-card">
              <div className="ap-card-label">متوسط قيمة الحجز</div>
              <div className="ap-card-value">{money(report.avgBookingValue, report.currency)}</div>
            </div>
            <div className="ap-card">
              <div className="ap-card-label">نسبة الإلغاء</div>
              <div className={`ap-card-value ${report.cancellationRate > 0.1 ? "red" : "green"}`}>
                {(report.cancellationRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="ap-panel">
            <div className="ap-panel-title">الأداء حسب المسار</div>
            <table className="ap-table">
              <thead>
                <tr>
                  <th>المسار</th>
                  <th>عدد الحجوزات</th>
                  <th>متوسط السعر</th>
                  <th>الإيرادات</th>
                </tr>
              </thead>
              <tbody>
                {report.byRoute.map((r) => (
                  <tr key={r.route}>
                    <td>{r.route}</td>
                    <td>{r.bookings}</td>
                    <td>{money(r.avgPrice, report.currency)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="ap-bar-track" style={{ flex: 1 }}>
                          <div
                            className="ap-bar-fill"
                            style={{ width: `${maxRouteRevenue > 0 ? (r.revenue / maxRouteRevenue) * 100 : 0}%` }}
                          />
                        </div>
                        <span>{money(r.revenue, report.currency)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ap-panel">
            <div className="ap-panel-title">الاتجاه الشهري</div>
            <table className="ap-table">
              <thead>
                <tr>
                  <th>الشهر</th>
                  <th>عدد الحجوزات</th>
                  <th>الإيرادات</th>
                </tr>
              </thead>
              <tbody>
                {report.byMonth.map((m) => (
                  <tr key={m.month}>
                    <td>{formatMonth(m.month)}</td>
                    <td>{m.bookings}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="ap-bar-track" style={{ flex: 1 }}>
                          <div
                            className="ap-bar-fill"
                            style={{ width: `${maxMonthRevenue > 0 ? (m.revenue / maxMonthRevenue) * 100 : 0}%` }}
                          />
                        </div>
                        <span>{money(m.revenue, report.currency)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AirlinePortalShell>
  );
}
