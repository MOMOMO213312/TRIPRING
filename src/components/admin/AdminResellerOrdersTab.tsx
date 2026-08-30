import { useEffect, useState } from "react";

import {
  adminConvertResaleOrderToBooking,
  adminRejectResaleOrder,
  fetchAffiliatesByIds,
  fetchDealRouteMap,
  fetchProfileNamesByIds,
  fetchResaleOrderQueue,
  RESALE_ORDER_STATUS_LABELS,
} from "../../lib/admin";
import { friendlyErrorMessage } from "../../lib/errors";
import { formatPrice } from "../../lib/utils";
import type { AffiliateResaleOrderRow, AffiliateRow, DealRow } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

/** Admin review queue for affiliate resale orders (the "official price"
 *  reseller program). An order here is just the affiliate's promise of a
 *  sale — approving it is what actually creates the real booking (at the
 *  affiliate's sell_price) and credits their commission. The affiliate
 *  never issues a ticket themselves; once a booking exists, it's handled
 *  like any other booking from the "كل الحجوزات" tab. */
export function AdminResellerOrdersTab() {
  const [orders, setOrders] = useState<AffiliateResaleOrderRow[]>([]);
  const [affiliates, setAffiliates] = useState<Record<string, AffiliateRow>>({});
  const [names, setNames] = useState<Record<string, { full_name: string | null; phone: string | null }>>({});
  const [routes, setRoutes] = useState<Record<string, Pick<DealRow, "from_airport" | "to_airport">>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [justCreated, setJustCreated] = useState<Record<string, number>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchResaleOrderQueue(showAll ? undefined : ["pending_admin_review"]);
      setOrders(rows);

      const affiliateIds = [...new Set(rows.map((r) => r.affiliate_id))];
      const affiliateRows = await fetchAffiliatesByIds(affiliateIds);
      const affiliateMap: Record<string, AffiliateRow> = {};
      for (const a of affiliateRows) affiliateMap[a.id] = a;
      setAffiliates(affiliateMap);

      const profileIds = [...new Set(affiliateRows.map((a) => a.profile_id))];
      try {
        const profileRows = await fetchProfileNamesByIds(profileIds);
        const nameMap: Record<string, { full_name: string | null; phone: string | null }> = {};
        for (const p of profileRows) nameMap[p.id] = { full_name: p.full_name, phone: p.phone };
        setNames(nameMap);
      } catch {
        // Non-critical — fall back to showing the affiliate's referral code only.
      }

      const routeMap = await fetchDealRouteMap([...new Set(rows.map((r) => r.deal_id))]);
      setRoutes(routeMap);
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحميل طلبات البيع", "AdminResellerOrdersTab.load"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll]);

  async function approve(order: AffiliateResaleOrderRow) {
    setBusyId(order.id);
    try {
      const result = await adminConvertResaleOrderToBooking(order.id);
      setJustCreated((prev) => ({ ...prev, [order.id]: result.booking_number }));
      await load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تحويل الطلب لحجز", "AdminResellerOrdersTab.approve"));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(order: AffiliateResaleOrderRow) {
    setBusyId(order.id);
    try {
      await adminRejectResaleOrder(order.id);
      await load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر رفض الطلب", "AdminResellerOrdersTab.reject"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? "جاري التحميل..." : `${orders.length} طلب ${showAll ? "" : "بانتظار المراجعة"}`}
        </p>
        <Button type="button" variant="outline" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "بانتظار المراجعة بس" : "عرض كل الطلبات"}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="space-y-3">
        {orders.map((o) => {
          const affiliate = affiliates[o.affiliate_id];
          const profile = affiliate ? names[affiliate.profile_id] : undefined;
          const route = routes[o.deal_id];
          const profit = o.sell_price - o.net_price_snapshot;
          const createdBookingNumber = justCreated[o.id];
          return (
            <Card key={o.id} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">
                    {profile?.full_name || affiliate?.referral_code || "أفلييت غير معروف"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {profile?.phone ? `📞 ${profile.phone} · ` : ""}
                    {route ? `${route.from_airport} → ${route.to_airport}` : "الرحلة غير معروفة"}
                  </p>
                </div>
                <Badge tone={o.status === "rejected" ? "urgent" : o.status === "booking_created" ? "empty_seat" : "default"}>
                  {RESALE_ORDER_STATUS_LABELS[o.status]}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <div>
                  <p className="text-slate-500">السعر الرسمي</p>
                  <p className="font-latin font-bold text-slate-900">{formatPrice(o.net_price_snapshot)}</p>
                </div>
                <div>
                  <p className="text-slate-500">سعر بيع الأفلييت</p>
                  <p className="font-latin font-bold text-slate-900">{formatPrice(o.sell_price)}</p>
                </div>
                <div>
                  <p className="text-slate-500">ربح الأفلييت</p>
                  <p className="font-latin font-bold text-[#0C7BB3]">{formatPrice(profit)}</p>
                </div>
              </div>

              <p className="text-sm text-slate-700">
                العميل: {o.customer_name} · {o.customer_phone}
                {o.customer_email ? ` · ${o.customer_email}` : ""}
                <span className="text-slate-400"> · {o.adults_count} بالغ{o.children_count ? ` + ${o.children_count} طفل` : ""}{o.infants_count ? ` + ${o.infants_count} رضيع` : ""}</span>
              </p>

              {createdBookingNumber ? (
                <p className="text-sm font-semibold text-green-700">تم إنشاء حجز رقم #{createdBookingNumber}</p>
              ) : null}

              {o.status === "pending_admin_review" ? (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                  <Button type="button" disabled={busyId === o.id} onClick={() => approve(o)}>
                    ✔ الموافقة وإنشاء الحجز
                  </Button>
                  <Button type="button" variant="outline" disabled={busyId === o.id} onClick={() => reject(o)}>
                    ✕ رفض
                  </Button>
                </div>
              ) : null}
            </Card>
          );
        })}
        {!loading && orders.length === 0 ? (
          <Card className="text-center text-sm text-slate-400">لا توجد طلبات {showAll ? "" : "بانتظار المراجعة"}.</Card>
        ) : null}
      </div>
    </div>
  );
}
