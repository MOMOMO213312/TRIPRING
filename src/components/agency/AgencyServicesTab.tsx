import { useEffect, useState } from "react";

import { fetchMyAgency } from "../../lib/agency";
import { friendlyErrorMessage } from "../../lib/errors";
import {
  PROVIDER_TYPE_CATEGORY,
  PROVIDER_TYPE_LABELS,
  PROVIDER_TYPE_SERVICE_TYPES,
  activateMyProviderCategory,
  createMyService,
  deleteMyService,
  fetchMyProviders,
  fetchMyServices,
  updateMyService,
} from "../../lib/serviceProviders";
import { formatPrice } from "../../lib/utils";
import type { AdditionalServiceRow, ProviderType, ServiceProviderRow } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

export function AgencyServicesTab({ agencyId }: { agencyId: string }) {
  const [allowedCategories, setAllowedCategories] = useState<ProviderType[]>([]);
  const [providers, setProviders] = useState<ServiceProviderRow[]>([]);
  const [services, setServices] = useState<AdditionalServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const agency = await fetchMyAgency(agencyId);
      const allowed = agency?.allowed_categories ?? [];
      setAllowedCategories(allowed);
      const myProviders = await fetchMyProviders(agencyId);
      setProviders(myProviders);
      const myServices = await fetchMyServices(myProviders.map((p) => p.id));
      setServices(myServices);
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحميل خدماتك", "AgencyServicesTab.load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  if (loading) return <p className="py-8 text-center text-sm text-slate-500">جاري التحميل...</p>;

  if (allowedCategories.length === 0) {
    return (
      <Card className="text-center text-sm text-slate-500">
        لسه إدارة TripRing ما فتحتش أي فئة خدمات لوكالتك (نقل، سياحة، تأمين، خدمات أرضية، مطار). تواصل معاهم لتفعيل
        الفئة المناسبة لنشاطك.
      </Card>
    );
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        الخدمات اللي تضيفها هنا بتظهر للعملاء فورًا (بدون مراجعة من الأدمن)، وبتُحسب من إيراداتك كوكالة.
      </p>
      {allowedCategories.map((category) => {
        const provider = providers.find((p) => p.provider_type === category);
        const categoryServices = provider ? services.filter((s) => s.provider_id === provider.id) : [];
        return (
          <CategorySection
            key={category}
            agencyId={agencyId}
            category={category}
            provider={provider ?? null}
            services={categoryServices}
            onRefresh={reload}
          />
        );
      })}
    </div>
  );
}

function CategorySection({
  agencyId,
  category,
  provider,
  services,
  onRefresh,
}: {
  agencyId: string;
  category: ProviderType;
  provider: ServiceProviderRow | null;
  services: AdditionalServiceRow[];
  onRefresh: () => void;
}) {
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function activate() {
    setActivating(true);
    setError(null);
    try {
      await activateMyProviderCategory(agencyId, category, PROVIDER_TYPE_LABELS[category]);
      onRefresh();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تفعيل الفئة دي", "AgencyServicesTab.activate"));
    } finally {
      setActivating(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900">{PROVIDER_TYPE_LABELS[category]}</h3>
        {provider ? (
          <Button type="button" variant="outline" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "إلغاء" : "+ إضافة خدمة"}
          </Button>
        ) : (
          <Button type="button" disabled={activating} onClick={activate}>
            {activating ? "جاري التفعيل..." : "تفعيل هذه الفئة"}
          </Button>
        )}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {!provider ? (
        <p className="text-xs text-slate-400">فعّل الفئة عشان تبدأ تضيف خدماتك فيها.</p>
      ) : (
        <>
          {services.length === 0 ? (
            <p className="text-xs text-slate-400">لسه مفيش خدمات مضافة في الفئة دي.</p>
          ) : (
            <ul className="space-y-2">
              {services.map((s) => (
                <ServiceRow key={s.id} service={s} onRefresh={onRefresh} />
              ))}
            </ul>
          )}

          {showForm ? (
            <ServiceForm
              providerId={provider.id}
              category={category}
              onDone={() => {
                setShowForm(false);
                onRefresh();
              }}
              onCancel={() => setShowForm(false)}
            />
          ) : null}
        </>
      )}
    </Card>
  );
}

function ServiceRow({ service, onRefresh }: { service: AdditionalServiceRow; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive() {
    setBusy(true);
    setError(null);
    try {
      await updateMyService(service.id, { isActive: !service.is_active });
      onRefresh();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث الخدمة", "AgencyServicesTab.toggle"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`متأكد من حذف "${service.name}"؟`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteMyService(service.id);
      onRefresh();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر حذف الخدمة", "AgencyServicesTab.delete"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 p-2">
      <div>
        <p className="text-sm font-medium text-slate-900">
          {service.name} <span className="text-slate-400">— {formatPrice(service.price)}</span>
        </p>
        {service.description ? <p className="text-xs text-slate-500">{service.description}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={service.is_active ? "savings" : "default"}>{service.is_active ? "مفعّلة" : "متوقفة"}</Badge>
        <Button type="button" variant="outline" disabled={busy} onClick={toggleActive}>
          {service.is_active ? "إيقاف" : "تفعيل"}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={remove}>
          حذف
        </Button>
      </div>
      {error ? <p className="w-full text-xs text-red-600">{error}</p> : null}
    </li>
  );
}

function ServiceForm({
  providerId,
  category,
  onDone,
  onCancel,
}: {
  providerId: string;
  category: ProviderType;
  onDone: () => void;
  onCancel: () => void;
}) {
  const typeOptions = PROVIDER_TYPE_SERVICE_TYPES[category];
  const [type, setType] = useState(typeOptions[0]?.value ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const priceNum = Number(price);
    if (!name.trim() || Number.isNaN(priceNum) || priceNum < 0) {
      setError("اكتب اسم الخدمة وسعر صحيح");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createMyService({
        providerId,
        providerType: category,
        type: type as AdditionalServiceRow["type"],
        name: name.trim(),
        description: description.trim() || null,
        price: priceNum,
      });
      onDone();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر إضافة الخدمة", "AgencyServicesTab.create"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg bg-slate-50 p-3">
      <Select
        label="نوع الخدمة"
        value={type}
        onChange={(e) => setType(e.target.value)}
        options={typeOptions.map((t) => ({ value: t.value, label: t.label }))}
      />
      <Input label="اسم الخدمة (يظهر للعميل)" value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="الوصف (اختياري)" value={description} onChange={(e) => setDescription(e.target.value)} />
      <Input label="السعر (USD)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          إلغاء
        </Button>
        <Button type="button" disabled={saving} onClick={submit}>
          {saving ? "جاري الحفظ..." : "إضافة"}
        </Button>
      </div>
    </div>
  );
}

// re-exported for potential future use (e.g. category badge elsewhere)
export { PROVIDER_TYPE_CATEGORY };
