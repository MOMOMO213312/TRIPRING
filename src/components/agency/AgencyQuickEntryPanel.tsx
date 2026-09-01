import { useState } from "react";

import {
  bulkCreateDeals,
  DEAL_IMPORT_DEFAULT_VALID_HOURS,
  parseDealImportRows,
  type BulkImportResult,
} from "../../lib/agency";
import type { AirlineRow, AirportRow } from "../../types/database";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

// One in-progress row of the quick-entry grid. Every value is a plain string
// (matches what comes out of an <input>) so this can be fed straight into
// parseDealImportRows — the exact same validation the Excel importer uses —
// without a second, divergent code path to keep in sync.
type RowState = Record<string, string>;

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

const CLASS_OPTIONS = [
  { value: "economy", label: "اقتصادي" },
  { value: "premium_economy", label: "اقتصادي مميز" },
  { value: "business", label: "رجال أعمال" },
  { value: "first", label: "أولى" },
];

const CURRENCY_OPTIONS = ["USD", "EGP", "SAR", "AED", "QAR", "KWD", "EUR", "GBP"].map((c) => ({
  value: c,
  label: c,
}));

const MEMBERSHIP_OPTIONS = [
  { value: "free", label: "مجاني" },
  { value: "basic", label: "Basic" },
  { value: "smart", label: "Smart" },
  { value: "premium", label: "Premium" },
];

const BOOL_OPTIONS = [
  { value: "", label: "—" },
  { value: "TRUE", label: "نعم" },
  { value: "FALSE", label: "لا" },
];

function emptyRow(): RowState {
  return {
    deal_type: "flash",
    airline_code: "",
    from_airport: "",
    to_airport: "",
    departure_date: "",
    departure_time: "",
    price: "",
    currency: "USD",
    available_seats: "1",
    travel_class: "economy",
    stops: "direct",
    // extended / collapsible fields — all optional
    flight_number: "",
    aircraft_type: "",
    operating_airline_code: "",
    stopover_airport: "",
    layover_minutes: "",
    return_date: "",
    arrival_date: "",
    arrival_time: "",
    flight_duration_minutes: "",
    fare_family: "",
    refundable: "",
    changeable: "",
    change_fee: "",
    cancellation_fee: "",
    baggage_kg: "23",
    checked_bags_count: "1",
    cabin_baggage_kg: "7",
    extra_baggage_price: "",
    base_fare: "",
    taxes_fees: "",
    original_price: "",
    child_price: "",
    infant_price: "",
    min_membership_tier: "free",
    trip_types: "",
    is_featured: "",
    duration_hours: String(DEAL_IMPORT_DEFAULT_VALID_HOURS),
    expires_at: "",
    notes: "",
  };
}

export function AgencyQuickEntryPanel({
  agencyId,
  airports,
  airlines,
  onClose,
  onImported,
}: {
  agencyId: string;
  airports: AirportRow[];
  airlines: AirlineRow[];
  onClose: () => void;
  onImported: () => void;
}) {
  const [rows, setRows] = useState<RowState[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function setCell(rowIndex: number, key: string, value: string) {
    setRows((rs) => rs.map((r, i) => (i === rowIndex ? { ...r, [key]: value } : r)));
    setResult(null); // any edit invalidates the last preview
  }

  function addRow() {
    setRows((rs) => [...rs, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((rs) => rs.filter((_, i) => i !== index));
    setResult(null);
  }

  function toggleExpanded(index: number) {
    setExpanded((e) => ({ ...e, [index]: !e[index] }));
  }

  function handlePreview() {
    // Drop fully-blank rows (someone added an extra row and never used it)
    // before validating — those shouldn't show up as errors.
    const nonEmpty = rows.filter((r) => r.departure_date || r.price);
    const parsed = parseDealImportRows(
      nonEmpty as unknown as Record<string, unknown>[],
      airports,
      airlines,
    );
    setResult(parsed);
  }

  async function handleConfirm() {
    if (!result || result.rows.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await bulkCreateDeals(
        agencyId,
        result.rows.map((r) => r.input),
      );
      onImported();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "تعذر نشر العروض");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900">إدخال سريع (بدون إكسيل)</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="إغلاق"
        >
          ✕
        </button>
      </div>

      <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        اكتب كل رحلة في سطر. اضغط "تفاصيل إضافية" على أي سطر عشان تضيف الشنط والاسترجاع ورقم الرحلة
        وباقي التفاصيل. لو سبت "تاريخ انتهاء العرض" فاضي، هيتحدد تلقائي بعد {DEAL_IMPORT_DEFAULT_VALID_HOURS}{" "}
        ساعات.
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <Select
                options={DEAL_TYPE_OPTIONS}
                value={row.deal_type}
                onChange={(e) => setCell(i, "deal_type", e.target.value)}
              />
              <Select
                placeholder="شركة الطيران"
                options={airlines.map((a) => ({ value: a.code, label: `${a.code} — ${a.name}` }))}
                value={row.airline_code}
                onChange={(e) => setCell(i, "airline_code", e.target.value)}
              />
              <Select
                placeholder="من"
                options={airports.map((a) => ({ value: a.code, label: `${a.city} (${a.code})` }))}
                value={row.from_airport}
                onChange={(e) => setCell(i, "from_airport", e.target.value)}
              />
              <Select
                placeholder="إلى"
                options={airports.map((a) => ({ value: a.code, label: `${a.city} (${a.code})` }))}
                value={row.to_airport}
                onChange={(e) => setCell(i, "to_airport", e.target.value)}
              />
              <Input
                type="date"
                value={row.departure_date}
                onChange={(e) => setCell(i, "departure_date", e.target.value)}
              />
              <Input
                type="time"
                value={row.departure_time}
                onChange={(e) => setCell(i, "departure_time", e.target.value)}
              />

              <Input
                type="number"
                placeholder="السعر"
                value={row.price}
                onChange={(e) => setCell(i, "price", e.target.value)}
              />
              <Select
                options={CURRENCY_OPTIONS}
                value={row.currency}
                onChange={(e) => setCell(i, "currency", e.target.value)}
              />
              <Input
                type="number"
                placeholder="المقاعد"
                value={row.available_seats}
                onChange={(e) => setCell(i, "available_seats", e.target.value)}
              />
              <Select
                options={CLASS_OPTIONS}
                value={row.travel_class}
                onChange={(e) => setCell(i, "travel_class", e.target.value)}
              />
              <Select
                options={STOPS_OPTIONS}
                value={row.stops}
                onChange={(e) => setCell(i, "stops", e.target.value)}
              />
              <div className="flex items-center gap-1">
                <Button variant="outline" className="!px-2 !py-1.5 text-xs" onClick={() => toggleExpanded(i)}>
                  {expanded[i] ? "إخفاء التفاصيل" : "تفاصيل إضافية"}
                </Button>
                <Button
                  variant="outline"
                  className="!px-2 !py-1.5 text-xs text-red-600"
                  onClick={() => removeRow(i)}
                >
                  حذف
                </Button>
              </div>
            </div>

            {expanded[i] ? (
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-4">
                <Input
                  placeholder="رقم الرحلة"
                  value={row.flight_number}
                  onChange={(e) => setCell(i, "flight_number", e.target.value)}
                />
                <Input
                  placeholder="نوع الطائرة"
                  value={row.aircraft_type}
                  onChange={(e) => setCell(i, "aircraft_type", e.target.value)}
                />
                <Select
                  placeholder="شركة التشغيل (كود شير)"
                  options={airlines.map((a) => ({ value: a.code, label: `${a.code} — ${a.name}` }))}
                  value={row.operating_airline_code}
                  onChange={(e) => setCell(i, "operating_airline_code", e.target.value)}
                />
                <Select
                  placeholder="مطار التوقف"
                  options={airports.map((a) => ({ value: a.code, label: `${a.city} (${a.code})` }))}
                  value={row.stopover_airport}
                  onChange={(e) => setCell(i, "stopover_airport", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="دقايق التوقف"
                  value={row.layover_minutes}
                  onChange={(e) => setCell(i, "layover_minutes", e.target.value)}
                />
                <Input
                  type="date"
                  placeholder="تاريخ الوصول"
                  value={row.arrival_date}
                  onChange={(e) => setCell(i, "arrival_date", e.target.value)}
                />
                <Input
                  type="time"
                  placeholder="وقت الوصول"
                  value={row.arrival_time}
                  onChange={(e) => setCell(i, "arrival_time", e.target.value)}
                />
                <Input
                  type="date"
                  placeholder="تاريخ العودة"
                  value={row.return_date}
                  onChange={(e) => setCell(i, "return_date", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="مدة الرحلة (دقيقة)"
                  value={row.flight_duration_minutes}
                  onChange={(e) => setCell(i, "flight_duration_minutes", e.target.value)}
                />
                <Input
                  placeholder="الباقة السعرية"
                  value={row.fare_family}
                  onChange={(e) => setCell(i, "fare_family", e.target.value)}
                />
                <Select
                  placeholder="قابلة للاسترجاع؟"
                  options={BOOL_OPTIONS}
                  value={row.refundable}
                  onChange={(e) => setCell(i, "refundable", e.target.value)}
                />
                <Select
                  placeholder="يمكن تغييرها؟"
                  options={BOOL_OPTIONS}
                  value={row.changeable}
                  onChange={(e) => setCell(i, "changeable", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="رسوم التغيير"
                  value={row.change_fee}
                  onChange={(e) => setCell(i, "change_fee", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="رسوم الإلغاء"
                  value={row.cancellation_fee}
                  onChange={(e) => setCell(i, "cancellation_fee", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="وزن الشنطة (كجم)"
                  value={row.baggage_kg}
                  onChange={(e) => setCell(i, "baggage_kg", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="عدد الشنط"
                  value={row.checked_bags_count}
                  onChange={(e) => setCell(i, "checked_bags_count", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="شنطة الكابينة (كجم)"
                  value={row.cabin_baggage_kg}
                  onChange={(e) => setCell(i, "cabin_baggage_kg", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="سعر الشنطة الإضافية"
                  value={row.extra_baggage_price}
                  onChange={(e) => setCell(i, "extra_baggage_price", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="السعر الأساسي"
                  value={row.base_fare}
                  onChange={(e) => setCell(i, "base_fare", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="الضرائب والرسوم"
                  value={row.taxes_fees}
                  onChange={(e) => setCell(i, "taxes_fees", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="السعر قبل الخصم"
                  value={row.original_price}
                  onChange={(e) => setCell(i, "original_price", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="سعر الطفل"
                  value={row.child_price}
                  onChange={(e) => setCell(i, "child_price", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="سعر الرضيع"
                  value={row.infant_price}
                  onChange={(e) => setCell(i, "infant_price", e.target.value)}
                />
                <Select
                  options={MEMBERSHIP_OPTIONS}
                  value={row.min_membership_tier}
                  onChange={(e) => setCell(i, "min_membership_tier", e.target.value)}
                />
                <Input
                  placeholder="نوع الرحلة (city,beach..)"
                  value={row.trip_types}
                  onChange={(e) => setCell(i, "trip_types", e.target.value)}
                />
                <Select
                  placeholder="عرض مميز؟"
                  options={BOOL_OPTIONS}
                  value={row.is_featured}
                  onChange={(e) => setCell(i, "is_featured", e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="مدة ظهور العرض (ساعة)"
                  value={row.duration_hours}
                  onChange={(e) => setCell(i, "duration_hours", e.target.value)}
                />
                <Input
                  type="datetime-local"
                  placeholder="تاريخ انتهاء العرض"
                  value={row.expires_at}
                  onChange={(e) => setCell(i, "expires_at", e.target.value)}
                />
                <Input
                  placeholder="ملاحظات"
                  className="sm:col-span-2"
                  value={row.notes}
                  onChange={(e) => setCell(i, "notes", e.target.value)}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={addRow}>
          + سطر جديد
        </Button>
        <Button onClick={handlePreview}>معاينة قبل النشر</Button>
      </div>

      {result ? (
        <div className="space-y-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="font-semibold text-emerald-700">{result.rows.length} عرض جاهز للنشر</span>
            {result.errors.length > 0 ? (
              <span className="font-semibold text-red-700">{result.errors.length} سطر فيه خطأ (لن يُنشر)</span>
            ) : null}
          </div>

          {result.errors.length > 0 ? (
            <Card className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {result.errors.map((e) => (
                <p key={`${e.rowLabel}-${e.rowNumber}`} className="text-red-700">
                  {e.rowLabel}: {e.message}
                </p>
              ))}
            </Card>
          ) : null}

          {submitError ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{submitError}</p> : null}

          <div className="flex gap-2">
            <Button disabled={submitting || result.rows.length === 0} onClick={handleConfirm}>
              {submitting ? "جاري النشر..." : `نشر ${result.rows.length} عرض`}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
