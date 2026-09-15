import { useEffect, useState } from "react";

import { friendlyErrorMessage } from "../../lib/errors";
import {
  assignOrderItem,
  fetchNegativeMarginItems,
  fetchOrderItems,
  fetchOrderItemStatusLog,
  fetchOrdersNeedingAttention,
  FULFILLMENT_STATUS_LABELS,
  FULFILLMENT_SUMMARY_LABELS,
  markServiceItemFulfilled,
  reassignOrderItem,
  type NegativeMarginItemRow,
  type OrderItemRow,
  type OrderItemStatusLogRow,
  type OrderNeedingAttentionRow,
} from "../../lib/orchestration";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Modal } from "../ui/Modal";

type SubTab = "orders" | "margins";

export function AdminFulfillmentTab() {
  const [subTab, setSubTab] = useState<SubTab>("orders");
  const [orders, setOrders] = useState<OrderNeedingAttentionRow[]>([]);
  const [margins, setMargins] = useState<NegativeMarginItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([fetchOrdersNeedingAttention(), fetchNegativeMarginItems()])
      .then(([o, m]) => {
        setOrders(o);
        setMargins(m);
      })
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل بيانات المراقبة", "AdminFulfillmentTab.load")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading
            ? "جاري التحميل..."
            : `${orders.length} أوردر محتاج متابعة · ${margins.length} عنصر بهامش سالب`}
        </p>
        <Button type="button" variant="outline" onClick={load}>
          تحديث
        </Button>
      </div>

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => setSubTab("orders")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            subTab === "orders" ? "bg-[#0C7BB3] text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          ⚠️ أوردرات محتاجة متابعة
        </button>
        <button
          type="button"
          onClick={() => setSubTab("margins")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
            subTab === "margins" ? "bg-[#0C7BB3] text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          📉 هامش سالب
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {subTab === "orders" ? (
        <div className="space-y-2">
          {orders.length === 0 && !loading ? (
            <p className="text-sm text-emerald-700">✅ مفيش أوردرات عالقة دلوقتي.</p>
          ) : null}
          {orders.map((o) => (
            <Card key={o.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">
                    أوردر #{o.order_number} — {o.customer_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {o.customer_phone} · {o.total_price} {o.currency ?? ""} ·{" "}
                    {FULFILLMENT_SUMMARY_LABELS[o.fulfillment_summary] ?? o.fulfillment_summary}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                    {o.stuck_items} عنصر عالق
                  </span>
                  <Button type="button" variant="outline" onClick={() => setOpenOrderId(o.id)}>
                    عرض العناصر
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {margins.length === 0 && !loading ? (
            <p className="text-sm text-emerald-700">✅ مفيش عناصر بهامش سالب دلوقتي.</p>
          ) : null}
          {margins.map((m) => (
            <Card key={m.order_item_id} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">
                  أوردر #{m.order_number} — {m.reference_label ?? m.item_type}
                </p>
                <p className="text-xs text-slate-500">
                  {m.supplier_name ?? "بدون مورد"} · تكلفة {m.supplier_cost ?? "—"} مقابل سعر {m.customer_price}
                </p>
              </div>
              <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-800">
                هامش {m.margin_amount}
              </span>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!openOrderId} onClose={() => setOpenOrderId(null)} title="عناصر الأوردر">
        {openOrderId ? <OrderItemsPanel orderId={openOrderId} onChanged={load} /> : null}
      </Modal>
    </div>
  );
}

function OrderItemsPanel({ orderId, onChanged }: { orderId: string; onChanged: () => void }) {
  const [items, setItems] = useState<OrderItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [logItem, setLogItem] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchOrderItems(orderId)
      .then(setItems)
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل عناصر الأوردر", "AdminFulfillmentTab.items")))
      .finally(() => setLoading(false));
  }

  useEffect(load, [orderId]);

  async function handleAssign(item: OrderItemRow) {
    setBusyId(item.id);
    setError(null);
    try {
      await assignOrderItem(item.id);
      load();
      onChanged();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تعيين مورّد", "AdminFulfillmentTab.assign"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleReassign(item: OrderItemRow) {
    setBusyId(item.id);
    setError(null);
    try {
      await reassignOrderItem(item.id, "manual reassignment from admin fulfillment monitor");
      load();
      onChanged();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر البحث عن مورد بديل", "AdminFulfillmentTab.reassign"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkDelivered(item: OrderItemRow) {
    setBusyId(item.id);
    setError(null);
    try {
      await markServiceItemFulfilled(item.id);
      load();
      onChanged();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر تسجيل تنفيذ الخدمة", "AdminFulfillmentTab.markDelivered"));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">جاري التحميل...</p>;

  return (
    <div className="space-y-2">
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {items.map((item) => (
        <div key={item.id} className="space-y-1 rounded-lg border border-slate-200 p-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{item.reference_label ?? item.item_type}</span>
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                item.fulfillment_status === "fulfilled"
                  ? "bg-emerald-100 text-emerald-800"
                  : item.fulfillment_status === "failed"
                    ? "bg-red-100 text-red-800"
                    : "bg-amber-100 text-amber-800"
              }`}
            >
              {FULFILLMENT_STATUS_LABELS[item.fulfillment_status] ?? item.fulfillment_status}
            </span>
          </div>
          <p className="text-slate-500">
            سعر {item.customer_price} · تكلفة {item.supplier_cost ?? "—"} · هامش {item.margin_amount}
          </p>
          <div className="flex items-center gap-3">
            {item.fulfillment_status === "pending_assignment" ? (
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => handleAssign(item)}
                className="text-[#0C7BB3] underline disabled:opacity-50"
              >
                تعيين مورّد
              </button>
            ) : null}
            {item.fulfillment_status === "failed" || item.fulfillment_status === "reassigning" ? (
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => handleReassign(item)}
                className="text-amber-700 underline disabled:opacity-50"
              >
                {busyId === item.id ? "جاري البحث..." : "بحث عن مورد بديل (Fallback)"}
              </button>
            ) : null}
            {item.item_type !== "flight" && item.fulfillment_status === "confirmed" ? (
              <button
                type="button"
                disabled={busyId === item.id}
                onClick={() => handleMarkDelivered(item)}
                className="text-emerald-700 underline disabled:opacity-50"
                title="إجراء مؤقت لحد ما بورتال المزوّد يجي في المرحلة القادمة"
              >
                {busyId === item.id ? "جاري التسجيل..." : "✅ تسجيل تنفيذ الخدمة"}
              </button>
            ) : null}
            <button type="button" className="text-slate-500 underline" onClick={() => setLogItem(item.id)}>
              سجل التغييرات
            </button>
          </div>
        </div>
      ))}

      <Modal open={!!logItem} onClose={() => setLogItem(null)} title="سجل تغييرات العنصر">
        {logItem ? <ItemStatusLog orderItemId={logItem} /> : null}
      </Modal>
    </div>
  );
}

function ItemStatusLog({ orderItemId }: { orderItemId: string }) {
  const [log, setLog] = useState<OrderItemStatusLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchOrderItemStatusLog(orderItemId)
      .then(setLog)
      .finally(() => setLoading(false));
  }, [orderItemId]);

  if (loading) return <p className="text-sm text-slate-500">جاري التحميل...</p>;
  if (log.length === 0) return <p className="text-sm text-slate-400">لا يوجد سجل بعد.</p>;

  return (
    <div className="space-y-2">
      {log.map((l) => (
        <div key={l.id} className="rounded-lg bg-slate-50 p-2 text-xs">
          <p>
            {l.old_status ?? "—"} → <span className="font-semibold">{l.new_status}</span>
          </p>
          {l.reason ? <p className="text-slate-500">{l.reason}</p> : null}
          <p className="text-slate-400">{new Date(l.changed_at).toLocaleString("ar-EG")}</p>
        </div>
      ))}
    </div>
  );
}
