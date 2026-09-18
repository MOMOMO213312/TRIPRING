import { useEffect, useState } from "react";

import { fetchAgencyCustomers, type AgencyCustomer } from "../../lib/agency";
import { friendlyErrorMessage } from "../../lib/errors";
import { formatPrice } from "../../lib/utils";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";

export function AgencyCustomersTab({ agencyId }: { agencyId: string }) {
  const [customers, setCustomers] = useState<AgencyCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAgencyCustomers(agencyId)
      .then((rows) => {
        if (!cancelled) setCustomers(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(friendlyErrorMessage(e, "تعذر تحميل قائمة العملاء", "AgencyCustomersTab.load"));
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

  const q = search.trim().toLowerCase();
  const filtered = q
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q),
      )
    : customers;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">العملاء</h2>
          <p className="text-sm text-slate-500">
            {customers.length} عميل — مستخرجة تلقائيًا من حجوزاتك (لا يوجد إدخال يدوي)
          </p>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الهاتف أو الإيميل"
          className="w-full sm:w-64"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="text-center text-sm text-slate-500">
          {customers.length === 0 ? "لسه مفيش عملاء — هيظهروا هنا تلقائيًا أول ما يتعمل حجز." : "مفيش نتائج مطابقة"}
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-4 py-3 text-start">الاسم</th>
                <th className="px-4 py-3 text-start">الهاتف</th>
                <th className="px-4 py-3 text-start">الإيميل</th>
                <th className="px-4 py-3 text-start">عدد الحجوزات</th>
                <th className="px-4 py-3 text-start">إجمالي الإنفاق</th>
                <th className="px-4 py-3 text-start">آخر حجز</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.key}>
                  <td className="px-4 py-3 font-semibold text-slate-800">{c.name}</td>
                  <td className="font-latin px-4 py-3 text-slate-600">{c.phone ?? "—"}</td>
                  <td className="font-latin px-4 py-3 text-slate-600">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{c.bookingsCount}</td>
                  <td className="font-latin px-4 py-3 font-semibold text-[#0C7BB3]">
                    {formatPrice(c.totalSpent, c.currency)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(c.lastBookingAt).toLocaleDateString("ar-EG")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
