import { airportLabel } from "../lib/deal-utils";
import { formatLatinNumber } from "../lib/utils";
import type { AirportRow } from "../types/database";
import type { MarketStats } from "../lib/api";
import { Card } from "./ui/Card";

type Props = {
  stats: MarketStats;
  airports: AirportRow[];
};

export function MarketOverview({ stats, airports }: Props) {
  const routeLabel = stats.mostViewedRoute
    ? `${airportLabel(stats.mostViewedRoute.from, airports).split(" (")[0]} → ${airportLabel(stats.mostViewedRoute.to, airports).split(" (")[0]}`
    : "—";

  const metrics = [
    {
      label: "عروض نشطة الآن",
      value: formatLatinNumber(stats.activeDealsCount),
    },
    {
      label: "عروض بانخفاض سعر",
      value: formatLatinNumber(stats.priceDropCount),
    },
    {
      label: "تنتهي خلال 48 ساعة",
      value: formatLatinNumber(stats.endingSoonCount),
    },
    {
      label: "أكثر مسار مشاهدة",
      value: stats.mostViewedRoute ? routeLabel : "—",
      sub: stats.mostViewedRoute
        ? `${formatLatinNumber(stats.mostViewedRoute.views)} مشاهدة`
        : undefined,
    },
  ];

  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-slate-900">نظرة على السوق</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="py-4">
            <p className="text-xs font-medium text-slate-500">{m.label}</p>
            <p className="font-latin mt-1 text-xl font-extrabold text-slate-900">{m.value}</p>
            {m.sub ? <p className="font-latin mt-0.5 text-xs text-slate-500">{m.sub}</p> : null}
          </Card>
        ))}
      </div>
    </section>
  );
}
