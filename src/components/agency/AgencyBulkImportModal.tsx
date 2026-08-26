import { useState } from "react";
import * as XLSX from "xlsx";

import {
  annotateDuplicateDeals,
  bulkCreateDeals,
  DEAL_IMPORT_DEFAULT_VALID_HOURS,
  DEAL_IMPORT_META_SHEETS,
  parseDealImportRows,
  type BulkImportResult,
} from "../../lib/agency";
import type { AirlineRow, AirportRow } from "../../types/database";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Modal } from "../ui/Modal";

const TEMPLATE_URL = "/templates/tripring-deals-template.xlsx";

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
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  // Rows the agency has chosen to still import despite a duplicate flag
  // (keyed by "rowLabel-rowNumber"). Non-duplicate rows are always included.
  const [includedDuplicates, setIncludedDuplicates] = useState<Set<string>>(new Set());

  async function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setParseError(null);
    setSubmitError(null);
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { cellDates: false });
      // The template has one tab per route (plus "تعليمات"/"القوائم" meta
      // tabs to skip) — read every route tab in one pass so uploading the
      // whole file publishes every line at once instead of just the first tab.
      const routeSheetNames = workbook.SheetNames.filter((name) => !DEAL_IMPORT_META_SHEETS.includes(name));
      if (routeSheetNames.length === 0) {
        setParseError("الملف مفيهوش أي تاب خطوط (غير تعليمات/القوائم) — تأكد إنك بترفع الملف الصح.");
        return;
      }
      const merged: BulkImportResult = { rows: [], errors: [] };
      for (const sheetName of routeSheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        const sheetResult = parseDealImportRows(rawRows, airports, airlines, sheetName);
        merged.rows.push(...sheetResult.rows);
        merged.errors.push(...sheetResult.errors);
      }
      if (merged.rows.length === 0 && merged.errors.length === 0) {
        setParseError("مفيش صفوف فيها بيانات في أي تاب — تأكد إنك ضفت تاريخ سفر وسعر على الأقل في الصفوف اللي عايز ترفعها.");
        return;
      }
      setResult(merged);
      setIncludedDuplicates(new Set());
      setCheckingDuplicates(true);
      try {
        await annotateDuplicateDeals(merged.rows);
        setResult({ ...merged });
      } finally {
        setCheckingDuplicates(false);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "تعذر قراءة الملف — تأكد إنه xlsx أو csv صحيح.");
    }
  }

  function rowKey(r: { rowLabel: string; rowNumber: number }) {
    return `${r.rowLabel}-${r.rowNumber}`;
  }

  function toggleDuplicateIncluded(key: string) {
    setIncludedDuplicates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleConfirm() {
    if (!result || result.rows.length === 0) return;
    const rowsToImport = result.rows.filter((r) => !r.duplicate || includedDuplicates.has(rowKey(r)));
    if (rowsToImport.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await bulkCreateDeals(
        agencyId,
        rowsToImport.map((r) => r.input),
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
          <a href={TEMPLATE_URL} download className="inline-block">
            <Button type="button" variant="outline">
              تحميل قالب Excel (تاب لكل خط)
            </Button>
          </a>
          <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-[#0C7BB3] hover:text-[#0C7BB3]">
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
              {checkingDuplicates ? (
                <span className="font-semibold text-slate-500">جاري التأكد من التكرار...</span>
              ) : result.rows.some((r) => r.duplicate) ? (
                <span className="font-semibold text-amber-700">
                  {result.rows.filter((r) => r.duplicate).length} صف يبدو مكررًا مع رحلة موجودة بالفعل
                </span>
              ) : null}
            </div>

            {!checkingDuplicates && result.rows.some((r) => r.duplicate) ? (
              <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                الصفوف المميزة تحتها موجودة بالفعل كعرض نشط (نفس الخط والتاريخ، وأحيانًا نفس رقم الرحلة) —
                مستبعدة تلقائيًا من النشر. لو متأكد إنها مختلفة فعلًا (رحلة تانية غير مرتبطة)، فعّل الصف يدويًا.
              </div>
            ) : null}

            {result.errors.length > 0 ? (
              <Card className="max-h-48 space-y-1 overflow-y-auto text-sm">
                {result.errors.map((e) => (
                  <p key={`${e.rowLabel}-${e.rowNumber}`} className="text-red-700">
                    {e.rowLabel}: {e.message}
                  </p>
                ))}
              </Card>
            ) : null}

            {result.rows.length > 0 ? (
              <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">الخط</th>
                      <th className="px-2 py-1.5">من → إلى</th>
                      <th className="px-2 py-1.5">تاريخ السفر</th>
                      <th className="px-2 py-1.5">السعر</th>
                      <th className="px-2 py-1.5">مقاعد</th>
                      <th className="px-2 py-1.5">تكرار</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r) => {
                      const key = rowKey(r);
                      const included = !r.duplicate || includedDuplicates.has(key);
                      return (
                        <tr
                          key={key}
                          className={`border-t border-slate-100 ${r.duplicate ? "bg-amber-50" : ""}`}
                        >
                          <td className="px-2 py-1.5 text-slate-400">{r.rowLabel}</td>
                          <td className={`px-2 py-1.5 font-medium ${included ? "text-slate-800" : "text-slate-400 line-through"}`}>
                            {r.input.fromAirport} → {r.input.toAirport}
                          </td>
                          <td className="px-2 py-1.5">{r.input.departureDate}</td>
                          <td className="px-2 py-1.5">
                            {r.input.price} {r.input.currency}
                          </td>
                          <td className="px-2 py-1.5">{r.input.availableSeats}</td>
                          <td className="px-2 py-1.5">
                            {r.duplicate ? (
                              <label className="flex cursor-pointer items-center gap-1.5 text-amber-800">
                                <input
                                  type="checkbox"
                                  checked={includedDuplicates.has(key)}
                                  onChange={() => toggleDuplicateIncluded(key)}
                                />
                                <span>
                                  مكرر{r.duplicate.agencyName ? ` (${r.duplicate.agencyName})` : ""} —{" "}
                                  {r.duplicate.price} {r.duplicate.currency}
                                </span>
                              </label>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {submitError ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{submitError}</p> : null}

            <div className="flex gap-2">
              <Button
                type="button"
                disabled={submitting || checkingDuplicates || result.rows.every((r) => r.duplicate && !includedDuplicates.has(rowKey(r)))}
                onClick={handleConfirm}
              >
                {submitting
                  ? "جاري النشر..."
                  : `نشر ${result.rows.filter((r) => !r.duplicate || includedDuplicates.has(rowKey(r))).length} عرض`}
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
