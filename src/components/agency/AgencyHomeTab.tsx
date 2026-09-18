import { useEffect, useState } from "react";

import { fetchAgencyBookings, fetchAgencyDeals } from "../../lib/agency";
import { friendlyErrorMessage } from "../../lib/errors";
import { formatPrice } from "../../lib/utils";
import { Card } from "../ui/Card";

type Summary = {
  activeDeals: number;
  newBookings: number;
  awaitingPayment: number;
  monthRevenue: number;
  currency: string;
};

export function AgencyHomeTab({ agencyId, agencyName }: { agencyId: string; agencyName: string | null }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchAgencyDeals(agencyId), fetchAgencyBookings(agencyId, "all")])
      .then(([deals, bookings]) => {
        if (cancelled) return;
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const paidThisMonth = bookings.filter(
          (b) =>
            (b.status === "paid" || b.status === "ticket_issued") && new Date(b.created_at) >= monthStart,
        );
        setSummary({
          activeDeals: deals.filter((d) => d.status === "active").length,
          newBookings: bookings.filter((b) => b.status === "new").length,
          awaitingPayment: bookings.filter(
            (b) => b.status === "awaiting_payment" || b.status === "payment_uploaded",
          ).length,
          monthRevenue: paidThisMonth.reduce((sum, b) => sum + Number(b.total_price ?? 0), 0),
          currency: bookings[0]?.currency || "USD",
        });
      })
      .catch((e) => {
        if (!cancelled) setError(friendlyErrorMessage(e, "تعذر تحميل الملخص", "AgencyHomeTab.load"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agencyId]);

  if (loading) return <p className="py-8 text-center text-sm text-slate-500">جاري التحميل...</p>;
  if (error) return <p className="py-8 text-center text-sm text-red-600">{error}</p>;
  if (!summary) return null;

  const cards: { label: string; value: string; hint?: string }[] = [
    { label: "عروض نشطة", value: String(summary.activeDeals) },
    { label: "حجوزات جديدة (تحتاج متابعة)", value: String(summary.newBookings) },
    { label: "في انتظار الدفع", value: String(summary.awaitingPayment) },
    { label: "إيراد الشهر الحالي", value: formatPrice(summary.monthRevenue, summary.currency) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">أهلاً، {agencyName ?? "وكالتك"}</h2>
        <p className="text-sm text-slate-500">نظرة سريعة على نشاط وكالتك</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="space-y-1">
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className="font-latin text-xl font-extrabold text-slate-900">{c.value}</p>
          </Card>
        ))}
      </div>
      {summary.newBookings > 0 ? (
        <Card className="border-amber-200 bg-amber-50 text-sm text-amber-900">
          عندك {summary.newBookings} حجز جديد لسه محتاج متابعة — من تاب "رحلاتي".
        </Card>
      ) : null}
    </div>
  );
}
