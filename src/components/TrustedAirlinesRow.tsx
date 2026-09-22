import { useTranslation } from "react-i18next";

import { airlineName } from "../lib/deal-utils";
import { formatLatinNumber } from "../lib/utils";
import type { AirlineRow, DealRow } from "../types/database";

type Props = {
  deals: DealRow[];
  airlines: AirlineRow[];
};

export function TrustedAirlinesRow({ deals, airlines }: Props) {
  const { t } = useTranslation("home");
  const counts = new Map<string, number>();
  for (const d of deals) {
    if (!d.airline_code) continue;
    counts.set(d.airline_code, (counts.get(d.airline_code) ?? 0) + 1);
  }
  const featured = [...counts.keys()].slice(0, 8);

  if (!featured.length) return null;

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900">{t("trustedAirlines.title")}</h2>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {featured.map((code) => {
          const airline = airlines.find((a) => a.code === code);
          return (
            <div
              key={code}
              className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-4 text-center"
            >
              {airline?.logo_url ? (
                <img src={airline.logo_url} alt="" className="h-8 object-contain" />
              ) : (
                <span className="font-latin flex size-10 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                  {code}
                </span>
              )}
              <span className="text-sm font-semibold text-slate-800">
                {airlineName(code, airlines)}
              </span>
              <span className="font-latin text-xs text-slate-500">
                {t("trustedAirlines.activeDeals", { count: counts.get(code) ?? 0, num: formatLatinNumber(counts.get(code) ?? 0) })}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
