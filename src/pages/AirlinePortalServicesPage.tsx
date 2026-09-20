import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { AirlinePortalShell } from "../components/airlinePortal/AirlinePortalShell";
import {
  fetchAirlineOverview,
  fetchAirlineServices,
  fetchAirlineFlights,
  fetchAirlineServiceRules,
  upsertAirlineService,
  setAirlineServiceActive,
  upsertAirlineServiceRule,
  deleteAirlineServiceRule,
  AIRLINE_SERVICE_GROUPS,
  AIRLINE_SERVICE_TYPE_META,
  AIRLINE_SERVICE_TYPE_GROUP,
  type AirlineOverviewRow,
  type AirlineServiceRow,
  type AirlineAncillaryType,
  type AirlineServiceGroupId,
  type AirlineFlightRow,
  type AirlineServiceRuleRow,
  type AirlineServiceRuleAirportRole,
} from "../lib/airlinePortal";
import "../styles/airline-portal.css";
import { getLocale } from "../i18n/format";

const TRAVEL_CLASSES: { value: string; label: string }[] = [
  { value: "economy", label: "اقتصادية" },
  { value: "premium_economy", label: "اقتصادية مميزة" },
  { value: "business", label: "رجال أعمال" },
  { value: "first", label: "الأولى" },
];

const AIRPORT_ROLE_LABEL: Record<AirlineServiceRuleAirportRole, string> = {
  any: "مغادرة أو وصول",
  departure: "مغادرة",
  arrival: "وصول",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(getLocale(), { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface ServiceDraft {
  type: AirlineAncillaryType;
  name: string;
  description: string;
  price: string;
  deliveryLocation: string;
  deliveryMethod: string;
  terms: string;
  maxWeightKg: string;
  maxQuantityPerPax: string;
  capacityPerFlight: string;
  attributes: Record<string, string>;
  isActive: boolean;
  nameEn: string;
  nameTr: string;
  descriptionEn: string;
  descriptionTr: string;
  termsEn: string;
  termsTr: string;
}

function emptyDraft(type: AirlineAncillaryType): ServiceDraft {
  return {
    type,
    name: "",
    description: "",
    price: "",
    deliveryLocation: "",
    deliveryMethod: "",
    terms: "",
    maxWeightKg: "",
    maxQuantityPerPax: "",
    capacityPerFlight: "",
    attributes: {},
    isActive: true,
    nameEn: "",
    nameTr: "",
    descriptionEn: "",
    descriptionTr: "",
    termsEn: "",
    termsTr: "",
  };
}

function draftFromService(s: AirlineServiceRow): ServiceDraft {
  return {
    type: s.type as AirlineAncillaryType,
    name: s.name,
    description: s.description ?? "",
    price: String(s.price),
    deliveryLocation: s.delivery_location ?? "",
    deliveryMethod: s.delivery_method ?? "",
    terms: s.terms ?? "",
    maxWeightKg: s.max_weight_kg != null ? String(s.max_weight_kg) : "",
    maxQuantityPerPax: s.max_quantity_per_pax != null ? String(s.max_quantity_per_pax) : "",
    capacityPerFlight: s.capacity_per_flight != null ? String(s.capacity_per_flight) : "",
    attributes: { ...(s.attributes ?? {}) },
    isActive: s.is_active,
    nameEn: s.name_i18n?.en ?? "",
    nameTr: s.name_i18n?.tr ?? "",
    descriptionEn: s.description_i18n?.en ?? "",
    descriptionTr: s.description_i18n?.tr ?? "",
    termsEn: s.terms_i18n?.en ?? "",
    termsTr: s.terms_i18n?.tr ?? "",
  };
}

/** Builds a LocalizedTextMap from two free-text inputs, or null if both are
 *  empty — mirrors the DB's own "empty object clears translation" contract
 *  but at the field level (an empty EN with a filled TR still saves TR). */
function localizedMapOrNull(en: string, tr: string): { en?: string; tr?: string } | null {
  const out: { en?: string; tr?: string } = {};
  if (en.trim()) out.en = en.trim();
  if (tr.trim()) out.tr = tr.trim();
  return Object.keys(out).length > 0 ? out : null;
}

/** Collapsible EN/TR name+description+terms section, reused by both the
 *  "new service" and "edit service" forms. Purely additive — leaving every
 *  field blank keeps the service Arabic-only (server clears with {} vs
 *  leaves untouched on undefined, matched by localizedMapOrNull above). */
function TranslationFields({
  draft,
  setDraft,
}: {
  draft: ServiceDraft;
  setDraft: (updater: (d: ServiceDraft) => ServiceDraft) => void;
}) {
  const [open, setOpen] = useState(
    () => !!(draft.nameEn || draft.nameTr || draft.descriptionEn || draft.descriptionTr || draft.termsEn || draft.termsTr),
  );
  return (
    <div style={{ border: "1px solid var(--ap-border, #e2e8f0)", borderRadius: 8, padding: 8 }}>
      <button type="button" className="ap-btn" onClick={() => setOpen((v) => !v)}>
        {open ? "إخفاء الترجمة" : "ترجمة (اختياري)"}
      </button>
      {open && (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            <input
              className="ap-input"
              placeholder="الاسم بالإنجليزي"
              value={draft.nameEn}
              onChange={(e) => setDraft((d) => ({ ...d, nameEn: e.target.value }))}
            />
            <input
              className="ap-input"
              placeholder="الاسم بالتركي"
              value={draft.nameTr}
              onChange={(e) => setDraft((d) => ({ ...d, nameTr: e.target.value }))}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            <input
              className="ap-input"
              placeholder="الوصف بالإنجليزي"
              value={draft.descriptionEn}
              onChange={(e) => setDraft((d) => ({ ...d, descriptionEn: e.target.value }))}
            />
            <input
              className="ap-input"
              placeholder="الوصف بالتركي"
              value={draft.descriptionTr}
              onChange={(e) => setDraft((d) => ({ ...d, descriptionTr: e.target.value }))}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            <input
              className="ap-input"
              placeholder="الشروط بالإنجليزي"
              value={draft.termsEn}
              onChange={(e) => setDraft((d) => ({ ...d, termsEn: e.target.value }))}
            />
            <input
              className="ap-input"
              placeholder="الشروط بالتركي"
              value={draft.termsTr}
              onChange={(e) => setDraft((d) => ({ ...d, termsTr: e.target.value }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

type RuleScope = "all" | "flight" | "flight_number" | "route" | "airport";

interface RuleDraft {
  scope: RuleScope;
  dealId: string;
  flightNumber: string;
  fromAirport: string;
  toAirport: string;
  airportCode: string;
  airportRole: AirlineServiceRuleAirportRole;
  travelClass: string;
  startsAt: string;
  endsAt: string;
  cutoffHours: string;
  note: string;
}

const EMPTY_RULE_DRAFT: RuleDraft = {
  scope: "all",
  dealId: "",
  flightNumber: "",
  fromAirport: "",
  toAirport: "",
  airportCode: "",
  airportRole: "any",
  travelClass: "",
  startsAt: "",
  endsAt: "",
  cutoffHours: "",
  note: "",
};

function ruleScopeLabel(r: AirlineServiceRuleRow, flightsById: Map<string, AirlineFlightRow>): string {
  if (r.deal_id) {
    const f = flightsById.get(r.deal_id);
    return f ? `رحلة محددة: ${f.flight_number ?? "—"} (${f.from_airport} → ${f.to_airport}, ${formatDate(f.departure_date)})` : "رحلة محددة";
  }
  if (r.flight_number) return `رقم رحلة: ${r.flight_number}`;
  if (r.from_airport || r.to_airport) return `مسار: ${r.from_airport ?? "أي"} → ${r.to_airport ?? "أي"}`;
  if (r.airport_code) return `مطار ${r.airport_code} (${AIRPORT_ROLE_LABEL[r.airport_role]})`;
  return "كل رحلات الشركة";
}

/** "الخدمات الإضافية" tab — full v2: 19 ancillary types grouped into 7
 *  tabs (matching the agreed reference image), full field set (مكان
 *  التقديم/طريقة التنفيذ/الشروط/الحدود/بيانات مرنة لكل نوع), and a
 *  per-service availability-rules editor (رحلة محددة/رقم رحلة/مسار/مطار/
 *  درجة/فترة سفر/آخر موعد للطلب). A service is invisible to customers on
 *  any flight until a rule activates it there — enforced server-side. */
export function AirlinePortalServicesPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AirlineOverviewRow | null>(null);
  const [services, setServices] = useState<AirlineServiceRow[]>([]);
  const [flights, setFlights] = useState<AirlineFlightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [activeGroup, setActiveGroup] = useState<AirlineServiceGroupId>(AIRLINE_SERVICE_GROUPS[0].id);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ServiceDraft | null>(null);

  const [showNewForm, setShowNewForm] = useState(false);
  const [newDraft, setNewDraft] = useState<ServiceDraft>(emptyDraft(AIRLINE_SERVICE_GROUPS[0].types[0].type));
  const [savingNew, setSavingNew] = useState(false);

  const [rulesOpenFor, setRulesOpenFor] = useState<string | null>(null);
  const [rulesById, setRulesById] = useState<Record<string, AirlineServiceRuleRow[]>>({});
  const [rulesLoading, setRulesLoading] = useState(false);
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<RuleDraft>(EMPTY_RULE_DRAFT);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleBusyId, setRuleBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [overviewRows, serviceRows, flightRows] = await Promise.all([
        fetchAirlineOverview(),
        fetchAirlineServices(),
        fetchAirlineFlights(null),
      ]);
      if (overviewRows.length === 0) {
        navigate("/airline-portal/login");
        return;
      }
      setOverview(overviewRows[0]);
      setServices(serviceRows);
      setFlights(flightRows);
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

  const flightsById = useMemo(() => new Map(flights.map((f) => [f.deal_id, f])), [flights]);

  const groupServices = useMemo(
    () => services.filter((s) => AIRLINE_SERVICE_TYPE_GROUP[s.type as AirlineAncillaryType] === activeGroup),
    [services, activeGroup],
  );

  function switchGroup(g: AirlineServiceGroupId) {
    setActiveGroup(g);
    setShowNewForm(false);
    setEditingId(null);
    setEditDraft(null);
    setRulesOpenFor(null);
    setRuleFormOpen(false);
    const firstType = AIRLINE_SERVICE_GROUPS.find((x) => x.id === g)?.types[0].type;
    if (firstType) setNewDraft(emptyDraft(firstType));
  }

  function validateDraft(d: ServiceDraft): string | null {
    const price = Number(d.price);
    if (!d.name.trim()) return "اسم الخدمة مطلوب";
    if (!Number.isFinite(price) || price < 0) return "السعر لازم يكون رقم صحيح وغير سالب";
    if (d.maxWeightKg && (!Number.isFinite(Number(d.maxWeightKg)) || Number(d.maxWeightKg) <= 0)) return "الحد الأقصى للوزن لازم يكون رقم أكبر من صفر";
    if (d.maxQuantityPerPax && (!Number.isFinite(Number(d.maxQuantityPerPax)) || Number(d.maxQuantityPerPax) < 1)) return "الحد الأقصى للكمية لكل راكب لازم يكون 1 أو أكتر";
    if (d.capacityPerFlight && (!Number.isFinite(Number(d.capacityPerFlight)) || Number(d.capacityPerFlight) < 1)) return "السعة القصوى لكل رحلة لازم تكون 1 أو أكتر";
    return null;
  }

  function draftToUpsertInput(d: ServiceDraft, id?: string) {
    const cleanAttrs = Object.fromEntries(Object.entries(d.attributes).filter(([, v]) => v.trim() !== ""));
    return {
      id,
      type: d.type,
      name: d.name.trim(),
      description: d.description.trim() || null,
      price: Number(d.price),
      isActive: d.isActive,
      deliveryLocation: d.deliveryLocation.trim() || null,
      deliveryMethod: d.deliveryMethod.trim() || null,
      terms: d.terms.trim() || null,
      maxWeightKg: d.maxWeightKg ? Number(d.maxWeightKg) : null,
      maxQuantityPerPax: d.maxQuantityPerPax ? Number(d.maxQuantityPerPax) : null,
      capacityPerFlight: d.capacityPerFlight ? Number(d.capacityPerFlight) : null,
      attributes: Object.keys(cleanAttrs).length > 0 ? cleanAttrs : null,
      nameI18n: localizedMapOrNull(d.nameEn, d.nameTr),
      descriptionI18n: localizedMapOrNull(d.descriptionEn, d.descriptionTr),
      termsI18n: localizedMapOrNull(d.termsEn, d.termsTr),
    };
  }

  function startEdit(s: AirlineServiceRow) {
    setShowNewForm(false);
    setEditingId(s.id);
    setEditDraft(draftFromService(s));
    setRulesOpenFor(null);
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;
    const err = validateDraft(editDraft);
    if (err) {
      setError(err);
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await upsertAirlineService(draftToUpsertInput(editDraft, id));
      setEditingId(null);
      setEditDraft(null);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "تعذر حفظ التعديل");
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
    const err = validateDraft(newDraft);
    if (err) {
      setError(err);
      return;
    }
    setSavingNew(true);
    setError(null);
    try {
      const newId = await upsertAirlineService(draftToUpsertInput(newDraft));
      setShowNewForm(false);
      const firstType = AIRLINE_SERVICE_GROUPS.find((x) => x.id === activeGroup)?.types[0].type;
      setNewDraft(emptyDraft(firstType ?? newDraft.type));
      await load();
      // Straight into "قواعد الإتاحة" for the service just created — a
      // freshly-saved service has zero rules, so it's invisible to
      // customers on any flight until the airline adds at least one.
      await openRules(newId);
    } catch (e: any) {
      setError(e?.message ?? "تعذر إضافة الخدمة");
    } finally {
      setSavingNew(false);
    }
  }

  async function openRules(serviceId: string) {
    setEditingId(null);
    setEditDraft(null);
    if (rulesOpenFor === serviceId) {
      setRulesOpenFor(null);
      setRuleFormOpen(false);
      return;
    }
    setRulesOpenFor(serviceId);
    setRuleFormOpen(false);
    setRuleDraft(EMPTY_RULE_DRAFT);
    if (!rulesById[serviceId]) {
      setRulesLoading(true);
      try {
        const rows = await fetchAirlineServiceRules(serviceId);
        setRulesById((m) => ({ ...m, [serviceId]: rows }));
      } catch {
        setError("تعذر تحميل قواعد الإتاحة");
      } finally {
        setRulesLoading(false);
      }
    }
  }

  async function refreshRules(serviceId: string) {
    const rows = await fetchAirlineServiceRules(serviceId);
    setRulesById((m) => ({ ...m, [serviceId]: rows }));
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, active_rules_count: rows.filter((r) => r.is_active).length } : s)),
    );
  }

  async function saveRule(serviceId: string) {
    if (ruleDraft.startsAt && ruleDraft.endsAt && ruleDraft.startsAt > ruleDraft.endsAt) {
      setError("تاريخ بداية الإتاحة لازم يكون قبل تاريخ النهاية");
      return;
    }
    setSavingRule(true);
    setError(null);
    try {
      await upsertAirlineServiceRule({
        additionalServiceId: serviceId,
        dealId: ruleDraft.scope === "flight" ? ruleDraft.dealId || null : null,
        flightNumber: ruleDraft.scope === "flight_number" ? ruleDraft.flightNumber.trim() || null : null,
        fromAirport: ruleDraft.scope === "route" ? ruleDraft.fromAirport.trim() || null : null,
        toAirport: ruleDraft.scope === "route" ? ruleDraft.toAirport.trim() || null : null,
        airportCode: ruleDraft.scope === "airport" ? ruleDraft.airportCode.trim() || null : null,
        airportRole: ruleDraft.scope === "airport" ? ruleDraft.airportRole : "any",
        travelClass: ruleDraft.travelClass || null,
        startsAt: ruleDraft.startsAt || null,
        endsAt: ruleDraft.endsAt || null,
        cutoffHours: ruleDraft.cutoffHours ? Number(ruleDraft.cutoffHours) : null,
        note: ruleDraft.note.trim() || null,
        isActive: true,
      });
      setRuleFormOpen(false);
      setRuleDraft(EMPTY_RULE_DRAFT);
      await refreshRules(serviceId);
    } catch (e: any) {
      setError(e?.message ?? "تعذر حفظ القاعدة");
    } finally {
      setSavingRule(false);
    }
  }

  async function toggleRuleActive(serviceId: string, r: AirlineServiceRuleRow) {
    setRuleBusyId(r.id);
    setError(null);
    try {
      await upsertAirlineServiceRule({
        id: r.id,
        additionalServiceId: serviceId,
        airportCode: r.airport_code,
        airportRole: r.airport_role,
        travelClass: r.travel_class,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        flightNumber: r.flight_number,
        fromAirport: r.from_airport,
        toAirport: r.to_airport,
        dealId: r.deal_id,
        cutoffHours: r.cutoff_hours,
        note: r.note,
        isActive: !r.is_active,
      });
      await refreshRules(serviceId);
    } catch {
      setError("تعذر تغيير حالة القاعدة");
    } finally {
      setRuleBusyId(null);
    }
  }

  async function removeRule(serviceId: string, ruleId: string) {
    setRuleBusyId(ruleId);
    setError(null);
    try {
      await deleteAirlineServiceRule(ruleId);
      await refreshRules(serviceId);
    } catch {
      setError("تعذر حذف القاعدة");
    } finally {
      setRuleBusyId(null);
    }
  }

  function renderServiceForm(
    draft: ServiceDraft,
    setDraft: (updater: (d: ServiceDraft) => ServiceDraft) => void,
    opts: { isNew: boolean; onSave: () => void; onCancel: () => void; saving: boolean },
  ) {
    const meta = AIRLINE_SERVICE_TYPE_META[draft.type];
    return (
      <div className="ap-review-box">
        {opts.isNew && (
          <select
            className="ap-input"
            value={draft.type}
            onChange={(e) => {
              const t = e.target.value as AirlineAncillaryType;
              setDraft(() => ({ ...emptyDraft(t) }));
            }}
          >
            {AIRLINE_SERVICE_GROUPS.find((g) => g.id === activeGroup)?.types.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          <input
            className="ap-input"
            placeholder="اسم الخدمة"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <input
            className="ap-input"
            placeholder="السعر"
            inputMode="decimal"
            value={draft.price}
            onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
          />
        </div>
        <input
          className="ap-input"
          placeholder="وصف مختصر (اختياري)"
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          <input
            className="ap-input"
            placeholder="مكان تقديم الخدمة (كاونتر / بوابة / صالة)"
            value={draft.deliveryLocation}
            onChange={(e) => setDraft((d) => ({ ...d, deliveryLocation: e.target.value }))}
          />
          <input
            className="ap-input"
            placeholder="طريقة التنفيذ / التسليم"
            value={draft.deliveryMethod}
            onChange={(e) => setDraft((d) => ({ ...d, deliveryMethod: e.target.value }))}
          />
        </div>
        <input
          className="ap-input"
          placeholder="الشروط والحدود (نص حر)"
          value={draft.terms}
          onChange={(e) => setDraft((d) => ({ ...d, terms: e.target.value }))}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <input
            className="ap-input"
            placeholder="أقصى وزن (كجم)"
            inputMode="decimal"
            value={draft.maxWeightKg}
            onChange={(e) => setDraft((d) => ({ ...d, maxWeightKg: e.target.value }))}
          />
          <input
            className="ap-input"
            placeholder="أقصى كمية لكل راكب"
            inputMode="numeric"
            value={draft.maxQuantityPerPax}
            onChange={(e) => setDraft((d) => ({ ...d, maxQuantityPerPax: e.target.value }))}
          />
          <input
            className="ap-input"
            placeholder="السعة القصوى لكل رحلة"
            inputMode="numeric"
            value={draft.capacityPerFlight}
            onChange={(e) => setDraft((d) => ({ ...d, capacityPerFlight: e.target.value }))}
          />
        </div>
        <TranslationFields draft={draft} setDraft={setDraft} />
        {meta?.attributeFields && meta.attributeFields.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${meta.attributeFields.length}, 1fr)`, gap: 8 }}>
            {meta.attributeFields.map((f) => (
              <input
                key={f.key}
                className="ap-input"
                placeholder={f.label}
                value={draft.attributes[f.key] ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, attributes: { ...d.attributes, [f.key]: e.target.value } }))
                }
              />
            ))}
          </div>
        )}
        <div className="ap-review-actions">
          <button className="ap-btn primary" disabled={opts.saving} onClick={opts.onSave}>
            حفظ الخدمة
          </button>
          <button className="ap-btn" onClick={opts.onCancel}>
            إلغاء
          </button>
        </div>
      </div>
    );
  }

  function renderRulesPanel(s: AirlineServiceRow) {
    const rows = rulesById[s.id] ?? [];
    return (
      <div className="ap-review-box">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="ap-review-line">قواعد إتاحة "{s.name}" — الخدمة ما بتظهرش على أي رحلة غير لو فيه قاعدة فعّالة بتغطيها</span>
          <button className="ap-btn primary" onClick={() => { setRuleFormOpen((v) => !v); setRuleDraft(EMPTY_RULE_DRAFT); }}>
            {ruleFormOpen ? "إلغاء" : "+ قاعدة جديدة"}
          </button>
        </div>

        {ruleFormOpen && (
          <div className="ap-review-box">
            <select
              className="ap-input"
              value={ruleDraft.scope}
              onChange={(e) => setRuleDraft((d) => ({ ...EMPTY_RULE_DRAFT, scope: e.target.value as RuleScope, travelClass: d.travelClass }))}
            >
              <option value="all">كل رحلات الشركة</option>
              <option value="flight">رحلة محددة</option>
              <option value="flight_number">رقم رحلة (يتكرر دوريًا)</option>
              <option value="route">مسار (من → إلى)</option>
              <option value="airport">مطار (مغادرة/وصول)</option>
            </select>

            {ruleDraft.scope === "flight" && (
              <select
                className="ap-input"
                value={ruleDraft.dealId}
                onChange={(e) => setRuleDraft((d) => ({ ...d, dealId: e.target.value }))}
              >
                <option value="">اختر رحلة...</option>
                {flights.map((f) => (
                  <option key={f.deal_id} value={f.deal_id}>
                    {f.flight_number ?? "—"} · {f.from_airport} → {f.to_airport} · {formatDate(f.departure_date)}
                  </option>
                ))}
              </select>
            )}

            {ruleDraft.scope === "flight_number" && (
              <input
                className="ap-input"
                placeholder="رقم الرحلة، مثال QR1312"
                value={ruleDraft.flightNumber}
                onChange={(e) => setRuleDraft((d) => ({ ...d, flightNumber: e.target.value }))}
              />
            )}

            {ruleDraft.scope === "route" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                <input
                  className="ap-input"
                  placeholder="من (كود المطار، اختياري)"
                  value={ruleDraft.fromAirport}
                  onChange={(e) => setRuleDraft((d) => ({ ...d, fromAirport: e.target.value }))}
                />
                <input
                  className="ap-input"
                  placeholder="إلى (كود المطار، اختياري)"
                  value={ruleDraft.toAirport}
                  onChange={(e) => setRuleDraft((d) => ({ ...d, toAirport: e.target.value }))}
                />
              </div>
            )}

            {ruleDraft.scope === "airport" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                <input
                  className="ap-input"
                  placeholder="كود المطار"
                  value={ruleDraft.airportCode}
                  onChange={(e) => setRuleDraft((d) => ({ ...d, airportCode: e.target.value }))}
                />
                <select
                  className="ap-input"
                  value={ruleDraft.airportRole}
                  onChange={(e) => setRuleDraft((d) => ({ ...d, airportRole: e.target.value as AirlineServiceRuleAirportRole }))}
                >
                  <option value="any">مغادرة أو وصول</option>
                  <option value="departure">مغادرة فقط</option>
                  <option value="arrival">وصول فقط</option>
                </select>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              <select
                className="ap-input"
                value={ruleDraft.travelClass}
                onChange={(e) => setRuleDraft((d) => ({ ...d, travelClass: e.target.value }))}
              >
                <option value="">كل الدرجات</option>
                {TRAVEL_CLASSES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                className="ap-input"
                placeholder="آخر موعد للطلب (ساعات قبل الإقلاع)"
                inputMode="numeric"
                value={ruleDraft.cutoffHours}
                onChange={(e) => setRuleDraft((d) => ({ ...d, cutoffHours: e.target.value }))}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
              <label className="ap-review-line">
                من تاريخ سفر
                <input
                  className="ap-input"
                  type="date"
                  value={ruleDraft.startsAt}
                  onChange={(e) => setRuleDraft((d) => ({ ...d, startsAt: e.target.value }))}
                />
              </label>
              <label className="ap-review-line">
                إلى تاريخ سفر
                <input
                  className="ap-input"
                  type="date"
                  value={ruleDraft.endsAt}
                  onChange={(e) => setRuleDraft((d) => ({ ...d, endsAt: e.target.value }))}
                />
              </label>
            </div>
            <input
              className="ap-input"
              placeholder="ملاحظة داخلية (اختياري)"
              value={ruleDraft.note}
              onChange={(e) => setRuleDraft((d) => ({ ...d, note: e.target.value }))}
            />
            <div className="ap-review-actions">
              <button className="ap-btn primary" disabled={savingRule} onClick={() => saveRule(s.id)}>
                حفظ القاعدة
              </button>
              <button className="ap-btn" onClick={() => setRuleFormOpen(false)}>
                إلغاء
              </button>
            </div>
          </div>
        )}

        {rulesLoading ? (
          <div className="ap-empty">جاري التحميل...</div>
        ) : rows.length === 0 ? (
          <div className="ap-empty">لا توجد قواعد إتاحة بعد — الخدمة مخفية عن العملاء لحد ما تضيف قاعدة</div>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th>النطاق</th>
                <th>الدرجة</th>
                <th>فترة السفر</th>
                <th>آخر موعد للطلب</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{ruleScopeLabel(r, flightsById)}</td>
                  <td>{r.travel_class ? TRAVEL_CLASSES.find((c) => c.value === r.travel_class)?.label ?? r.travel_class : "الكل"}</td>
                  <td>
                    {r.starts_at || r.ends_at ? `${formatDate(r.starts_at)} → ${formatDate(r.ends_at)}` : "بلا حدود"}
                  </td>
                  <td>{r.cutoff_hours != null ? `${r.cutoff_hours} ساعة` : "بدون"}</td>
                  <td>
                    <span className={`ap-pill ${r.is_active ? "active" : "cancelled"}`}>{r.is_active ? "فعّالة" : "متوقفة"}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className={`ap-btn ${r.is_active ? "danger" : "primary"}`}
                        disabled={ruleBusyId === r.id}
                        onClick={() => toggleRuleActive(s.id, r)}
                      >
                        {r.is_active ? "إيقاف" : "تفعيل"}
                      </button>
                      <button className="ap-btn danger" disabled={ruleBusyId === r.id} onClick={() => removeRule(s.id, r.id)}>
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  return (
    <AirlinePortalShell overview={overview} active="services">
      <div className="ap-panel">
        <div className="ap-panel-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>الخدمات الإضافية (الأنسيلاري)</span>
          <button
            className="ap-btn primary"
            onClick={() => {
              setShowNewForm((v) => !v);
              setEditingId(null);
              setEditDraft(null);
              setRulesOpenFor(null);
            }}
          >
            {showNewForm ? "إلغاء" : "+ خدمة جديدة"}
          </button>
        </div>

        <div className="ap-tabs">
          {AIRLINE_SERVICE_GROUPS.map((g) => {
            const count = services.filter((s) => AIRLINE_SERVICE_TYPE_GROUP[s.type as AirlineAncillaryType] === g.id).length;
            return (
              <button
                key={g.id}
                className={`ap-tab ${activeGroup === g.id ? "active" : ""}`}
                onClick={() => switchGroup(g.id)}
              >
                {g.label} {count > 0 && <span className="ap-tab-count">{count}</span>}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="ap-empty" style={{ color: "var(--ap-red)" }}>
            {error}
          </div>
        )}

        {showNewForm &&
          renderServiceForm(newDraft, (updater) => setNewDraft(updater), {
            isNew: true,
            saving: savingNew,
            onSave: createNew,
            onCancel: () => setShowNewForm(false),
          })}

        {loading ? (
          <div className="ap-empty">جاري التحميل...</div>
        ) : groupServices.length === 0 ? (
          <div className="ap-empty">لا توجد خدمات في هذه المجموعة بعد — أضف واحدة من الزر أعلاه</div>
        ) : (
          <table className="ap-table">
            <thead>
              <tr>
                <th>النوع</th>
                <th>الاسم</th>
                <th>السعر</th>
                <th>الحالة</th>
                <th>قواعد فعّالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {groupServices.map((s) => (
                <Fragment key={s.id}>
                  <tr>
                    <td>{AIRLINE_SERVICE_TYPE_META[s.type as AirlineAncillaryType]?.label ?? s.type}</td>
                    <td>{s.name}</td>
                    <td>{s.price}</td>
                    <td>
                      <span className={`ap-pill ${s.is_active ? "active" : "cancelled"}`}>{s.is_active ? "مفعّلة" : "متوقفة"}</span>
                    </td>
                    <td>
                      <span className={`ap-pill ${s.active_rules_count > 0 ? "active" : "pending"}`}>
                        {s.active_rules_count > 0 ? `${s.active_rules_count} قاعدة` : "مخفية — بدون قواعد"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button className="ap-btn" onClick={() => startEdit(s)}>
                          تعديل
                        </button>
                        <button className="ap-btn" onClick={() => openRules(s.id)}>
                          {rulesOpenFor === s.id ? "إخفاء القواعد" : "قواعد الإتاحة"}
                        </button>
                        <button
                          className={`ap-btn ${s.is_active ? "danger" : "primary"}`}
                          disabled={busyId === s.id}
                          onClick={() => toggleActive(s)}
                        >
                          {s.is_active ? "إيقاف" : "تفعيل"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === s.id && editDraft && (
                    <tr>
                      <td colSpan={6}>
                        {renderServiceForm(editDraft, (updater) => setEditDraft((d) => (d ? updater(d) : d)), {
                          isNew: false,
                          saving: busyId === s.id,
                          onSave: () => saveEdit(s.id),
                          onCancel: () => {
                            setEditingId(null);
                            setEditDraft(null);
                          },
                        })}
                      </td>
                    </tr>
                  )}
                  {rulesOpenFor === s.id && (
                    <tr>
                      <td colSpan={6}>{renderRulesPanel(s)}</td>
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
