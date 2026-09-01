import { useState } from "react";

import { bulkCreateDeals, parseDealImportRows, type BulkImportResult } from "../../lib/agency";
import { parseAmadeusScreenText } from "../../lib/amadeusParser";
import type { AirlineRow, AirportRow } from "../../types/database";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export function AgencyAmadeusPasteModal({
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
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleParse() {
    setResult(null);
    setNotice(null);
    const parsed = parseAmadeusScreenText(raw);

    if (parsed.notImplemented || parsed.rows.length === 0) {
      setNotice(
        parsed.screenType === "unknown"
          ? "معرفناش نتعرف على شكل الشاشة دي لسه. المحلل التلقائي قيد الإنشاء — استخدم \"إدخال سريع\" أو \"استيراد من إكسل\" دلوقتي."
          : `اتعرف على شاشة ${parsed.screenType}، لكن التحليل التلقائي لسطورها لسه قيد الإنشاء. استخدم "إدخال سريع" أو "استيراد من إكسل" دلوقتي.`,
      );
      return;
    }

    // Same validation/preview path as the Excel importer and quick-entry —
    // no separate, divergent safety net for this input source.
    const parsedRows = parseDealImportRows(
      parsed.rows as unknown as Record<string, unknown>[],
      airports,
      airlines,
    );
    setResult(parsedRows);
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
        <h3 className="font-bold text-slate-900">📋 لصق من أماديوس (AN / ACW)</h3>
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
        الصق نص شاشة الـ AN أو الـ ACW زي ما هو من أماديوس، وهنحوّله تلقائيًا لعروض جاهزة للمراجعة قبل
        النشر — بنفس شاشة المعاينة اللي بتظهر مع الإدخال السريع واستيراد الإكسل.
        <span className="mt-1 block font-semibold">
          🚧 التحليل التلقائي للسطور لسه قيد الإنشاء — الأزرار التانية شغالة عادي.
        </span>
      </div>

      <textarea
        dir="ltr"
        rows={8}
        placeholder={"1 BA1414 J9 C9 D9 ... /LHR 1 BHD 0655 0810 E0/320 1:15"}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-[#BFE3F6]"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleParse} disabled={!raw.trim()}>
          تحليل النص
        </Button>
      </div>

      {notice ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{notice}</p> : null}

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
