import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { Select } from "../components/ui/Select";
import { useCatalog } from "../hooks/useCatalog";
import { createServiceRequest, fetchAdditionalServices } from "../lib/api";
import { cn, formatPrice, isValidEmail, isValidPhone } from "../lib/utils";
import type { AdditionalServiceRow, ServiceCategory } from "../types/database";

type CategoryDef = {
  id: ServiceCategory;
  title: string;
  subtitle: string;
  icon: string;
};

const CATEGORIES: CategoryDef[] = [
  { id: "transport", title: "النقل", subtitle: "Airport Transfer · Private Car · Shuttle", icon: "🚐" },
  { id: "airport", title: "المطار", subtitle: "Lounge · Fast Track · Meet & Assist", icon: "🛄" },
  { id: "baggage", title: "الأمتعة", subtitle: "Additional Baggage · Baggage Services", icon: "🧳" },
  { id: "destination", title: "خدمات الوجهة", subtitle: "تجارب وخدمات مرتبطة بوجهتك", icon: "🗺️" },
];

export function ExplorePage() {
  const catalog = useCatalog();
  const [services, setServices] = useState<AdditionalServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>("transport");
  const [selectedService, setSelectedService] = useState<AdditionalServiceRow | null>(null);
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
    };
    for (const s of services) {
      if (s.category && s.category in map) map[s.category as ServiceCategory].push(s);
    }
    return map;
  }, [services]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">استكشف خدمات رحلتك</h1>
        <p className="mt-1 max-w-2xl text-slate-600">
          حتى لو اشتريت تذكرتك من شركة طيران أو وكالة تانية، تقدر تجهّز باقي رحلتك من هنا — انتقال من
          وإلى المطار، صالات، Fast Track، أمتعة إضافية، وتجارب في وجهتك.
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
          {grouped[activeCategory].map((service) => (
            <Card key={service.id} className="flex flex-col justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900">{service.name}</h3>
                {service.description ? (
                  <p className="mt-1 text-sm text-slate-600">{service.description}</p>
                ) : null}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-extrabold text-[#0C7BB3]">
                  {service.price > 0 ? formatPrice(service.price) : "مجاناً"}
                </span>
                <Button onClick={() => setSelectedService(service)}>اطلب الخدمة</Button>
              </div>
            </Card>
          ))}
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

  const total = Math.round(service.price * quantity * 100) / 100;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!customerName.trim()) {
      setError("أدخل اسمك");
      return;
    }
    if (!isValidPhone(customerPhone)) {
      setError("رقم الهاتف غير صالح — أدخله بالصيغة الدولية مثل +20xxxxxxxxxx");
      return;
    }
    if (customerEmail.trim() && !isValidEmail(customerEmail)) {
      setError("البريد الإلكتروني غير صالح");
      return;
    }
    setSubmitting(true);
    try {
      const row = await createServiceRequest({
        serviceId: service.id,
        serviceType: service.type,
        serviceName: service.name,
        unitPrice: service.price,
        quantity,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || null,
        airline: airline || null,
        flightNumber: flightNumber.trim() || null,
        flightDate: flightDate || null,
        arrivalTime: arrivalTime || null,
        airport: airport || null,
        destination: destination.trim() || null,
        notes: notes.trim() || null,
      });
      onSuccess(row.request_number, row.total_price);
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إرسال الطلب");
    } finally {
      setSubmitting(false);
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

        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
          <Badge>اختياري</Badge> مش لازم تكون حاجز تذكرتك من TripRing — تقدر تدخل تفاصيل رحلتك من أي مصدر
          عشان نربط الخدمة بيها.
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

        <div className="flex items-center justify-between rounded-xl bg-[#0C7BB3]/5 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">الإجمالي</span>
          <span className="text-lg font-extrabold text-[#0C7BB3]">{formatPrice(total)}</span>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? "جاري الإرسال..." : "تأكيد الطلب"}
        </Button>
      </form>
    </Modal>
  );
}
