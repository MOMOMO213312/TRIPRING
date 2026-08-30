import { useEffect, useState } from "react";

import {
  createTransportZone,
  createTripGoBundle,
  createTripGoDeal,
  deleteTransportZone,
  deleteTripGoBundle,
  fetchAgencyTransportZones,
  fetchAgencyTripGoBundles,
  fetchAgencyTripGoDeals,
  setTransportZoneActive,
  setTripGoDealStatus,
  transferKindLabel,
  type TransportZoneFormInput,
  type TripGoDealFormInput,
} from "../../lib/tripgo";
import { fetchAgencyDeals } from "../../lib/agency";
import { formatPrice } from "../../lib/utils";
import type { DealRow, TransportZoneRow, TripGoBundleJoined, TripGoDealRow } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const BLANK_ZONE_FORM: TransportZoneFormInput = {
  airportCode: "",
  zoneName: "",
  priceAddon: 0,
  currency: "EGP",
};

const BLANK_FORM: TripGoDealFormInput = {
  transportType: "private",
  vehicleType: "",
  fromAirport: null,
  fromLocation: "",
  toAirport: null,
  toLocation: "",
  pickupDate: "",
  pickupTime: "",
  capacityTotal: 1,
  price: 0,
  currency: "USD",
  durationMinutes: null,
  notes: "",
};

export function AgencyTripGoTab({ agencyId }: { agencyId: string }) {
  const [section, setSection] = useState<"deals" | "bundles" | "zones">("deals");
  const [tripgoDeals, setTripgoDeals] = useState<TripGoDealRow[]>([]);
  const [bundles, setBundles] = useState<TripGoBundleJoined[]>([]);
  const [flightDeals, setFlightDeals] = useState<DealRow[]>([]);
  const [zones, setZones] = useState<TransportZoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TripGoDealFormInput>(BLANK_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Instant zone (private-car add-on) management
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [zoneForm, setZoneForm] = useState<TransportZoneFormInput>(BLANK_ZONE_FORM);

  // Bundle creation
  const [bundleDealId, setBundleDealId] = useState("");
  const [bundleTripGoDealId, setBundleTripGoDealId] = useState("");
  const [bundleSellingPrice, setBundleSellingPrice] = useState<number>(0);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [td, b, fd, z] = await Promise.all([
        fetchAgencyTripGoDeals(agencyId),
        fetchAgencyTripGoBundles(agencyId),
        fetchAgencyDeals(agencyId),
        fetchAgencyTransportZones(agencyId),
      ]);
      setTripgoDeals(td);
      setBundles(b);
      setFlightDeals(fd.filter((d) => d.status === "active"));
      setZones(z);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل بيانات TripGo");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  async function handleCreateTripGoDeal() {
    setSubmitting(true);
    setError(null);
    try {
      await createTripGoDeal(agencyId, form);
      setForm(BLANK_FORM);
      setShowForm(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء عرض النقل");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleTripGoDealStatus(deal: TripGoDealRow) {
    try {
      await setTripGoDealStatus(deal.id, deal.status === "active" ? "cancelled" : "active");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث الحالة");
    }
  }

  async function handleCreateBundle() {
    if (!bundleDealId || !bundleTripGoDealId) {
      setError("اختر عرض الرحلة وعرض النقل");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createTripGoBundle(bundleDealId, bundleTripGoDealId, bundleSellingPrice);
      setBundleDealId("");
      setBundleTripGoDealId("");
      setBundleSellingPrice(0);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء الباقة");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteBundle(bundleId: string) {
    try {
      await deleteTripGoBundle(bundleId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف الباقة");
    }
  }

  async function handleCreateZone() {
    if (!zoneForm.airportCode.trim() || !zoneForm.zoneName.trim()) {
      setError("اختر المطار واكتب اسم المنطقة");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createTransportZone(agencyId, zoneForm);
      setZoneForm(BLANK_ZONE_FORM);
      setShowZoneForm(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إنشاء المنطقة");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleZoneActive(zone: TransportZoneRow) {
    try {
      await setTransportZoneActive(zone.id, !zone.is_active);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحديث المنطقة");
    }
  }

  async function handleDeleteZone(zoneId: string) {
    try {
      await deleteTransportZone(zoneId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف المنطقة");
    }
  }

  const activeTripgoDeals = tripgoDeals.filter((d) => d.status === "active");

  if (loading) return <div className="py-10 text-center text-sm text-slate-500">جاري التحميل...</div>;

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setSection("deals")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            section === "deals" ? "bg-[#0C7BB3] text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          عروض النقل
        </button>
        <button
          type="button"
          onClick={() => setSection("bundles")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            section === "bundles" ? "bg-[#0C7BB3] text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          باقات TripGo (تذكرة + نقل)
        </button>
        <button
          type="button"
          onClick={() => setSection("zones")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            section === "zones" ? "bg-[#0C7BB3] text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          🚗 TripGo الفوري (مناطق)
        </button>
      </div>

      {section === "deals" ? (
        <div className="space-y-4">
          {!showForm ? (
            <Button onClick={() => setShowForm(true)}>+ إضافة عرض نقل جديد</Button>
          ) : (
            <Card className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="نوع النقل"
                  value={form.transportType}
                  onChange={(e) => setForm({ ...form, transportType: e.target.value as "private" | "shared" })}
                  options={[
                    { value: "private", label: "🚗 عربية خاصة" },
                    { value: "shared", label: "🚐 نقل تشاركي" },
                  ]}
                />
                <Input
                  label="نوع المركبة (اختياري)"
                  placeholder="مثال: سيدان، فان 14 راكب"
                  value={form.vehicleType ?? ""}
                  onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                />
                <Input
                  label="من (منطقة/موقع)"
                  value={form.fromLocation ?? ""}
                  onChange={(e) => setForm({ ...form, fromLocation: e.target.value })}
                />
                <Input
                  label="إلى (مطار)"
                  placeholder="مثال: CAI"
                  value={form.toAirport ?? ""}
                  onChange={(e) => setForm({ ...form, toAirport: e.target.value.toUpperCase() })}
                />
                <Input
                  label="تاريخ التوفر"
                  type="date"
                  required
                  value={form.pickupDate}
                  onChange={(e) => setForm({ ...form, pickupDate: e.target.value })}
                />
                <Input
                  label="وقت الاستلام (اختياري)"
                  type="time"
                  value={form.pickupTime ?? ""}
                  onChange={(e) => setForm({ ...form, pickupTime: e.target.value })}
                />
                <Input
                  label={form.transportType === "private" ? "عدد السيارات المتاحة" : "إجمالي المقاعد"}
                  type="number"
                  min={1}
                  value={form.capacityTotal}
                  onChange={(e) => setForm({ ...form, capacityTotal: Number(e.target.value) })}
                />
                <Input
                  label={form.transportType === "private" ? "سعر السيارة الكاملة" : "سعر المقعد الواحد"}
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateTripGoDeal} disabled={submitting}>
                  {submitting ? "جاري الحفظ..." : "حفظ عرض النقل"}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  إلغاء
                </Button>
              </div>
            </Card>
          )}

          <div className="space-y-3">
            {tripgoDeals.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">لا توجد عروض نقل بعد</p>
            ) : (
              tripgoDeals.map((d) => (
                <Card key={d.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{transferKindLabel(d.transport_type, d.vehicle_type)}</span>
                      <Badge tone={d.status === "active" ? "empty_seat" : "urgent"}>
                        {d.status === "active" ? "نشط" : d.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">
                      {d.from_location ?? "—"} → {d.to_airport ?? d.to_location ?? "—"} · {d.pickup_date} ·{" "}
                      {formatPrice(d.price, d.currency)} · متاح: {d.capacity_available}/{d.capacity_total}
                    </p>
                  </div>
                  <Button variant={d.status === "active" ? "secondary" : "primary"} onClick={() => toggleTripGoDealStatus(d)}>
                    {d.status === "active" ? "إيقاف" : "تفعيل"}
                  </Button>
                </Card>
              ))
            )}
          </div>
        </div>
      ) : section === "bundles" ? (
        <div className="space-y-4">
          <Card className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">إنشاء باقة (ربط عرض رحلة بعرض نقل)</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Select
                label="عرض الرحلة"
                value={bundleDealId}
                onChange={(e) => setBundleDealId(e.target.value)}
                placeholder="اختر رحلة"
                options={flightDeals.map((d) => ({
                  value: d.id,
                  label: `${d.from_airport} → ${d.to_airport} · ${d.departure_date}`,
                }))}
              />
              <Select
                label="عرض النقل"
                value={bundleTripGoDealId}
                onChange={(e) => setBundleTripGoDealId(e.target.value)}
                placeholder="اختر عرض نقل نشط"
                options={activeTripgoDeals.map((d) => ({
                  value: d.id,
                  label: `${transferKindLabel(d.transport_type, d.vehicle_type)} · ${formatPrice(d.price, d.currency)}`,
                }))}
              />
              <Input
                label="سعر بيعك لخدمة النقل (هامشك الحر)"
                type="number"
                min={0}
                value={bundleSellingPrice}
                onChange={(e) => setBundleSellingPrice(Number(e.target.value))}
              />
            </div>
            <Button onClick={handleCreateBundle} disabled={submitting}>
              {submitting ? "جاري الإنشاء..." : "+ إنشاء باقة TripGo"}
            </Button>
          </Card>

          <div className="space-y-3">
            {bundles.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">لا توجد باقات TripGo بعد</p>
            ) : (
              bundles.map((b) => (
                <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900">
                      {b.deal.from_airport} → {b.deal.to_airport} + {transferKindLabel(b.tripgo_deal.transport_type, b.tripgo_deal.vehicle_type)}
                    </p>
                    <p className="text-sm text-slate-600">
                      تكلفة النقل: {formatPrice(b.transport_cost_price ?? 0, b.tripgo_deal.currency)} · سعر بيعك:{" "}
                      {formatPrice(b.agency_selling_price ?? 0, b.tripgo_deal.currency)} ·{" "}
                      <span className="font-bold text-[#16A34A]">هامشك: {formatPrice(b.margin ?? 0, b.tripgo_deal.currency)}</span>
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => handleDeleteBundle(b.id)}>
                    حذف الباقة
                  </Button>
                </Card>
              ))
            )}
          </div>
        </div>
      ) : null}

      {section === "zones" ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            عربية خاصة فورية لأي عرض رحلة نشط عندك — من غير جدولة أو سعة مسبقة. حدد سعر إضافي ثابت لكل منطقة
            انطلاق، وهيظهر للعميل كخيار وقت الحجز على أي رحلة مغادرة من نفس المطار.
          </p>
          {!showZoneForm ? (
            <Button onClick={() => setShowZoneForm(true)}>+ إضافة منطقة جديدة</Button>
          ) : (
            <Card className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="مطار المغادرة (كود)"
                  placeholder="مثال: CAI"
                  value={zoneForm.airportCode}
                  onChange={(e) => setZoneForm({ ...zoneForm, airportCode: e.target.value.toUpperCase() })}
                />
                <Input
                  label="اسم المنطقة"
                  placeholder="مثال: مدينة نصر"
                  value={zoneForm.zoneName}
                  onChange={(e) => setZoneForm({ ...zoneForm, zoneName: e.target.value })}
                />
                <Input
                  label="السعر الإضافي"
                  type="number"
                  min={0}
                  value={zoneForm.priceAddon}
                  onChange={(e) => setZoneForm({ ...zoneForm, priceAddon: Number(e.target.value) })}
                />
                <Input
                  label="العملة"
                  value={zoneForm.currency}
                  onChange={(e) => setZoneForm({ ...zoneForm, currency: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateZone} disabled={submitting}>
                  {submitting ? "جاري الحفظ..." : "حفظ المنطقة"}
                </Button>
                <Button variant="outline" onClick={() => setShowZoneForm(false)}>
                  إلغاء
                </Button>
              </div>
            </Card>
          )}

          <div className="space-y-3">
            {zones.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">لا توجد مناطق بعد</p>
            ) : (
              zones.map((z) => (
                <Card key={z.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">
                        {z.airport_code} · {z.zone_name}
                      </span>
                      <Badge tone={z.is_active ? "empty_seat" : "urgent"}>{z.is_active ? "نشط" : "متوقف"}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">+{formatPrice(z.price_addon, z.currency)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant={z.is_active ? "secondary" : "primary"} onClick={() => toggleZoneActive(z)}>
                      {z.is_active ? "إيقاف" : "تفعيل"}
                    </Button>
                    <Button variant="secondary" onClick={() => handleDeleteZone(z.id)}>
                      حذف
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
