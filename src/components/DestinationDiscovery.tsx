import { Link } from "react-router-dom";

import { getDestinationImage } from "../lib/api";
import type { AirportRow, DealRow, ImageCacheRow } from "../types/database";

type Props = {
  opportunities: DealRow[];
  airports: AirportRow[];
  imageCache: ImageCacheRow[];
};

/** Groups current live opportunities by destination country — real data only, no invented destinations. */
export function DestinationDiscovery({ opportunities, airports, imageCache }: Props) {
  const byCountry = new Map<string, { airport: AirportRow; minPrice: number; count: number }>();

  for (const deal of opportunities) {
    const airport = airports.find((a) => a.code === deal.to_airport);
    if (!airport) continue;
    const key = airport.country;
    const existing = byCountry.get(key);
    if (!existing || deal.price < existing.minPrice) {
      byCountry.set(key, { airport, minPrice: deal.price, count: (existing?.count ?? 0) + 1 });
    } else {
      existing.count += 1;
    }
  }

  const destinations = [...byCountry.entries()].slice(0, 10);
  if (destinations.length === 0) return null;

  // Duplicate the list so the marquee track can loop seamlessly:
  // translating the track by exactly -50% of its width lands back on
  // an identical copy of the first card, so the motion never "jumps".
  const loopItems = [...destinations, ...destinations];
  // Keep the per-card speed constant no matter how many destinations we have.
  const durationSeconds = destinations.length * 4.5;

  return (
    <section>
      <div className="mb-5 px-4 sm:px-0">
        <h2 className="text-2xl font-bold text-gray-900">🌍 أكثر الوجهات بحثًا من القاهرة</h2>
        <p className="text-sm text-gray-600">وجهات مبنية على الفرص المتاحة فعليًا دلوقتي</p>
      </div>

      <div dir="ltr" className="group/marquee overflow-hidden">
        <div
          className="marquee-track flex w-max gap-3 px-4 sm:px-0"
          style={{ animationDuration: `${durationSeconds}s` }}
        >
          {loopItems.map(([country, info], idx) => {
            const image = getDestinationImage(info.airport, imageCache);
            return (
              <Link
                key={`${country}-${idx}`}
                to={`/search?to=${info.airport.code}`}
                className="opportunity-card-lift group relative block h-[300px] w-[220px] shrink-0 overflow-hidden rounded-xl sm:h-[340px] sm:w-[250px]"
              >
                {image ? (
                  <img
                    src={image}
                    alt={info.airport.city}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    draggable={false}
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-slate-200 to-slate-300" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute bottom-0 start-0 end-0 p-4">
                  <p className="text-base font-bold text-white">{info.airport.city}</p>
                  <p className="mt-1 text-xs text-white/70">رحلات ذهاب وعودة ابتداءً من</p>
                  <p className="font-latin mt-0.5 text-lg font-extrabold text-white">${info.minPrice}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
