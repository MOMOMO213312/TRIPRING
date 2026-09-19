import { useCallback, useEffect, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { AirlinePortalShell } from "../components/airlinePortal/AirlinePortalShell";
import {
  fetchAirlineAgreements,
  fetchAirlineAgreementItems,
  fetchAirlineOverview,
  reviewGroundAgreement,
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
 *  The ground supplier proposes/manages the terms; the airline reviews and
 *  approves (or rejects) each agreement here. Ground services are only routed
 *  to a handler under an approved agreement. */
export function AirlinePortalAgreementsPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AirlineOverviewRow | null>(null);
  const [agreements, setAgreements] = useState<AirlineAgreementRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, AirlineAgreementItemRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function review(agreementId: string, approve: boolean) {
    if (!approve && !(notes[agreementId] ?? "").trim()) {
      setError("اكتب سبب الرفض في خانة الملاحظة قبل ما ترفض الاتفاقية");
      return;
    }
    const msg = approve
      ? "اعتماد الاتفاقية ده هيخلي خدمات المزوّد الأرضي تتوجّه لركّاب رحلاتك في المطار ده. متأكد؟"
      : "رفض الاتفاقية هيوقّف توجيه الخدمات لهذا المزوّد. متأكد؟";
    if (!window.confirm(msg)) return;
    setBusyId(agreementId);
    setError(null);
    try {
      await reviewGroundAgreement(agreementId, approve, (notes[agreementId] ?? "").trim() || null);
      await load();
    } catch (e: any) {
      // 23505 = airline already has an active ground handler at this airport
      setError(e?.code === "23505" && e?.message ? e.message : "تعذر تسجيل قرارك على الاتفاقية");
    } finally {
      setBusyId(null);
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
                <th>اعتماد شركة الطيران</th>
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
                    <td>
                      {a.airline_approved ? (
                        <span className="ap-pill active">معتمدة</span>
                      ) : a.airline_review_note ? (
                        <span className="ap-pill failed">مرفوضة</span>
                      ) : (
                        <span className="ap-pill in_progress">بانتظار اعتمادك</span>
                      )}
                    </td>
                    <td>{a.sla_hours != null ? `${a.sla_hours} ساعة` : "—"}</td>
                    <td>{formatDate(a.starts_at)}</td>
                    <td>{a.item_count}</td>
                  </tr>
                  {expanded === a.agreement_id && (
                    <tr key={`${a.agreement_id}-detail`}>
                      <td colSpan={8} style={{ background: "var(--ap-panel-raised)", padding: 12 }}>
                        {a.sla_notes && (
                          <div style={{ fontSize: 12.5, color: "var(--ap-mist)", marginBottom: 10 }}>{a.sla_notes}</div>
                        )}
                        <div className="ap-review-box">
                          {a.airline_approved && a.airline_approved_at && (
                            <div className="ap-review-line">اعتُمدت بتاريخ {formatDate(a.airline_approved_at)}</div>
                          )}
                          {a.airline_review_note && (
                            <div className="ap-review-line">ملاحظتك: {a.airline_review_note}</div>
                          )}
                          <input
                            className="ap-input"
                            placeholder="ملاحظة على الاتفاقية (اختياري)"
                            value={notes[a.agreement_id] ?? ""}
                            onChange={(e) => setNotes((prev) => ({ ...prev, [a.agreement_id]: e.target.value }))}
                          />
                          <div className="ap-review-actions">
                            {!a.airline_approved && (
                              <button
                                className="ap-btn primary"
                                disabled={busyId === a.agreement_id}
                                onClick={() => review(a.agreement_id, true)}
                              >
                                اعتماد الاتفاقية
                              </button>
                            )}
                            {(a.airline_approved || !a.airline_review_note) && (
                              <button
                                className="ap-btn danger"
                                disabled={busyId === a.agreement_id}
                                onClick={() => review(a.agreement_id, false)}
                              >
                                {a.airline_approved ? "سحب الاعتماد" : "رفض"}
                              </button>
                            )}
                          </div>
                        </div>
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
