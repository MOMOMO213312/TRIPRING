import type { FormEvent } from "react";
import { useState } from "react";

import type { AirlineRow, AirportRow, DealRow } from "../../types/database";
import type { DealFormInput } from "../../lib/agency";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

const DEAL_TYPE_OPTIONS = [
  { value: "flash", label: "فلاش" },
  { value: "last_minute", label: "لحظات أخيرة" },
  { value: "empty_seat", label: "مقعد فارغ" },
  { value: "special_fare", label: "سعر خاص" },
];

const STOPS_OPTIONS = [
  { value: "direct", label: "مباشرة" },
  { value: "one_stop", label: "توقف واحد" },
  { value: "multi_stop", label: "أكثر من توقف" },
];

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

export function AgencyDealForm({
  airports,
  airlines,
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  airports: AirportRow[];
  airlines: AirlineRow[];
  initial?: DealRow;
  onSubmit: (input: DealFormInput) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState<DealFormInput>({
    dealType: initial?.deal_type ?? "flash",
    airlineCode: initial?.airline_code ?? null,
    fromAirport: initial?.from_airport ?? "",
    toAirport: initial?.to_airport ?? "",
    departureDate: initial?.departure_date ?? "",
    departureTime: initial?.departure_time ?? null,
    returnDate: initial?.return_date ?? null,
    arrivalTime: initial?.arrival_time ?? null,
    stops: initial?.stops ?? "direct",
    baggageKg: initial?.baggage_kg ?? null,
    travelClass: initial?.travel_class ?? "economy",
    price: initial?.price ?? 0,
    originalPrice: initial?.original_price ?? null,
    childPrice: initial?.child_price ?? null,
    infantPrice: initial?.infant_price ?? null,
    availableSeats: initial?.available_seats ?? 1,
    durationHours: initial?.duration_hours ?? 24,
    expiresAt: toDatetimeLocal(initial?.expires_at) || "",
    notes: initial?.notes ?? null,
    currency: initial?.currency ?? "USD",
  });

  function set<K extends keyof DealFormInput>(key: K, value: DealFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      ...form,
      expiresAt: new Date(form.expiresAt).toISOString(),
    });
  }

  return (
    <Card className="space-y-4">
      <h3 className="font-bold text-slate-900">{initial ? "تعديل العرض" : "إضافة عرض جديد"}</h3>
      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
        <Select
          label="نوع العرض"
          options={DEAL_TYPE_OPTIONS}
          value={form.dealType}
          onChange={(e) => set("dealType", e.target.value as DealFormInput["dealType"])}
        />
        <Select
          label="شركة الطيران"
          placeholder="اختر شركة الطيران"
          options={airlines.map((a) => ({ value: a.code, label: a.name }))}
          value={form.airlineCode ?? ""}
          onChange={(e) => set("airlineCode", e.target.value || null)}
        />
        <Select
          label="من"
          placeholder="مطار المغادرة"
          options={airports.map((a) => ({ value: a.code, label: `${a.city} (${a.code})` }))}
          value={form.fromAirport}
          onChange={(e) => set("fromAirport", e.target.value)}
          required
        />
        <Select
          label="إلى"
          placeholder="مطار الوصول"
          options={airports.map((a) => ({ value: a.code, label: `${a.city} (${a.code})` }))}
          value={form.toAirport}
          onChange={(e) => set("toAirport", e.target.value)}
          required
        />
        <Input
          label="تاريخ المغادرة"
          type="date"
          required
          value={form.departureDate}
          onChange={(e) => set("departureDate", e.target.value)}
        />
        <Input
          label="وقت المغادرة"
          type="time"
          value={form.departureTime ?? ""}
          onChange={(e) => set("departureTime", e.target.value || null)}
        />
        <Input
          label="تاريخ العودة (اختياري)"
          type="date"
          value={form.returnDate ?? ""}
          onChange={(e) => set("returnDate", e.target.value || null)}
        />
        <Select
          label="التوقفات"
          options={STOPS_OPTIONS}
          value={form.stops}
          onChange={(e) => set("stops", e.target.value as DealFormInput["stops"])}
        />
        <Input
          label="الوزن المسموح (كجم)"
          type="number"
          value={form.baggageKg ?? ""}
          onChange={(e) => set("baggageKg", e.target.value ? Number(e.target.value) : null)}
        />
        <Input
          label="مدة الرحلة (ساعات)"
          type="number"
          required
          value={form.durationHours}
          onChange={(e) => set("durationHours", Number(e.target.value))}
        />
        <Input
          label="السعر"
          type="number"
          required
          min={1}
          value={form.price}
          onChange={(e) => set("price", Number(e.target.value))}
        />
        <Input
          label="السعر الأصلي (قبل الخصم)"
          type="number"
          value={form.originalPrice ?? ""}
          onChange={(e) => set("originalPrice", e.target.value ? Number(e.target.value) : null)}
        />
        <Input
          label="سعر الطفل"
          type="number"
          value={form.childPrice ?? ""}
          onChange={(e) => set("childPrice", e.target.value ? Number(e.target.value) : null)}
        />
        <Input
          label="سعر الرضيع"
          type="number"
          value={form.infantPrice ?? ""}
          onChange={(e) => set("infantPrice", e.target.value ? Number(e.target.value) : null)}
        />
        <Input
          label="عدد المقاعد المتاحة"
          type="number"
          required
          min={0}
          value={form.availableSeats}
          onChange={(e) => set("availableSeats", Number(e.target.value))}
        />
        <Input
          label="ينتهي العرض في"
          type="datetime-local"
          required
          value={form.expiresAt}
          onChange={(e) => set("expiresAt", e.target.value)}
        />
        <div className="sm:col-span-2">
          <Input
            label="ملاحظات (اختياري)"
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
          />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "جاري الحفظ..." : initial ? "حفظ التعديلات" : "نشر العرض"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            إلغاء
          </Button>
        </div>
      </form>
    </Card>
  );
}
