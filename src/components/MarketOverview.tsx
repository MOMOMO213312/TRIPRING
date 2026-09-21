import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("home");
  const routeLabel = stats.mostViewedRoute
    ? `${airportLabel(stats.mostViewedRoute.from, airports).split(" (")[0]} → ${airportLabel(stats.mostViewedRoute.to, airports).split(" (")[0]}`
    : "—";

  const metrics = [
    {
      label: t("market.activeDeals"),
      value: formatLatinNumber(stats.activeDealsCount),
    },
    {
      label: t("market.priceDrops"),
      value: formatLatinNumber(stats.priceDropCount),
    },
    {
      label: t("market.endingSoon"),
      value: formatLatinNumber(stats.endingSoonCount),
    },
    {
      label: t("market.mostViewedRoute"),
      value: stats.mostViewedRoute ? routeLabel : "—",
      sub: stats.mostViewedRoute
        ? t("market.views", { count: formatLatinNumber(stats.mostViewedRoute.views) })
        : undefined,
    },
  ];

  return (
    <section>
      <h2 className="mb-4 text-xl font-bold text-slate-900">{t("market.title")}</h2>
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
