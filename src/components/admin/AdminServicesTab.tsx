import { useEffect, useState } from "react";

import {
  createAdditionalService,
  fetchAllAdditionalServices,
  setAdditionalServiceActive,
  updateAdditionalService,
  type SaveAdditionalServiceInput,
} from "../../lib/admin";
import { friendlyErrorMessage } from "../../lib/errors";
import type { AdditionalServiceRow } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";

// Every non-TripGo add-on a customer can attach to a regular ticket:
// transport (airport_transfer / private_car / shuttle — unrelated to
// TripGo's hidden-margin bundles), insurance, meet & assist, baggage, etc.
const SERVICE_TYPE_LABELS: Record<AdditionalServiceRow["type"], string> = {
  travel_insurance: "🛡️ تأمين سفر",
  hotel: "🏨 فندق",
  car_rental: "🚙 تأجير سيارة",
  lounge: "🛋️ صالة مطار",
  fast_track: "⚡ Fast Track",
  airport_transfer: "🚐 نقل من/إلى المطار",
  private_car: "🚗 عربية خاصة",
  shuttle: "🚌 شटل تشاركي",
  meet_assist: "🤝 استقبال ومرافقة (Meet & Assist)",
  extra_baggage: "🧳 حقائب زيادة",
  destination_experience: "🌍 تجربة في الوجهة",
};

export function AdminServicesTab() {
  const [services, setServices] = useState<AdditionalServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdditionalServiceRow | null>(null);

  function load() {
    setLoading(true);
    fetchAllAdditionalServices()
      .then(setServices)
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل الخدمات الإضافية", "AdminServicesTab.load")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function toggleActive(service: AdditionalServiceRow) {
    setBusyId(service.id);
    try {
      await setAdditionalServiceActive(service.id, !service.is_active);
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث حالة الخدمة", "AdminServicesTab.toggle"));
    } finally {
      setBusyId(null);
    }
  }

  const active = services.filter((s) => s.is_active);
  const inactive = services.filter((s) => !s.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? "جاري التحميل..." : `${active.length} خدمة مفعّلة، ${inactive.length} متوقفة`}
        </p>
        <Button type="button" onClick={() => setShowCreate(true)}>
          + إضافة خدمة
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {services.length === 0 && !loading ? <p className="text-sm text-slate-400">لسه مفيش خدمات إضافية مضافة.</p> : null}

      <div className="space-y-2">
        {services.map((s) => (
          <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900">
                {SERVICE_TYPE_LABELS[s.type]} — {s.name}
              </p>
              {s.description ? <p className="text-xs text-slate-500">{s.description}</p> : null}
              <p className="text-xs text-slate-400">
                السعر: ${s.price} {s.category ? `· الفئة: ${s.category}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={s.is_active ? "empty_seat" : "default"}>{s.is_active ? "مفعّلة" : "متوقفة"}</Badge>
              <Button type="button" variant="outline" onClick={() => setEditing(s)}>
                تعديل
              </Button>
              <Button type="button" variant="outline" disabled={busyId === s.id} onClick={() => toggleActive(s)}>
                {s.is_active ? "إيقاف" : "تفعيل"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="إضافة خدمة إضافية">
        <ServiceForm
          onCancel={() => setShowCreate(false)}
          onSave={async (input) => {
            await createAdditionalService(input);
          }}
          onDone={() => {
            setShowCreate(false);
            load();
          }}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="تعديل الخدمة">
        {editing ? (
          <ServiceForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              await updateAdditionalService(editing.id, input);
            }}
            onDone={() => {
              setEditing(null);
              load();
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function ServiceForm({
  initial,
  onSave,
  onDone,
  onCancel,
}: {
  initial?: AdditionalServiceRow;
  onSave: (input: SaveAdditionalServiceInput) => Promise<void>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<AdditionalServiceRow["type"]>(initial?.type ?? "airport_transfer");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || !price) {
      setError("اسم الخدمة والسعر حقول مطلوبة");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        type,
        name: name.trim(),
        description: description || null,
        price: Number(price),
        category: category || null,
        isActive,
      });
      onDone();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر حفظ الخدمة", "AdminServicesTab.save"));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <Select
        label="نوع الخدمة"
        value={type}
        onChange={(e) => setType(e.target.value as AdditionalServiceRow["type"])}
        options={Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
      />
      <Input label="اسم الخدمة (يظهر للعميل)" value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="وصف مختصر (اختياري)" value={description} onChange={(e) => setDescription(e.target.value)} />
      <Input label="السعر (USD)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
      <Input label="الفئة (اختياري، مثلاً: نقل / تأمين)" value={category} onChange={(e) => setCategory(e.target.value)} />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        مفعّلة وظاهرة للعميل
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          إلغاء
        </Button>
        <Button type="button" onClick={submit} disabled={saving}>
          {saving ? "جاري الحفظ..." : "حفظ"}
        </Button>
      </div>
    </div>
  );
}
