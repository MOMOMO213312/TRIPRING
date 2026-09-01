import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { useCatalog } from "../hooks/useCatalog";
import { createServiceRequest, fetchAdditionalServices } from "../lib/api";
import {
  packageFinalPrice,
  packageSubtotal,
  resolvePackageItems,
  SERVICE_KEY_ICONS,
  SERVICE_KEY_LABELS,
  SERVICE_PACKAGES,
  type PackageServiceKey,
  type ResolvedPackageItem,
  type ServicePackageDef,
} from "../lib/servicePackages";
import { friendlyErrorMessage } from "../lib/errors";
import { cn, formatPrice, isValidEmail, isValidPhone } from "../lib/utils";
import type { AdditionalServiceRow, ServiceCategory } from "../types/database";

type CategoryDef = {
  id: ServiceCategory;
  title: string;
  subtitle: string;
  icon: string;
  image: string;
};

const CATEGORIES: CategoryDef[] = [
  {
    id: "transport",
    title: "النقل",
    subtitle: "Airport Transfer · Private Car · Shuttle",
    icon: "🚐",
    image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80&auto=format&fit=crop",
  },
  {
    id: "airport",
    title: "المطار",
    subtitle: "Lounge · Fast Track · Meet & Assist",
    icon: "🛄",
    image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80&auto=format&fit=crop",
  },
  {
    id: "destination",
    title: "خدمات الوجهة",
    subtitle: "تجارب وخدمات مرتبطة بوجهتك",
    icon: "🗺️",
    image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80&auto=format&fit=crop",
  },
  {
    id: "insurance",
    title: "تأمين السفر",
    subtitle: "تأمين أساسي أو شامل لرحلتك",
    icon: "🛡️",
    image: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80&auto=format&fit=crop",
  },
];

/** Per-service photo overrides for the "transport" category — keyed by additional_services.type,
 *  so each transport service card shows a distinct photo instead of repeating the category image. */
const TRANSPORT_SERVICE_IMAGES: Record<string, string> = {
  car_rental: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80&auto=format&fit=crop",
  airport_transfer: "https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&q=80&auto=format&fit=crop",
  shuttle: "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800&q=80&auto=format&fit=crop",
  private_car: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80&auto=format&fit=crop",
};

const PACKAGE_IMAGES: Record<ServicePackageDef["id"], string> = {
  vip: "https://images.unsplash.com/photo-1583321500900-82807e458f3c?w=800&q=80&auto=format&fit=crop",
  arrival: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80&auto=format&fit=crop",
  departure: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80&auto=format&fit=crop",
  family: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80&auto=format&fit=crop",
  business: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&q=80&auto=format&fit=crop",
  custom: "https://images.unsplash.com/photo-1553531384-cc64ac80f931?w=800&q=80&auto=format&fit=crop",
};

/** <img> with a graceful icon+gradient fallback if the remote photo fails to load. */
function CoverImage({ src, alt, icon, className }: { src: string; alt: string; icon: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-[#0C7BB3]/15 to-[#0C7BB3]/5 text-4xl",
          className,
        )}
      >
        {icon}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}

type ExploreTab = "services" | "packages";

export function ExplorePage() {
  const catalog = useCatalog();
  const [tab, setTab] = useState<ExploreTab>("services");
  const [services, setServices] = useState<AdditionalServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>("transport");
  const [selectedService, setSelectedService] = useState<AdditionalServiceRow | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<ServicePackageDef | null>(null);
  const [confirmedRequest, setConfirmedRequest] = useState<{ number: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchAdditionalServices();
      if (!cancelled) {
        setServices(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const map: Record<ServiceCategory, AdditionalServiceRow[]> = {
      transport: [],
      airport: [],
      baggage: [],
      destination: [],
      insurance: [],
    };
    for (const s of services) {
      if (s.category && s.category in map) map[s.category as ServiceCategory].push(s);
    }
    return map;
  }, [services]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">استكمل رحلتك عبر TripRing بخدمات إضافية أو باقات متكاملة</h1>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          to="/blue-friday"
          className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-4 transition hover:border-blue-400"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg text-white">
            🔵
          </span>
          <span>
            <span className="block font-bold text-slate-900">الجمعة السماوي</span>
            <span className="block text-xs text-slate-500">خصومات لحد 33% على الطيران — كل جمعة</span>
          </span>
        </Link>
        <Link
          to="/membership"
          className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-[#0C7BB3]/30 bg-[#0C7BB3]/5 p-4 transition hover:border-[#0C7BB3]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#0C7BB3] text-lg text-white">
            👑
          </span>
          <span>
            <span className="block font-bold text-slate-900">عضوية TRIPRING</span>
            <span className="block text-xs text-slate-500">خصومات دائمة + خدمات مجانية + أولوية إشعارات</span>
          </span>
        </Link>
      </div>

      {/* Section switcher — same size/shape as the Membership/Blue Friday cards above */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setTab("services")}
          className={cn(
            "flex items-center gap-3 rounded-2xl border-2 border-dashed p-4 text-start transition",
            tab === "services"
              ? "border-[#0C7BB3] bg-[#0C7BB3]/5"
              : "border-slate-200 bg-slate-50/40 hover:border-slate-300",
          )}
        >
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full text-lg text-white",
              tab === "services" ? "bg-[#0C7BB3]" : "bg-slate-400",
            )}
          >
            🔹
          </span>
          <span>
            <span className="block font-bold text-slate-900">الخدمات</span>
            <span className="block text-xs text-slate-500">اطلب أي خدمة منفردة بسعرها</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab("packages")}
          className={cn(
            "flex items-center gap-3 rounded-2xl border-2 border-dashed p-4 text-start transition",
            tab === "packages"
              ? "border-[#0C7BB3] bg-[#0C7BB3]/5"
              : "border-slate-200 bg-slate-50/40 hover:border-slate-300",
          )}
        >
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full text-lg text-white",
              tab === "packages" ? "bg-[#0C7BB3]" : "bg-slate-400",
            )}
          >
            📦
          </span>
          <span>
            <span className="block font-bold text-slate-900">الباقات</span>
            <span className="block text-xs text-slate-500">باقات متكاملة بسعر أقل من الطلب المنفرد</span>
          </span>
        </button>
      </div>

      {tab === "services" ? (
        <div className="space-y-6">
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-lg">🔹</span>
            <p className="text-sm text-slate-600">
              <span className="font-bold text-slate-900">خدمة منفردة:</span> اطلب أي خدمة لوحدها بسعرها،
              من غير ما تحجز باقي، وحتى لو تذكرتك محجوزة من مكان تاني خالص.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl border px-3 py-4 text-center transition",
                  activeCategory === cat.id
                    ? "border-[#0C7BB3] bg-[#0C7BB3]/5 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300",
                )}
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className={cn("text-sm font-bold", activeCategory === cat.id ? "text-[#0C7BB3]" : "text-slate-900")}>
                  {cat.title}
                </span>
                <span className="text-[11px] leading-tight text-slate-500">{cat.subtitle}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-slate-500">جاري تحميل الخدمات...</p>
          ) : grouped[activeCategory].length === 0 ? (
            <Card className="text-center text-slate-500">لا توجد خدمات متاحة في هذا القسم حالياً</Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grouped[activeCategory].map((service) => {
                const cat = CATEGORIES.find((c) => c.id === activeCategory) ?? CATEGORIES[0];
                const cardImage = TRANSPORT_SERVICE_IMAGES[service.type] ?? cat.image;
                return (
                  <Card key={service.id} className="flex flex-col overflow-hidden !p-0">
                    <div className="h-32 w-full overflow-hidden">
                      <CoverImage src={cardImage} alt={service.name} icon={cat.icon} />
                    </div>
                    <div className="flex flex-1 flex-col justify-between gap-4 p-4">
                      <div>
                        <div className="mb-1 flex items-center gap-1.5">
                          <Badge className="!bg-slate-100 !text-slate-600">خدمة منفردة</Badge>
                        </div>
                        <h3 className="font-bold text-slate-900">{service.name}</h3>
                        {service.description ? (
                          <p className="mt-1 text-sm text-slate-600">{service.description}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-extrabold text-[#0C7BB3]">
                          {service.price > 0 ? formatPrice(service.price) : "مجاناً"}
                        </span>
                        <Button onClick={() => setSelectedService(service)}>احجز الآن</Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-lg">🔸</span>
            <p className="text-sm text-slate-600">
              <span className="font-bold text-slate-900">باقة جاهزة:</span> بتجمع أكتر من خدمة في منتج
              واحد بسعر إجمالي أوفر من طلب كل خدمة لوحدها.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICE_PACKAGES.map((pkg) => {
              const items = resolvePackageItems(pkg.includedKeys, services);
              const subtotal = packageSubtotal(items);
              const finalPrice = packageFinalPrice(items, pkg.discountPercent);
              const savings = Math.max(0, Math.round((subtotal - finalPrice) * 100) / 100);

              return (
                <Card key={pkg.id} className="flex flex-col overflow-hidden !p-0">
                  <div className="relative h-36 w-full overflow-hidden">
                    <CoverImage src={PACKAGE_IMAGES[pkg.id]} alt={pkg.title} icon={pkg.icon} />
                    {pkg.badge ? (
                      <span className="absolute right-3 top-3 rounded-full bg-[#0C7BB3] px-2.5 py-1 text-[11px] font-bold text-white shadow">
                        {pkg.badge}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-4 p-4">
                    <div>
                      <div className="mb-1 flex items-center gap-1.5">
                        <Badge tone="special_fare">باقة</Badge>
                        {savings > 0 ? <Badge tone="savings">وفّر {formatPrice(savings)}</Badge> : null}
                      </div>
                      <h3 className="flex items-center gap-1.5 font-bold text-slate-900">
                        <span>{pkg.icon}</span>
                        {pkg.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">{pkg.subtitle}</p>
                      {!pkg.isCustom ? (
                        <ul className="mt-3 space-y-1">
                          {items.map((item) => (
                            <li key={item.key} className="flex items-center gap-1.5 text-xs text-slate-600">
                              <span>{item.icon}</span>
                              {item.label}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between">
                      {pkg.isCustom ? (
                        <span className="text-sm font-semibold text-slate-500">يبدأ حسب اختيارك</span>
                      ) : (
                        <span className="text-lg font-extrabold text-[#0C7BB3]">{formatPrice(finalPrice)}</span>
                      )}
                      <Button onClick={() => setSelectedPackage(pkg)}>استكشف الباقة</Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {selectedService ? (
        <ServiceRequestModal
          service={selectedService}
          airports={catalog.airports.map((a) => ({ value: a.code, label: `${a.city} (${a.code})` }))}
          airlines={catalog.airlines.map((a) => ({ value: a.name, label: a.name }))}
          onClose={() => setSelectedService(null)}
          onSuccess={(number, total) => {
            setSelectedService(null);
            setConfirmedRequest({ number, total });
          }}
        />
      ) : null}

      {selectedPackage ? (
        <PackageRequestModal
          pkg={selectedPackage}
          services={services}
          airports={catalog.airports.map((a) => ({ value: a.code, label: `${a.city} (${a.code})` }))}
          airlines={catalog.airlines.map((a) => ({ value: a.name, label: a.name }))}
          onClose={() => setSelectedPackage(null)}
          onSuccess={(number, total) => {
            setSelectedPackage(null);
            setConfirmedRequest({ number, total });
          }}
        />
      ) : null}

      {confirmedRequest ? (
        <Modal open onClose={() => setConfirmedRequest(null)} title="تم إرسال طلبك">
          <div className="space-y-3 text-sm">
            <p className="text-slate-700">
              رقم الطلب <span className="font-mono font-bold">#{confirmedRequest.number}</span> — هيتواصل معاك
              فريقنا قريباً لتأكيد التفاصيل والدفع.
            </p>
            <p className="font-semibold text-slate-900">الإجمالي: {formatPrice(confirmedRequest.total)}</p>
            <Button fullWidth onClick={() => setConfirmedRequest(null)}>
              تمام
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/** Shared trip-context + contact fields used by both the single-service and package request forms. */
function TripContactFields({
  airports,
  airlines,
  airline,
  setAirline,
  flightNumber,
  setFlightNumber,
  flightDate,
  setFlightDate,
  arrivalTime,
  setArrivalTime,
  airport,
  setAirport,
  destination,
  setDestination,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerEmail,
  setCustomerEmail,
  notes,
  setNotes,
}: {
  airports: { value: string; label: string }[];
  airlines: { value: string; label: string }[];
  airline: string;
  setAirline: (v: string) => void;
  flightNumber: string;
  setFlightNumber: (v: string) => void;
  flightDate: string;
  setFlightDate: (v: string) => void;
  arrivalTime: string;
  setArrivalTime: (v: string) => void;
  airport: string;
  setAirport: (v: string) => void;
  destination: string;
  setDestination: (v: string) => void;
  customerName: string;
  setCustomerName: (v: string) => void;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;
  customerEmail: string;
  setCustomerEmail: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
}) {
  return (
    <>
      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
        <Badge>اختياري</Badge> مش لازم تكون حاجز تذكرتك من TripRing — تقدر تدخل تفاصيل رحلتك من أي مصدر عشان
        نربط الطلب بيها.
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="شركة الطيران"
          value={airline}
          onChange={(e) => setAirline(e.target.value)}
          options={airlines}
          placeholder="اختر (اختياري)"
        />
        <Input
          label="رقم الرحلة"
          placeholder="مثال: MS 123"
          value={flightNumber}
          onChange={(e) => setFlightNumber(e.target.value)}
        />
        <Input label="تاريخ الرحلة" type="date" value={flightDate} onChange={(e) => setFlightDate(e.target.value)} />
        <Input
          label="وقت الوصول"
          type="time"
          value={arrivalTime}
          onChange={(e) => setArrivalTime(e.target.value)}
        />
        <Select
          label="المطار"
          value={airport}
          onChange={(e) => setAirport(e.target.value)}
          options={airports}
          placeholder="اختر (اختياري)"
        />
        <Input
          label="الوجهة"
          placeholder="مثال: جدة"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
      </div>

      <div className="space-y-3 border-t border-slate-100 pt-4">
        <Input label="الاسم" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        <Input
          label="رقم الهاتف"
          type="tel"
          required
          placeholder="+20xxxxxxxxxx"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
        />
        <Input
          label="البريد الإلكتروني (اختياري)"
          type="email"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
        />
        <Input label="ملاحظات (اختياري)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </>
  );
}

function useTripContactFieldsState() {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [airline, setAirline] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [flightDate, setFlightDate] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [airport, setAirport] = useState("");
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): boolean {
    setError(null);
    if (!customerName.trim()) {
      setError("أدخل اسمك");
      return false;
    }
    if (!isValidPhone(customerPhone)) {
      setError("رقم الهاتف غير صالح — أدخله بالصيغة الدولية مثل +20xxxxxxxxxx");
      return false;
    }
    if (customerEmail.trim() && !isValidEmail(customerEmail)) {
      setError("البريد الإلكتروني غير صالح");
      return false;
    }
    return true;
  }

  return {
    customerName, setCustomerName,
    customerPhone, setCustomerPhone,
    customerEmail, setCustomerEmail,
    airline, setAirline,
    flightNumber, setFlightNumber,
    flightDate, setFlightDate,
    arrivalTime, setArrivalTime,
    airport, setAirport,
    destination, setDestination,
    notes, setNotes,
    submitting, setSubmitting,
    error, setError,
    validate,
  };
}

function ServiceRequestModal({
  service,
  airports,
  airlines,
  onClose,
  onSuccess,
}: {
  service: AdditionalServiceRow;
  airports: { value: string; label: string }[];
  airlines: { value: string; label: string }[];
  onClose: () => void;
  onSuccess: (requestNumber: number, total: number) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const f = useTripContactFieldsState();

  const total = Math.round(service.price * quantity * 100) / 100;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!f.validate()) return;
    f.setSubmitting(true);
    try {
      const row = await createServiceRequest({
        serviceId: service.id,
        serviceType: service.type,
        serviceName: service.name,
        unitPrice: service.price,
        quantity,
        customerName: f.customerName.trim(),
        customerPhone: f.customerPhone.trim(),
        customerEmail: f.customerEmail.trim() || null,
        airline: f.airline || null,
        flightNumber: f.flightNumber.trim() || null,
        flightDate: f.flightDate || null,
        arrivalTime: f.arrivalTime || null,
        airport: f.airport || null,
        destination: f.destination.trim() || null,
        notes: f.notes.trim() || null,
      });
      onSuccess(row.request_number, row.total_price);
    } catch (err) {
      f.setError(friendlyErrorMessage(err, "فشل إرسال الطلب، جرّب تاني.", "ExplorePage.submitRequest"));
    } finally {
      f.setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={service.name}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {service.description ? <p className="text-sm text-slate-600">{service.description}</p> : null}

        <Input
          label="الكمية"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
        />

        <TripContactFields airports={airports} airlines={airlines} {...f} />

        <div className="flex items-center justify-between rounded-xl bg-[#0C7BB3]/5 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">الإجمالي</span>
          <span className="text-lg font-extrabold text-[#0C7BB3]">{formatPrice(total)}</span>
        </div>

        {f.error ? <p className="text-sm text-red-600">{f.error}</p> : null}

        <Button type="submit" fullWidth disabled={f.submitting}>
          {f.submitting ? "جاري الإرسال..." : "تأكيد الطلب"}
        </Button>
      </form>
    </Modal>
  );
}

function PackageRequestModal({
  pkg,
  services,
  airports,
  airlines,
  onClose,
  onSuccess,
}: {
  pkg: ServicePackageDef;
  services: AdditionalServiceRow[];
  airports: { value: string; label: string }[];
  airlines: { value: string; label: string }[];
  onClose: () => void;
  onSuccess: (requestNumber: number, total: number) => void;
}) {
  const allKeys = Object.keys(SERVICE_KEY_LABELS) as PackageServiceKey[];
  const [customKeys, setCustomKeys] = useState<Set<PackageServiceKey>>(
    () => new Set(pkg.isCustom ? [] : pkg.includedKeys),
  );
  const f = useTripContactFieldsState();

  const activeKeys = pkg.isCustom ? Array.from(customKeys) : pkg.includedKeys;
  const items: ResolvedPackageItem[] = resolvePackageItems(activeKeys, services);
  const subtotal = packageSubtotal(items);
  const total = packageFinalPrice(items, pkg.discountPercent);
  const savings = Math.max(0, Math.round((subtotal - total) * 100) / 100);

  function toggleCustomKey(key: PackageServiceKey) {
    setCustomKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (items.length === 0) {
      f.setError("اختار خدمة واحدة على الأقل عشان تكوّن باقتك");
      return;
    }
    if (!f.validate()) return;
    f.setSubmitting(true);
    try {
      const includedLabels = items.map((i) => i.label).join(" + ");
      const row = await createServiceRequest({
        serviceId: `package:${pkg.id}`,
        serviceType: "package",
        serviceName: `${pkg.title} (${includedLabels})`,
        unitPrice: total,
        quantity: 1,
        customerName: f.customerName.trim(),
        customerPhone: f.customerPhone.trim(),
        customerEmail: f.customerEmail.trim() || null,
        airline: f.airline || null,
        flightNumber: f.flightNumber.trim() || null,
        flightDate: f.flightDate || null,
        arrivalTime: f.arrivalTime || null,
        airport: f.airport || null,
        destination: f.destination.trim() || null,
        notes: [f.notes.trim(), `باقة تشمل: ${includedLabels}`].filter(Boolean).join(" — "),
      });
      onSuccess(row.request_number, row.total_price);
    } catch (err) {
      f.setError(friendlyErrorMessage(err, "فشل إرسال الطلب، جرّب تاني.", "ExplorePage.submitRequest"));
    } finally {
      f.setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${pkg.icon} ${pkg.title}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600">{pkg.subtitle}</p>

        <div className="rounded-xl border border-[#0C7BB3]/20 bg-[#0C7BB3]/5 p-3">
          <p className="mb-2 text-xs font-bold text-slate-700">
            {pkg.isCustom ? "اختار الخدمات اللي تدخل في باقتك:" : "الخدمات المشمولة في الباقة:"}
          </p>
          <div className="space-y-1.5">
            {(pkg.isCustom ? allKeys : pkg.includedKeys).map((key) => {
              const checked = pkg.isCustom ? customKeys.has(key) : true;
              const item = items.find((i) => i.key === key);
              return (
                <label key={key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    {pkg.isCustom ? (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCustomKey(key)}
                      />
                    ) : (
                      <span className="text-[#16A34A]">✓</span>
                    )}
                    <span>{SERVICE_KEY_ICONS[key]}</span>
                    {SERVICE_KEY_LABELS[key]}
                  </span>
                  {item ? <span className="text-xs text-slate-500">{formatPrice(item.price)}</span> : null}
                </label>
              );
            })}
          </div>
        </div>

        <TripContactFields airports={airports} airlines={airlines} {...f} />

        <div className="space-y-1 rounded-xl bg-[#0C7BB3]/5 px-4 py-3">
          {savings > 0 ? (
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>سعر الخدمات منفردة</span>
              <span className="line-through">{formatPrice(subtotal)}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">إجمالي الباقة</span>
            <span className="text-lg font-extrabold text-[#0C7BB3]">{formatPrice(total)}</span>
          </div>
          {savings > 0 ? (
            <p className="text-xs font-semibold text-[#16A34A]">وفّرت {formatPrice(savings)} مقارنة بالطلب منفرد</p>
          ) : null}
        </div>

        {f.error ? <p className="text-sm text-red-600">{f.error}</p> : null}

        <Button type="submit" fullWidth disabled={f.submitting}>
          {f.submitting ? "جاري الإرسال..." : "تأكيد حجز الباقة"}
        </Button>
      </form>
    </Modal>
  );
}
