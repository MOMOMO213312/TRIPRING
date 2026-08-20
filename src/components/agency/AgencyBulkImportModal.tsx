import { useState } from "react";
import * as XLSX from "xlsx";

import {
  bulkCreateDeals,
  DEAL_IMPORT_DEFAULT_VALID_HOURS,
  DEAL_IMPORT_TEMPLATE_COLUMNS,
  parseDealImportRows,
  type BulkImportResult,
} from "../../lib/agency";
import type { AirlineRow, AirportRow } from "../../types/database";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Modal } from "../ui/Modal";

function downloadTemplate() {
  const header = DEAL_IMPORT_TEMPLATE_COLUMNS.join(",");
  const example =
    "CAI,DXB,2026-09-15,14:30,,,MS,flash,direct,23,economy,199,280,150,50,3,26,,USD,مثال توضيحي — امسح الصف ده";
  const blob = new Blob([`${header}\n${example}\n`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tripring-deals-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function AgencyBulkImportModal({
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
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setParseError(null);
    setSubmitError(null);
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (rawRows.length === 0) {
        setParseError("الملف فاضي أو ما فيهوش صفوف بيانات تحت صف العناوين.");
        return;
      }
      setResult(parseDealImportRows(rawRows, airports, airlines));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "تعذر قراءة الملف — تأكد إنه xlsx أو csv صحيح.");
    }
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
      setSubmitError(err instanceof Error ? err.message : "تعذر رفع العروض");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="استيراد عروض من إكسل">
      <div className="max-h-[70vh] space-y-4 overflow-y-auto">
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          الأسعار دي هتتنشر كعروض نشطة على الموقع فورًا بعد التأكيد، وهتنتهي تلقائيًا بعد{" "}
          {DEAL_IMPORT_DEFAULT_VALID_HOURS} ساعات لو الصف ما فيهوش تاريخ انتهاء — راجع كل سعر ومقعد
          في أماديوس قبل إصدار أي تذكرة فعلية للعميل.
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={downloadTemplate}>
            تحميل قالب Excel/CSV
          </Button>
          <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-[#FF6B35] hover:text-[#FF6B35]">
            {fileName ?? "اختر ملف xlsx أو csv"}
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
        </div>

        {parseError ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{parseError}</p> : null}

        {result ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="font-semibold text-emerald-700">{result.rows.length} صف صالح للاستيراد</span>
              {result.errors.length > 0 ? (
                <span className="font-semibold text-red-700">{result.errors.length} صف فيه خطأ (لن يُستورد)</span>
              ) : null}
            </div>

            {result.errors.length > 0 ? (
              <Card className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {result.errors.map((e) => (
                  <p key={e.rowNumber} className="text-red-700">
                    صف {e.rowNumber}: {e.message}
                  </p>
                ))}
              </Card>
            ) : null}

            {result.rows.length > 0 ? (
              <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">صف</th>
                      <th className="px-2 py-1.5">من → إلى</th>
                      <th className="px-2 py-1.5">تاريخ السفر</th>
                      <th className="px-2 py-1.5">السعر</th>
                      <th className="px-2 py-1.5">مقاعد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r) => (
                      <tr key={r.rowNumber} className="border-t border-slate-100">
                        <td className="px-2 py-1.5 text-slate-400">{r.rowNumber}</td>
                        <td className="px-2 py-1.5 font-medium text-slate-800">
                          {r.input.fromAirport} → {r.input.toAirport}
                        </td>
                        <td className="px-2 py-1.5">{r.input.departureDate}</td>
                        <td className="px-2 py-1.5">
                          {r.input.price} {r.input.currency}
                        </td>
                        <td className="px-2 py-1.5">{r.input.availableSeats}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {submitError ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{submitError}</p> : null}

            <div className="flex gap-2">
              <Button type="button" disabled={submitting || result.rows.length === 0} onClick={handleConfirm}>
                {submitting ? "جاري النشر..." : `نشر ${result.rows.length} عرض`}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                إلغاء
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
