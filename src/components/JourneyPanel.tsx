import { useTranslation } from "react-i18next";

import { Badge } from "./ui/Badge";
import { formatPrice } from "../lib/utils";
import type { BookingLookupResult } from "../types/database";

const ITEM_TYPE_ICON: Record<string, string> = {
  flight: "✈",
  service: "🤝",
  transport_zone: "🚗",
  package: "🎁",
  fare_tier: "⭐",
};

function journeyItemTone(status: string): "default" | "flash" | "empty_seat" | "urgent" {
  if (status === "fulfilled" || status === "confirmed") return "empty_seat";
  if (status === "cancelled") return "default";
  // `failed` / `reassigning` are recoverable states the Fallback Engine is
  // working on — shown as in-progress (amber), not as an error (red), to
  // match the reassuring customer-facing copy.
  return "flash";
}

/**
 * MY JOURNEY — the customer's window onto the orchestration engine.
 *
 * Shared between MyTripsPage and ConfirmationPage so the per-item status
 * (order_items / fulfillment_status) is visible from the moment a booking
 * is created, not only later when the customer looks it up again.
 *
 * Before this existed, the customer saw only bookings.status while the
 * engine tracked a totally separate reality per order item. A supplier
 * failing and the Fallback Engine recovering it was completely invisible.
 */
export function JourneyPanel({
  journey,
  currency,
}: {
  journey: NonNullable<BookingLookupResult["journey"]>;
  currency: string;
}) {
  const { t } = useTranslation("booking");
  if (journey.items.length === 0) return null;

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-800">{t("journey.title")}</p>
        <span className="text-xs font-semibold text-[#0C7BB3]">
          {t(`journey.summary.${journey.fulfillment_summary}`, { defaultValue: journey.fulfillment_summary })}
        </span>
      </div>
      <ul className="space-y-2">
        {journey.items.map((item, i) => (
          <li key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-800">
                {ITEM_TYPE_ICON[item.item_type] ?? "•"} {item.label}
                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
              </span>
              <Badge tone={journeyItemTone(item.fulfillment_status)}>
                {t(`journey.itemStatus.${item.fulfillment_status}`, { defaultValue: item.fulfillment_status })}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>{item.supplier_name ?? t("journey.supplierPending")}</span>
              <span>{formatPrice(item.customer_price, currency)}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-400">
        {t("journey.footnote")}
      </p>
    </div>
  );
}
