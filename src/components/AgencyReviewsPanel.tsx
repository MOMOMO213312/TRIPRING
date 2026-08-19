import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { AuthGate } from "./AuthGate";
import {
  createAgencyReview,
  fetchAgencyReviews,
  summarizeAgencyRating,
  type AgencyReviewRow,
} from "../lib/api";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import type { AgencyRow } from "../types/database";

function StarRow({ value }: { value: number }) {
  return (
    <span className="font-latin text-amber-500" aria-hidden="true">
      {"★".repeat(Math.round(value))}
      <span className="text-slate-300">{"★".repeat(5 - Math.round(value))}</span>
    </span>
  );
}

export function AgencyReviewsPanel({ agency }: { agency: AgencyRow }) {
  const [reviews, setReviews] = useState<AgencyReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAgencyReviews(agency.id)
      .then((r) => {
        if (!cancelled) setReviews(r);
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agency.id]);

  const summary = summarizeAgencyRating(reviews);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createAgencyReview({ agencyId: agency.id, rating, comment });
      setSubmitted(true);
      setShowForm(false);
      const fresh = await fetchAgencyReviews(agency.id);
      setReviews(fresh);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "تعذر إرسال التقييم");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">{agency.name}</h2>
          {!loading ? (
            summary.count > 0 ? (
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                <StarRow value={summary.average ?? 0} />
                <span className="font-latin font-semibold text-slate-800">{summary.average}</span>
                <span>({summary.count} تقييم)</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">لا توجد تقييمات بعد</p>
            )
          ) : null}
        </div>
        {!showForm && !submitted ? (
          <Button variant="outline" onClick={() => setShowForm(true)}>
            قيّم الوكالة
          </Button>
        ) : null}
      </div>

      {submitted ? (
        <p className="mt-3 text-sm font-medium text-green-700">شكرًا لك، تم إرسال تقييمك</p>
      ) : null}

      {showForm ? (
        <AuthGate
          title="سجّل الدخول لتقييم الوكالة"
          description="نحتاج تسجيل دخولك حتى نربط تقييمك باسمك ونمنع التقييمات الوهمية"
        >
          {() => (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700">تقييمك</span>
                <div className="flex gap-1 font-latin text-lg text-amber-500" role="radiogroup" aria-label="التقييم">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      aria-pressed={n <= rating}
                      className="leading-none"
                    >
                      {n <= rating ? "★" : <span className="text-slate-300">★</span>}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="تعليقك (اختياري)"
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-[#99F6E4]"
              />
              {submitError ? <p className="text-xs text-red-600">{submitError}</p> : null}
              <div className="flex gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "جاري الإرسال..." : "إرسال التقييم"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  إلغاء
                </Button>
              </div>
            </form>
          )}
        </AuthGate>
      ) : null}

      {reviews.length > 0 ? (
        <ul className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          {reviews.slice(0, 5).map((r) => (
            <li key={r.id} className="text-sm">
              <div className="flex items-center gap-2">
                <StarRow value={r.rating} />
                <span className="text-xs text-slate-400">
                  {new Date(r.created_at).toLocaleDateString("ar-EG")}
                </span>
              </div>
              {r.comment ? <p className="mt-1 text-slate-700">{r.comment}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
