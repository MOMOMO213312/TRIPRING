import { useCallback, useEffect, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { AirlinePortalShell } from "../components/airlinePortal/AirlinePortalShell";
import {
  fetchAirlineAgreements,
  fetchAirlineAgreementItems,
  fetchAirlineOverview,
  type AirlineAgreementRow,
  type AirlineAgreementItemRow,
  type AirlineOverviewRow,
} from "../lib/airlinePortal";
import "../styles/airline-portal.css";

const BILLING_LABEL: Record<string, string> = {
  per_pax: "لكل راكب",
  per_flight: "لكل رحلة",
  flat: "مبلغ ثابت",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** "العقود" tab — SGHA-style ground-handling agreements per airport.
 *  Read-only from the airline side: the ground supplier proposes/manages
 *  agreement terms (per RLS), the airline reviews them here — matches the
 *  real-world relationship, not a missing feature. */
export function AirlinePortalAgreementsPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AirlineOverviewRow | null>(null);
  const [agreements, setAgreements] = useState<AirlineAgreementRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, AirlineAgreementItemRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [overviewRows, agreementRows] = await Promise.all([
        fetchAirlineOverview(),
        fetchAirlineAgreements(),
      ]);
      if (overviewRows.length === 0) {
        navigate("/airline-portal/login");
        return;
      }
      setOverview(overviewRows[0]);
      setAgreements(agreementRows);
    } catch (e: any) {
      if (e?.message?.includes("JWT") || e?.code === "PGRST301") {
        navigate("/airline-portal/login");
        return;
      }
      setError("تعذر تحميل العقود");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(agreementId: string) {
    if (expanded === agreementId) {
      setExpanded(null);
      return;
    }
    setExpanded(agreementId);
    if (!items[agreementId]) {
      try {
        const rows = await fetchAirlineAgreementItems(agreementId);
        setItems((prev) => ({ ...prev, [agreementId]: rows }));
      } catch {
        setItems((prev) => ({ ...prev, [agreementId]: [] }));
      }
    }
  }

  return (
    <AirlinePortalShell overview={overview} active="agreements">
      <div className="ap-panel">
        <div className="ap-panel-title">اتفاقيات الخدمة الأرضية (SGHA)</div>
        {error && <div className="ap-empty" style={{ color: "var(--ap-red)" }}>{error}</div>}
        {loading ? (
          <div className="ap-empty">جاري التحميل...</div>
        ) : agreements.length === 0 ? (
          <div className="ap-empty">لا توجد اتفاقيات خدمة أرضية مسجّلة بعد</div>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th></th>
                <th>المطار</th>
                <th>مزوّد الخدمة الأرضية</th>
                <th>الحالة</th>
                <th>SLA</th>
                <th>بداية السريان</th>
                <th>عدد البنود</th>
              </tr>
            </thead>
            <tbody>
              {agreements.map((a) => (
                <Fragment key={a.agreement_id}>
                  <tr
                    key={a.agreement_id}
                    onClick={() => toggle(a.agreement_id)}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ color: "var(--ap-cyan)" }}>{expanded === a.agreement_id ? "▾" : "◂"}</td>
                    <td>{a.airport_code}</td>
                    <td>{a.ground_supplier_name}</td>
                    <td><span className={`ap-pill ${a.status}`}>{a.status}</span></td>
                    <td>{a.sla_hours != null ? `${a.sla_hours} ساعة` : "—"}</td>
                    <td>{formatDate(a.starts_at)}</td>
                    <td>{a.item_count}</td>
                  </tr>
                  {expanded === a.agreement_id && (
                    <tr key={`${a.agreement_id}-detail`}>
                      <td colSpan={7} style={{ background: "var(--ap-panel-raised)", padding: 12 }}>
                        {a.sla_notes && (
                          <div style={{ fontSize: 12.5, color: "var(--ap-mist)", marginBottom: 10 }}>{a.sla_notes}</div>
                        )}
                        {!items[a.agreement_id] ? (
                          <div className="ap-empty">جاري تحميل البنود...</div>
                        ) : items[a.agreement_id].length === 0 ? (
                          <div className="ap-empty">لا توجد بنود</div>
                        ) : (
                          <table className="ap-table">
                            <thead>
                              <tr>
                                <th>الخدمة</th>
                                <th>وحدة التسعير</th>
                                <th>السعر</th>
                                <th>مفعّلة</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items[a.agreement_id].map((it) => (
                                <tr key={it.item_id}>
                                  <td>{it.service_name}</td>
                                  <td>{BILLING_LABEL[it.billing_unit] ?? it.billing_unit}</td>
                                  <td>{it.cost_price} {a.currency}</td>
                                  <td>{it.is_active ? "نعم" : "لا"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AirlinePortalShell>
  );
}
