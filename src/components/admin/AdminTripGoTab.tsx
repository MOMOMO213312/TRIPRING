import { useEffect, useState } from "react";

import {
  createTripGoBundle,
  createTripGoDeal,
  deleteTripGoBundle,
  fetchAllAgencies,
  fetchAllTripGoBundles,
  fetchAllTripGoDeals,
  setTripGoDealStatus,
  TRANSPORT_TYPE_LABELS,
} from "../../lib/admin";
import { fetchActiveDeals } from "../../lib/api";
import { friendlyErrorMessage } from "../../lib/errors";
import type { AgencyRow, DealRow, TripGoBundleJoined, TripGoDealRow, TransportType } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";

const STATUS_LABELS: Record<TripGoDealRow["status"], string> = {
  draft: "مسودة",
  active: "نشط",
  expired: "منتهي",
  sold_out: "مكتمل الحجز",
  cancelled: "ملغي",
};

export function AdminTripGoTab() {
  const [deals, setDeals] = useState<TripGoDealRow[]>([]);
  const [bundles, setBundles] = useState<TripGoBundleJoined[]>([]);
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [showCreateBundle, setShowCreateBundle] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([fetchAllTripGoDeals(), fetchAllTripGoBundles(), fetchAllAgencies()])
      .then(([d, b, a]) => {
        setDeals(d);
        setBundles(b);
        setAgencies(a);
      })
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل بيانات TripGo", "AdminTripGoTab.load")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleStatus(deal: TripGoDealRow) {
    setBusyId(deal.id);
    try {
      await setTripGoDealStatus(deal.id, deal.status === "active" ? "cancelled" : "active");
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث حالة عرض النقل", "AdminTripGoTab.toggleStatus"));
    } finally {
      setBusyId(null);
    }
  }

  async function removeBundle(bundleId: string) {
    setBusyId(bundleId);
    try {
      await deleteTripGoBundle(bundleId);
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر حذف الباقة", "AdminTripGoTab.removeBundle"));
    } finally {
      setBusyId(null);
    }
  }

  const agencyName = (id: string) => agencies.find((a) => a.id === id)?.name ?? "—";

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-700">عروض النقل (tripgo_deals)</h2>
            <p className="text-xs text-slate-500">
              {loading ? "جاري التحميل..." : `${deals.length} عرض نقل`}
            </p>
          </div>
          <Button type="button" onClick={() => setShowCreateDeal(true)} disabled={agencies.length === 0}>
            + إضافة عرض نقل
          </Button>
        </div>
        {agencies.length === 0 && !loading ? (
          <p className="text-xs text-amber-700">محتاج تضيف وكالة واحدة على الأقل الأول (تاب الوكالات) قبل ما تقدر تضيف عرض نقل.</p>
        ) : null}

        {deals.length === 0 && !loading ? (
          <p className="text-sm text-slate-400">لسه مفيش عروض نقل مضافة.</p>
        ) : null}

        <div className="space-y-2">
          {deals.map((d) => (
            <Card key={d.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {TRANSPORT_TYPE_LABELS[d.transport_type]} {d.vehicle_type ? `· ${d.vehicle_type}` : ""}
                </p>
                <p className="text-xs text-slate-500">
                  {(d.from_location || d.from_airport) ?? "—"} ← {(d.to_location || d.to_airport) ?? "—"} ·{" "}
                  {d.pickup_date} {d.pickup_time ?? ""}
                </p>
                <p className="text-xs text-slate-400">
                  الوكالة: {agencyName(d.agency_id)} · السعة: {d.capacity_available}/{d.capacity_total} · السعر:{" "}
                  {d.price} {d.currency}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{STATUS_LABELS[d.status]}</Badge>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busyId === d.id}
                  onClick={() => toggleStatus(d)}
                >
                  {d.status === "active" ? "إلغاء التفعيل" : "تفعيل"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3 border-t border-slate-100 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-700">باقات TripGo (تذكرة + نقل)</h2>
            <p className="text-xs text-slate-500">
              {loading ? "جاري التحميل..." : `${bundles.length} باقة`}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowCreateBundle(true)}
            disabled={deals.filter((d) => d.status === "active").length === 0}
          >
            + ربط تذكرة بعرض نقل
          </Button>
        </div>
        {deals.filter((d) => d.status === "active").length === 0 && !loading ? (
          <p className="text-xs text-amber-700">محتاج عرض نقل نشط واحد على الأقل قبل ما تقدر تعمل باقة.</p>
        ) : null}

        {bundles.length === 0 && !loading ? <p className="text-sm text-slate-400">لسه مفيش باقات مربوطة.</p> : null}

        <div className="space-y-2">
          {bundles.map((b) => (
            <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {b.deal.from_airport} ← {b.deal.to_airport} · {b.deal.departure_date}
                </p>
                <p className="text-xs text-slate-500">
                  + {TRANSPORT_TYPE_LABELS[b.tripgo_deal.transport_type]}{" "}
                  {b.tripgo_deal.vehicle_type ? `(${b.tripgo_deal.vehicle_type})` : ""}
                </p>
                <p className="text-xs text-slate-400">
                  تكلفة النقل: {b.transport_cost_price} · سعر البيع: {b.agency_selling_price} · الهامش: {b.margin}
                </p>
              </div>
              <Button type="button" variant="outline" disabled={busyId === b.id} onClick={() => removeBundle(b.id)}>
                فك الربط
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <Modal open={showCreateDeal} onClose={() => setShowCreateDeal(false)} title="إضافة عرض نقل جديد">
        <CreateTripGoDealForm
          agencies={agencies}
          onDone={() => {
            setShowCreateDeal(false);
            load();
          }}
          onCancel={() => setShowCreateDeal(false)}
        />
      </Modal>

      <Modal open={showCreateBundle} onClose={() => setShowCreateBundle(false)} title="ربط تذكرة بعرض نقل">
        <CreateTripGoBundleForm
          tripGoDeals={deals.filter((d) => d.status === "active")}
          onDone={() => {
            setShowCreateBundle(false);
            load();
          }}
          onCancel={() => setShowCreateBundle(false)}
        />
      </Modal>
    </div>
  );
}

function CreateTripGoDealForm({
  agencies,
  onDone,
  onCancel,
}: {
  agencies: AgencyRow[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [agencyId, setAgencyId] = useState(agencies[0]?.id ?? "");
  const [transportType, setTransportType] = useState<TransportType>("private");
  const [vehicleType, setVehicleType] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [capacityTotal, setCapacityTotal] = useState("4");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!agencyId || !pickupDate || !price) {
      setError("الوكالة وتاريخ الاستلام والسعر حقول مطلوبة");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createTripGoDeal({
        agencyId,
        transportType,
        vehicleType: vehicleType || null,
        fromLocation: fromLocation || null,
        toLocation: toLocation || null,
        pickupDate,
        pickupTime: pickupTime || null,
        capacityTotal: Number(capacityTotal) || 1,
        price: Number(price),
        notes: notes || null,
      });
      onDone();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر إضافة عرض النقل", "AdminTripGoTab.createDeal"));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Select
        label="الوكالة / مزود الخدمة"
        value={agencyId}
        onChange={(e) => setAgencyId(e.target.value)}
        options={agencies.map((a) => ({ value: a.id, label: a.name }))}
      />
      <Select
        label="نوع النقل"
        value={transportType}
        onChange={(e) => setTransportType(e.target.value as TransportType)}
        options={[
          { value: "private", label: "🚗 خاص" },
          { value: "shared", label: "🚐 تشاركي" },
        ]}
      />
      <Input label="نوع العربية (اختياري)" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} />
      <Input label="من (مكان الاستلام)" value={fromLocation} onChange={(e) => setFromLocation(e.target.value)} />
      <Input label="إلى" value={toLocation} onChange={(e) => setToLocation(e.target.value)} />
      <Input label="تاريخ الاستلام" type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} />
      <Input label="وقت الاستلام (اختياري)" type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
      <Input label="السعة (عدد المقاعد/العربيات)" type="number" value={capacityTotal} onChange={(e) => setCapacityTotal(e.target.value)} />
      <Input label="سعر التكلفة (USD)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
      <Input label="ملاحظات (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)} />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          إلغاء
        </Button>
        <Button type="button" onClick={submit} disabled={saving}>
          {saving ? "جاري الحفظ..." : "إضافة"}
        </Button>
      </div>
    </div>
  );
}

function CreateTripGoBundleForm({
  tripGoDeals,
  onDone,
  onCancel,
}: {
  tripGoDeals: TripGoDealRow[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [flightDeals, setFlightDeals] = useState<DealRow[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [dealId, setDealId] = useState("");
  const [tripGoDealId, setTripGoDealId] = useState(tripGoDeals[0]?.id ?? "");
  const [sellingPrice, setSellingPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveDeals()
      .then((deals) => {
        setFlightDeals(deals);
        setDealId((prev) => prev || deals[0]?.id || "");
      })
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل عروض الطيران", "AdminTripGoTab.loadDeals")))
      .finally(() => setLoadingDeals(false));
  }, []);

  const selectedTransport = tripGoDeals.find((d) => d.id === tripGoDealId);

  async function submit() {
    if (!dealId || !tripGoDealId || !sellingPrice) {
      setError("لازم تختار عرض الطيران وعرض النقل وتكتب سعر البيع");
      return;
    }
    if (!selectedTransport) {
      setError("عرض النقل ده مش متاح");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createTripGoBundle({
        dealId,
        tripGoDealId,
        transportCostPrice: selectedTransport.price,
        agencySellingPrice: Number(sellingPrice),
      });
      onDone();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر إنشاء الباقة", "AdminTripGoTab.createBundle"));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Select
        label="عرض الطيران"
        value={dealId}
        onChange={(e) => setDealId(e.target.value)}
        placeholder={loadingDeals ? "جاري التحميل..." : undefined}
        options={flightDeals.map((d) => ({
          value: d.id,
          label: `${d.from_airport} ← ${d.to_airport} · ${d.departure_date} · $${d.price}`,
        }))}
      />
      <Select
        label="عرض النقل"
        value={tripGoDealId}
        onChange={(e) => setTripGoDealId(e.target.value)}
        options={tripGoDeals.map((d) => ({
          value: d.id,
          label: `${TRANSPORT_TYPE_LABELS[d.transport_type]} · ${(d.from_location || d.from_airport) ?? "—"} ← ${(d.to_location || d.to_airport) ?? "—"} · $${d.price}`,
        }))}
      />
      {selectedTransport ? (
        <p className="text-xs text-slate-500">تكلفة النقل الحقيقية: {selectedTransport.price} {selectedTransport.currency}</p>
      ) : null}
      <Input
        label="سعر بيع النقل للعميل (شامل هامش الربح)"
        type="number"
        value={sellingPrice}
        onChange={(e) => setSellingPrice(e.target.value)}
      />
      {selectedTransport && sellingPrice ? (
        <p className="text-xs text-emerald-700">
          هامش الربح: {(Number(sellingPrice) - selectedTransport.price).toFixed(2)}
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          إلغاء
        </Button>
        <Button type="button" onClick={submit} disabled={saving}>
          {saving ? "جاري الحفظ..." : "ربط"}
        </Button>
      </div>
    </div>
  );
}
