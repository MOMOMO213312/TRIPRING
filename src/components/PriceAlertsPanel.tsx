import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { airportLabel } from "../lib/deal-utils";
import { formatPrice } from "../lib/utils";
import type { AirportRow } from "../types/database";
import type { Tables } from "../types/database";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

type Props = {
  alerts: Tables<"price_alerts">[];
  airports: AirportRow[];
  loading?: boolean;
};

export function PriceAlertsPanel({ alerts, airports, loading }: Props) {
  const { t } = useTranslation("alerts");
  if (loading) {
    return (
      <Card>
        <p className="text-sm text-slate-500">{t("panel.loading")}</p>
      </Card>
    );
  }

  if (!alerts.length) {
    return (
      <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-slate-900">{t("panel.emptyTitle")}</h3>
          <p className="mt-1 text-sm text-slate-600">{t("panel.emptyText")}</p>
        </div>
        <Link to="/alerts">
          <Button variant="outline">{t("panel.createCta")}</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-bold text-slate-900">{t("panel.activeTitle")}</h3>
        <Link to="/alerts" className="text-sm font-semibold text-[#0C7BB3] hover:underline">
          {t("common:actions.viewAll")}
        </Link>
      </div>
      <ul className="space-y-3">
        {alerts.slice(0, 4).map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm"
          >
            <span>
              {airportLabel(a.from_airport ?? "", airports).split(" (")[0]} →{" "}
              {airportLabel(a.to_airport ?? "", airports).split(" (")[0]}
            </span>
            <span className="font-latin font-semibold text-slate-700">
              ≤ {formatPrice(a.max_budget ?? 0)}
            </span>
          </li>
        ))}
      </ul>
      <Link to="/alerts">
        <Button fullWidth variant="outline" className="mt-4">
          {t("panel.createNew")}
        </Button>
      </Link>
    </Card>
  );
}
