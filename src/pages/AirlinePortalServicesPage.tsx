import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AirlinePortalShell } from "../components/airlinePortal/AirlinePortalShell";
import {
  fetchAirlineOverview,
  fetchAirlineServices,
  upsertAirlineService,
  setAirlineServiceActive,
  AIRLINE_ANCILLARY_TYPES,
  type AirlineOverviewRow,
  type AirlineServiceRow,
  type AirlineAncillaryType,
} from "../lib/airlinePortal";
import "../styles/airline-portal.css";

const TYPE_LABEL: Record<AirlineAncillaryType, string> = {
  extra_baggage: "حقيبة إضافية",
  priority_boarding: "صعود أولوية",
  seat_selection: "اختيار مقعد",
};

interface DraftState {
  type: AirlineAncillaryType;
  name: string;
  description: string;
  price: string;
}

const EMPTY_DRAFT: DraftState = { type: "extra_baggage", name: "", description: "", price: "" };

/** "الخدمات الإضافية" tab — the airline's own ancillary catalog. Scope is
 *  deliberately narrow (v1): the airline can create/edit/pause listings for
 *  extra_baggage / priority_boarding / seat_selection with a flat price.
 *  Availability rules by flight/airport/class/date are NOT built here yet —
 *  that's a real follow-up phase, not shipped as a stub. */
export function AirlinePortalServicesPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AirlineOverviewRow | null>(null);
  const [services, setServices] = useState<AirlineServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ name: string; description: string; price: string } | null>(null);

  const [showNewForm, setShowNewForm] = useState(false);
  const [newDraft, setNewDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [savingNew, setSavingNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const [overviewRows, serviceRows] = await Promise.all([fetchAirlineOverview(), fetchAirlineServices()]);
      if (overviewRows.length === 0) {
        navigate("/airline-portal/login");
        return;
      }
      setOverview(overviewRows[0]);
      setServices(serviceRows);
    } catch (e: any) {
      if (e?.message?.includes("JWT") || e?.code === "PGRST301") {
        navigate("/airline-portal/login");
        return;
      }
      setError("تعذر تحميل الخدمات الإضافية");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(s: AirlineServiceRow) {
    setEditingId(s.id);
    setEditDraft({ name: s.name, description: s.description ?? "", price: String(s.price) });
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;
    const price = Number(editDraft.price);
    if (!editDraft.name.trim()) {
      setError("اسم الخدمة مطلوب");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("السعر لازم يكون رقم صحيح وغير سالب");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await upsertAirlineService({
        id,
        name: editDraft.name.trim(),
        description: editDraft.description.trim() || null,
        price,
      });
      setEditingId(null);
      setEditDraft(null);
      await load();
    } catch {
      setError("تعذر حفظ التعديل");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(s: AirlineServiceRow) {
    setBusyId(s.id);
    setError(null);
    try {
      await setAirlineServiceActive(s.id, !s.is_active);
      await load();
    } catch {
      setError("تعذر تغيير حالة الخدمة");
    } finally {
      setBusyId(null);
    }
  }

  async function createNew() {
    const price = Number(newDraft.price);
    if (!newDraft.name.trim()) {
      setError("اسم الخدمة مطلوب");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError("السعر لازم يكون رقم صحيح وغير سالب");
      return;
    }
    setSavingNew(true);
    setError(null);
    try {
      await upsertAirlineService({
        type: newDraft.type,
        name: newDraft.name.trim(),
        description: newDraft.description.trim() || null,
        price,
        isActive: true,
      });
      setShowNewForm(false);
      setNewDraft(EMPTY_DRAFT);
      await load();
    } catch {
      setError("تعذر إضافة الخدمة");
    } finally {
      setSavingNew(false);
    }
  }

  return (
    <AirlinePortalShell overview={overview} active="services">
      <div className="ap-panel">
        <div
          className="ap-panel-title"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <span>الخدمات الإضافية (الأنسيلاري)</span>
          <button className="ap-btn primary" onClick={() => setShowNewForm((v) => !v)}>
            {showNewForm ? "إلغاء" : "+ خدمة جديدة"}
          </button>
        </div>

        {error && <div className="ap-empty" style={{ color: "var(--ap-red)" }}>{error}</div>}

        {showNewForm && (
          <div className="ap-review-box" style={{ marginBottom: 14 }}>
            <select
              className="ap-input"
              value={newDraft.type}
              onChange={(e) => setNewDraft((d) => ({ ...d, type: e.target.value as AirlineAncillaryType }))}
            >
              {AIRLINE_ANCILLARY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <input
              className="ap-input"
              placeholder="اسم الخدمة"
              value={newDraft.name}
              onChange={(e) => setNewDraft((d) => ({ ...d, name: e.target.value }))}
            />
            <input
              className="ap-input"
              placeholder="وصف مختصر (اختياري)"
              value={newDraft.description}
              onChange={(e) => setNewDraft((d) => ({ ...d, description: e.target.value }))}
            />
            <input
              className="ap-input"
              placeholder="السعر"
              inputMode="decimal"
              value={newDraft.price}
              onChange={(e) => setNewDraft((d) => ({ ...d, price: e.target.value }))}
            />
            <div className="ap-review-actions">
              <button className="ap-btn primary" disabled={savingNew} onClick={createNew}>
                حفظ الخدمة
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="ap-empty">جاري التحميل...</div>
        ) : services.length === 0 ? (
          <div className="ap-empty">لا توجد خدمات إضافية مسجّلة بعد — أضف واحدة من الزر أعلاه</div>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th>النوع</th>
                <th>الاسم</th>
                <th>الوصف</th>
                <th>السعر</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id}>
                  <td>{TYPE_LABEL[s.type as AirlineAncillaryType] ?? s.type}</td>
                  <td>
                    {editingId === s.id ? (
                      <input
                        className="ap-input"
                        value={editDraft?.name ?? ""}
                        onChange={(e) => setEditDraft((d) => (d ? { ...d, name: e.target.value } : d))}
                      />
                    ) : (
                      s.name
                    )}
                  </td>
                  <td>
                    {editingId === s.id ? (
                      <input
                        className="ap-input"
                        value={editDraft?.description ?? ""}
                        onChange={(e) => setEditDraft((d) => (d ? { ...d, description: e.target.value } : d))}
                      />
                    ) : (
                      s.description ?? "—"
                    )}
                  </td>
                  <td>
                    {editingId === s.id ? (
                      <input
                        className="ap-input"
                        style={{ width: 90 }}
                        inputMode="decimal"
                        value={editDraft?.price ?? ""}
                        onChange={(e) => setEditDraft((d) => (d ? { ...d, price: e.target.value } : d))}
                      />
                    ) : (
                      s.price
                    )}
                  </td>
                  <td>
                    <span className={`ap-pill ${s.is_active ? "active" : "cancelled"}`}>
                      {s.is_active ? "مفعّلة" : "متوقفة"}
                    </span>
                  </td>
                  <td>
                    {editingId === s.id ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="ap-btn primary" disabled={busyId === s.id} onClick={() => saveEdit(s.id)}>
                          حفظ
                        </button>
                        <button
                          className="ap-btn"
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft(null);
                          }}
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="ap-btn" onClick={() => startEdit(s)}>
                          تعديل
                        </button>
                        <button
                          className={`ap-btn ${s.is_active ? "danger" : "primary"}`}
                          disabled={busyId === s.id}
                          onClick={() => toggleActive(s)}
                        >
                          {s.is_active ? "إيقاف" : "تفعيل"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AirlinePortalShell>
  );
}
