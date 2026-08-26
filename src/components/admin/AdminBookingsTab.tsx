import { useEffect, useState } from "react";

import { BOOKING_STATUS_LABELS, updateBookingStatus } from "../../lib/agency";
import { fetchAgencyNameMap, fetchAllBookings, fetchDealRouteMap } from "../../lib/admin";
import { friendlyErrorMessage } from "../../lib/errors";
import type { BookingRow, BookingStatus, DealRow } from "../../types/database";
import { Card } from "../ui/Card";
import { Select } from "../ui/Select";

const STATUS_OPTIONS = (Object.keys(BOOKING_STATUS_LABELS) as BookingStatus[]).map((v) => ({
  value: v,
  label: BOOKING_STATUS_LABELS[v],
}));

export function AdminBookingsTab() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [agencyNames, setAgencyNames] = useState<Record<string, string>>({});
  const [routes, setRoutes] = useState<Record<string, Pick<DealRow, "from_airport" | "to_airport">>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    fetchAllBookings()
      .then(async (rows) => {
        setBookings(rows);
        const [names, routeMap] = await Promise.all([
          fetchAgencyNameMap(),
          fetchDealRouteMap([...new Set(rows.map((b) => b.deal_id))]),
        ]);
        setAgencyNames(names);
        setRoutes(routeMap);
      })
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل الحجوزات", "AdminBookingsTab.load")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function changeStatus(booking: BookingRow, status: BookingStatus) {
    setBusyId(booking.id);
    try {
      await updateBookingStatus(booking.id, status);
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحديث حالة الحجز", "AdminBookingsTab.status"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        {loading ? "جاري التحميل..." : `آخر ${bookings.length} حجز على مستوى المنصة كلها`}
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">حجز #</th>
              <th className="px-3 py-2">الوكالة</th>
              <th className="px-3 py-2">الخط</th>
              <th className="px-3 py-2">العميل</th>
              <th className="px-3 py-2">المبلغ</th>
              <th className="px-3 py-2">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const route = routes[b.deal_id];
              return (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">#{b.booking_number}</td>
                  <td className="px-3 py-2">{agencyNames[b.agency_id] ?? "—"}</td>
                  <td className="px-3 py-2">{route ? `${route.from_airport} → ${route.to_airport}` : "—"}</td>
                  <td className="px-3 py-2">
                    {b.customer_name}
                    <span className="block text-xs text-slate-400">{b.customer_phone}</span>
                  </td>
                  <td className="px-3 py-2">
                    {b.total_price ?? "—"} {b.currency}
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={b.status}
                      disabled={busyId === b.id}
                      onChange={(e) => changeStatus(b, e.target.value as BookingStatus)}
                      options={STATUS_OPTIONS}
                      className="min-w-[9rem] py-1.5 text-xs"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && bookings.length === 0 ? (
          <Card className="m-3 text-center text-sm text-slate-400">لا توجد حجوزات بعد.</Card>
        ) : null}
      </div>
    </div>
  );
}
