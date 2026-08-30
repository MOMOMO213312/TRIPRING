import { useEffect, useState } from "react";

import { fetchMyResaleOrders, RESALE_ORDER_STATUS_LABELS } from "../../lib/affiliate";
import { friendlyErrorMessage } from "../../lib/errors";
import { formatPrice } from "../../lib/utils";
import type { AffiliateResaleOrderRow } from "../../types/database";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

/** The affiliate's own resale orders — what's still waiting on admin review,
 *  what turned into a real booking (and how much commission that earned),
 *  and what got rejected. Read-only: approving/rejecting happens on the
 *  admin side only. */
export function ResellerOrdersHistory({ affiliateId }: { affiliateId: string }) {
  const [orders, setOrders] = useState<AffiliateResaleOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyResaleOrders(affiliateId)
      .then((rows) => {
        if (!cancelled) setOrders(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(friendlyErrorMessage(e, "تعذر تحميل طلبات البيع", "ResellerOrdersHistory.load"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [affiliateId]);

  const pendingCommission = orders
    .filter((o) => o.status === "booking_created")
    .reduce((sum, o) => sum + (o.sell_price - o.net_price_snapshot), 0);

  if (loading) return <p className="text-sm text-slate-500">جاري التحميل...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!orders.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-slate-900">طلبات البيع اللي سجّلتها</p>
        {pendingCommission > 0 ? (
          <span className="text-xs font-semibold text-[#0C7BB3]">
            عمولتك من البيع: {formatPrice(pendingCommission)}
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        {orders.map((o) => (
          <Card key={o.id} className="flex items-center justify-between gap-2 py-2.5">
            <div>
              <p className="text-sm font-semibold text-slate-900">{o.customer_name}</p>
              <p className="text-xs text-slate-500">
                بعت بـ {formatPrice(o.sell_price)} · ربحك {formatPrice(o.sell_price - o.net_price_snapshot)}
              </p>
            </div>
            <Badge tone={o.status === "rejected" ? "urgent" : o.status === "booking_created" ? "empty_seat" : "default"}>
              {RESALE_ORDER_STATUS_LABELS[o.status]}
            </Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
