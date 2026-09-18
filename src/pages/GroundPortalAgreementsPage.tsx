import { useCallback, useEffect, useState } from "react";
import { GroundPortalShell } from "../components/groundPortal/GroundPortalShell";
import {
  fetchGroundQueue,
  fetchMyAgreements,
  fetchActiveAirlineSuppliers,
  fetchAirportServiceCatalog,
  createAgreement,
  updateAgreementStatus,
  addAgreementItem,
  toggleAgreementItemActive,
  deleteAgreementItem,
  type GroundQueueRow,
  type AgreementRow,
  type AgreementStatus,
  type AirlineSupplierOption,
  type ServiceCatalogOption,
  type BillingUnit,
} from "../lib/groundPortal";
import { fetchAirports } from "../lib/api";
import type { AirportRow } from "../types/database";
import "../styles/ground-portal.css";

const STATUS_LABEL: Record<AgreementStatus, string> = {
  draft: "مسودة",
  active: "نشط",
  suspended: "موقوف",
  ended: "منتهي",
};

const BILLING_UNIT_LABEL: Record<BillingUnit, string> = {
  per_pax: "لكل راكب",
  per_flight: "لكل رحلة",
  flat: "سعر ثابت",
};

const NEXT_STATUS: Record<AgreementStatus, AgreementStatus[]> = {
  draft: ["active", "ended"],
  active: ["suspended", "ended"],
  suspended: ["active", "ended"],
  ended: [],
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface NewAgreementForm {
  airlineSupplierId: string;
  airportCode: string;
  slaHours: string;
  currency: string;
}

const EMPTY_NEW_AGREEMENT: NewAgreementForm = {
  airlineSupplierId: "",
  airportCode: "",
  slaHours: "",
  currency: "USD",
};

interface NewItemForm {
  serviceCatalogId: string;
  billingUnit: BillingUnit;
  costPrice: string;
}

const EMPTY_NEW_ITEM: NewItemForm = {
  serviceCatalogId: "",
  billingUnit: "per_pax",
  costPrice: "",
};

export function GroundPortalAgreementsPage() {
  const [queue, setQueue] = useState<GroundQueueRow[]>([]);
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [airlines, setAirlines] = useState<AirlineSupplierOption[]>([]);
  const [airports, setAirports] = useState<AirportRow[]>([]);
  const [catalog, setCatalog] = useState<ServiceCatalogOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showNewAgreement, setShowNewAgreement] = useState(false);
  const [newAgreement, setNewAgreement] = useState<NewAgreementForm>(EMPTY_NEW_AGREEMENT);
  const [savingAgreement, setSavingAgreement] = useState(false);

  const [itemForms, setItemForms] = useState<Record<string, NewItemForm>>({});
  const [savingItemFor, setSavingItemFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [q, a, airlineList, airportList, catalogList] = await Promise.all([
        fetchGroundQueue(),
        fetchMyAgreements(),
        fetchActiveAirlineSuppliers(),
        fetchAirports(),
        fetchAirportServiceCatalog(),
      ]);
      setQueue(q);
      setAgreements(a);
      setAirlines(airlineList);
      setAirports(airportList);
      setCatalog(catalogList);
    } catch {
      setError("تعذر تحميل بيانات العقود");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateAgreement() {
    if (!newAgreement.airlineSupplierId || !newAgreement.airportCode) {
      setError("لازم تختار شركة الطيران والمطار");
      return;
    }
    setSavingAgreement(true);
    setError(null);
    try {
      await createAgreement({
        airlineSupplierId: newAgreement.airlineSupplierId,
        airportCode: newAgreement.airportCode,
        slaHours: newAgreement.slaHours ? Number(newAgreement.slaHours) : null,
        currency: newAgreement.currency || "USD",
      });
      setShowNewAgreement(false);
      setNewAgreement(EMPTY_NEW_AGREEMENT);
      await load();
    } catch {
      setError("تعذر إنشاء العقد — تأكد إنه مفيش عقد بنفس الطيران والمطار قبل كده");
    } finally {
      setSavingAgreement(false);
    }
  }

  async function handleStatusChange(agreementId: string, status: AgreementStatus) {
    try {
      await updateAgreementStatus(agreementId, status);
      await load();
    } catch {
      setError("تعذر تغيير حالة العقد");
    }
  }

  function getItemForm(agreementId: string): NewItemForm {
    return itemForms[agreementId] ?? EMPTY_NEW_ITEM;
  }

  function setItemForm(agreementId: string, patch: Partial<NewItemForm>) {
    setItemForms((prev) => ({ ...prev, [agreementId]: { ...getItemForm(agreementId), ...patch } }));
  }

  async function handleAddItem(agreementId: string) {
    const form = getItemForm(agreementId);
    const price = Number(form.costPrice);
    if (!form.serviceCatalogId || !form.costPrice || Number.isNaN(price) || price < 0) {
      setError("لازم تختار نوع الخدمة وتدخل سعر صحيح");
      return;
    }
    setSavingItemFor(agreementId);
    setError(null);
    try {
      await addAgreementItem({
        agreementId,
        serviceCatalogId: form.serviceCatalogId,
        billingUnit: form.billingUnit,
        costPrice: price,
      });
      setItemForms((prev) => ({ ...prev, [agreementId]: EMPTY_NEW_ITEM }));
      await load();
    } catch {
      setError("تعذر إضافة تسعير الخدمة — ممكن تكون مضافة قبل كده لنفس العقد");
    } finally {
      setSavingItemFor(null);
    }
  }

  async function handleToggleItem(itemId: string, isActive: boolean) {
    try {
      await toggleAgreementItemActive(itemId, !isActive);
      await load();
    } catch {
      setError("تعذر تحديث حالة تسعير الخدمة");
    }
  }

  async function handleDeleteItem(itemId: string) {
    try {
      await deleteAgreementItem(itemId);
      await load();
    } catch {
      setError("تعذر حذف تسعير الخدمة");
    }
  }

  return (
    <GroundPortalShell active="agreements" queue={queue}>
      <div className="gp-section-label">
        العقود والتسعير مع شركات الطيران — عقد لكل (شركة طيران + مطار)، وتسعير مستقل لكل نوع خدمة جوّاه
      </div>

      {error && (
        <div className="gp-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div className="gp-toolbar">
        <button className="gp-btn primary" onClick={() => setShowNewAgreement(true)}>
          + عقد جديد
        </button>
      </div>

      {loading ? (
        <div className="gp-board">
          <div className="gp-empty">جارِ التحميل...</div>
        </div>
      ) : agreements.length === 0 ? (
        <div className="gp-board">
          <div className="gp-empty">لسه مفيش عقود مع أي شركة طيران — ابدأ بعقد جديد</div>
        </div>
      ) : (
        <div className="gp-agreement-list">
          {agreements.map((a) => {
            const itemForm = getItemForm(a.id);
            const pricedCatalogIds = new Set((a.items ?? []).map((i) => i.service_catalog_id));
            const availableCatalog = catalog.filter((c) => !pricedCatalogIds.has(c.id));

            return (
              <div className="gp-agreement-card" key={a.id}>
                <div className="gp-agreement-head">
                  <div>
                    <div className="gp-agreement-title">
                      {a.airline?.name ?? "شركة طيران"}
                      {a.airline?.linked_airline_code ? ` (${a.airline.linked_airline_code})` : ""}
                      {" — "}
                      {a.airport_code}
                    </div>
                    <div className="gp-agreement-sub">
                      SLA: {a.sla_hours ?? "—"} ساعة · {a.currency} · أُنشئ {formatDate(a.created_at)}
                      {!a.airline?.linked_airline_code && (
                        <span style={{ color: "var(--gp-amber)" }}>
                          {" "}
                          — تنبيه: الطيران دي لسه مش مربوطة بكود IATA، فالعقد مش هيتفعّل تلقائيًا في الحجز
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className={`gp-pill-status ${a.status}`}>{STATUS_LABEL[a.status]}</span>
                    {NEXT_STATUS[a.status].map((s) => (
                      <button
                        key={s}
                        className={`gp-btn small ${s === "ended" ? "danger" : ""}`}
                        onClick={() => handleStatusChange(a.id, s)}
                      >
                        {s === "active" ? "تفعيل" : s === "suspended" ? "إيقاف مؤقت" : "إنهاء"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="gp-agreement-body">
                  {(a.items ?? []).length === 0 ? (
                    <div style={{ color: "var(--gp-mist)", fontSize: 13, marginBottom: 8 }}>
                      لسه مفيش أي خدمة مسعّرة جوه العقد ده
                    </div>
                  ) : (
                    (a.items ?? []).map((item) => (
                      <div className="gp-item-row" key={item.id}>
                        <span className="gp-item-name">
                          {item.service_catalog?.generic_name ?? item.service_catalog_id}
                        </span>
                        <span className="gp-item-unit">{BILLING_UNIT_LABEL[item.billing_unit]}</span>
                        <span className="gp-item-price">
                          {item.cost_price} {a.currency}
                        </span>
                        <button
                          className="gp-btn small ghost"
                          onClick={() => handleToggleItem(item.id, item.is_active)}
                        >
                          {item.is_active ? "إيقاف" : "تفعيل"}
                        </button>
                        <button className="gp-btn small danger" onClick={() => handleDeleteItem(item.id)}>
                          حذف
                        </button>
                      </div>
                    ))
                  )}

                  {availableCatalog.length > 0 && (
                    <div className="gp-add-item-form">
                      <div className="gp-field">
                        <label>إضافة تسعير خدمة</label>
                        <select
                          value={itemForm.serviceCatalogId}
                          onChange={(e) => setItemForm(a.id, { serviceCatalogId: e.target.value })}
                        >
                          <option value="">اختر نوع الخدمة</option>
                          {availableCatalog.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.generic_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="gp-field">
                        <label>وحدة الفوترة</label>
                        <select
                          value={itemForm.billingUnit}
                          onChange={(e) =>
                            setItemForm(a.id, { billingUnit: e.target.value as BillingUnit })
                          }
                        >
                          {Object.entries(BILLING_UNIT_LABEL).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="gp-field">
                        <label>السعر ({a.currency})</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={itemForm.costPrice}
                          onChange={(e) => setItemForm(a.id, { costPrice: e.target.value })}
                        />
                      </div>
                      <button
                        className="gp-btn"
                        disabled={savingItemFor === a.id}
                        onClick={() => handleAddItem(a.id)}
                      >
                        إضافة
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNewAgreement && (
        <div className="gp-modal-overlay" onClick={() => setShowNewAgreement(false)}>
          <div className="gp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gp-modal-title">عقد جديد مع شركة طيران</div>

            <div className="gp-field">
              <label>شركة الطيران</label>
              <select
                value={newAgreement.airlineSupplierId}
                onChange={(e) => setNewAgreement((p) => ({ ...p, airlineSupplierId: e.target.value }))}
              >
                <option value="">اختر شركة الطيران</option>
                {airlines.map((al) => (
                  <option key={al.id} value={al.id}>
                    {al.name}
                    {al.linked_airline_code ? ` (${al.linked_airline_code})` : " — بدون كود IATA"}
                  </option>
                ))}
              </select>
            </div>

            <div className="gp-field">
              <label>المطار</label>
              <select
                value={newAgreement.airportCode}
                onChange={(e) => setNewAgreement((p) => ({ ...p, airportCode: e.target.value }))}
              >
                <option value="">اختر المطار</option>
                {airports.map((ap) => (
                  <option key={ap.code} value={ap.code}>
                    {ap.city} ({ap.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="gp-field">
              <label>SLA (بالساعات — اختياري)</label>
              <input
                type="number"
                min="0"
                value={newAgreement.slaHours}
                onChange={(e) => setNewAgreement((p) => ({ ...p, slaHours: e.target.value }))}
              />
            </div>

            <div className="gp-field">
              <label>العملة</label>
              <select
                value={newAgreement.currency}
                onChange={(e) => setNewAgreement((p) => ({ ...p, currency: e.target.value }))}
              >
                <option value="USD">USD</option>
                <option value="EGP">EGP</option>
              </select>
            </div>

            <div className="gp-modal-actions">
              <button className="gp-btn ghost" onClick={() => setShowNewAgreement(false)}>
                إلغاء
              </button>
              <button className="gp-btn primary" disabled={savingAgreement} onClick={handleCreateAgreement}>
                {savingAgreement ? "جارِ الحفظ..." : "إنشاء العقد"}
              </button>
            </div>
          </div>
        </div>
      )}
    </GroundPortalShell>
  );
}
