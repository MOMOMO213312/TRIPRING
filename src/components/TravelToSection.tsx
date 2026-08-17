import { useMemo, useState } from "react";

import { getDestinationImage } from "../lib/api";
import type { AirportRow, ImageCacheRow } from "../types/database";
import { DestinationCard } from "./DestinationCard";

type Props = {
  airports: AirportRow[];
  imageCache: ImageCacheRow[];
  fromAirport?: string;
};

/** Lets the traveler pick a country, browse every city TripRing flies to there,
 *  and jump straight into a prefilled search for the one they pick. */
export function TravelToSection({ airports, imageCache, fromAirport = "CAI" }: Props) {
  const byCountry = useMemo(() => {
    const map = new Map<string, AirportRow[]>();
    for (const airport of airports) {
      if (airport.code === fromAirport) continue;
      const list = map.get(airport.country) ?? [];
      list.push(airport);
      map.set(airport.country, list);
    }
    return map;
  }, [airports, fromAirport]);

  const countries = useMemo(
    () => [...byCountry.keys()].sort((a, b) => (byCountry.get(b)?.length ?? 0) - (byCountry.get(a)?.length ?? 0)),
    [byCountry],
  );

  const [selectedCountry, setSelectedCountry] = useState<string | null>(countries[0] ?? null);
  const cities = selectedCountry ? (byCountry.get(selectedCountry) ?? []) : [];

  if (countries.length === 0) return null;

  return (
    <section>
      <div className="mb-5 px-4 sm:px-0">
        <h2 className="text-2xl font-bold text-gray-900">✈️ سافر إلى</h2>
        <p className="text-sm text-gray-600">اختار الدولة، وبعدين المدينة، وهنكمّلك البحث على طول</p>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {countries.map((country) => (
          <button
            key={country}
            type="button"
            onClick={() => setSelectedCountry(country)}
            className={
              country === selectedCountry
                ? "smart-chip smart-chip-active shrink-0"
                : "smart-chip shrink-0"
            }
          >
            {country}
            <span className="font-latin text-xs text-gray-400">{byCountry.get(country)?.length}</span>
          </button>
        ))}
      </div>

      <div dir="ltr" className="group/marquee overflow-hidden">
        {cities.length > 0 ? (
          <div
            key={selectedCountry}
            className="marquee-track flex w-max gap-3 px-4 sm:px-0"
            style={{ animationDuration: `${Math.max(cities.length, 3) * 4.5}s` }}
          >
            {[...cities, ...cities].map((airport, idx) => {
              const image = getDestinationImage(airport, imageCache, airport.code);
              return (
                <DestinationCard
                  key={`${airport.code}-${idx}`}
                  to={`/search?from=${fromAirport}&to=${airport.code}`}
                  image={image}
                  title={airport.city}
                  price={null}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
