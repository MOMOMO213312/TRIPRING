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

  // Repeat the city list enough times to fill a wide row (not just enough for
  // the seamless-loop illusion) — a country with only 1-2 cities used to leave
  // a big blank gap after 2 cards on wide screens. Each repeat picks a
  // different cached photo for the same city (we cache several per city) via
  // a per-repeat seed, so it reads as more variety rather than the exact same
  // photo copy-pasted.
  const MIN_CARDS = 10;
  const repeatCount = cities.length > 0 ? Math.max(2, Math.ceil(MIN_CARDS / cities.length)) : 0;
  const displayCities = useMemo(
    () => Array.from({ length: repeatCount }, () => cities).flat(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cities, repeatCount],
  );

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
        {displayCities.length > 0 ? (
          <div
            key={selectedCountry}
            className="marquee-track flex w-max gap-3 px-4 sm:px-0"
            style={{ animationDuration: `${Math.max(displayCities.length, 3) * 4.5}s` }}
          >
            {displayCities.map((airport, idx) => {
              const image = getDestinationImage(airport, imageCache, `${airport.code}-${idx}`);
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
