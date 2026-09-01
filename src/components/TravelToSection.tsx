import { useMemo, useState } from "react";

import { getDestinationImage } from "../lib/api";
import type { AirportRow, ImageCacheRow, RoutePriceReferenceRow } from "../types/database";
import { DestinationCard } from "./DestinationCard";

type Props = {
  airports: AirportRow[];
  imageCache: ImageCacheRow[];
  references: RoutePriceReferenceRow[];
  /** Optional initial "from" airport. Falls back to the busiest real origin
   *  in `references` if omitted or if that origin has no routes on file. */
  fromAirport?: string;
};

type RouteDestination = {
  airport: AirportRow;
  minPrice: number | null;
};

/** Lets the traveler pick a "from" airport (mirroring the Hero search), then a
 *  country and city — built only from real routes in `route_price_reference`,
 *  never assumed. A destination only shows up here if TripRing actually has a
 *  priced route for it from the selected origin. */
export function TravelToSection({ airports, imageCache, references, fromAirport }: Props) {
  const airportByCode = useMemo(() => new Map(airports.map((a) => [a.code, a])), [airports]);

  // Real origins = airports that actually appear as `from_airport` in at
  // least one route_price_reference row, ordered by how many routes they have.
  const fromOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of references) {
      counts.set(r.from_airport, (counts.get(r.from_airport) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([code]) => code)
      .filter((code) => airportByCode.has(code));
  }, [references, airportByCode]);

  const [selectedFrom, setSelectedFrom] = useState<string | null>(null);
  const effectiveFrom =
    selectedFrom && fromOptions.includes(selectedFrom)
      ? selectedFrom
      : (fromAirport && fromOptions.includes(fromAirport) ? fromAirport : fromOptions[0]) ?? null;

  const fromCity = effectiveFrom ? (airportByCode.get(effectiveFrom)?.city ?? effectiveFrom) : "";

  // Destinations reachable from the selected origin, taken only from routes
  // that actually exist in route_price_reference (never "every other airport").
  const byCountry = useMemo(() => {
    const map = new Map<string, RouteDestination[]>();
    if (!effectiveFrom) return map;

    // A route can have multiple reference rows (different flight types) —
    // keep the lowest min_price_usd per destination.
    const bestPriceByDest = new Map<string, number | null>();
    for (const r of references) {
      if (r.from_airport !== effectiveFrom || r.to_airport === effectiveFrom) continue;
      const current = bestPriceByDest.get(r.to_airport);
      if (current === undefined || (r.min_price_usd != null && (current == null || r.min_price_usd < current))) {
        bestPriceByDest.set(r.to_airport, r.min_price_usd ?? current ?? null);
      }
    }

    for (const [code, minPrice] of bestPriceByDest) {
      const airport = airportByCode.get(code);
      if (!airport) continue;
      const list = map.get(airport.country) ?? [];
      list.push({ airport, minPrice });
      map.set(airport.country, list);
    }
    return map;
  }, [references, effectiveFrom, airportByCode]);

  const countries = useMemo(
    () => [...byCountry.keys()].sort((a, b) => (byCountry.get(b)?.length ?? 0) - (byCountry.get(a)?.length ?? 0)),
    [byCountry],
  );

  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const effectiveCountry = selectedCountry && countries.includes(selectedCountry) ? selectedCountry : countries[0] ?? null;
  const cities = effectiveCountry ? (byCountry.get(effectiveCountry) ?? []) : [];

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

  if (fromOptions.length === 0 || countries.length === 0 || !effectiveFrom) return null;

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-4 sm:px-0">
        <div>
          <h2 className="font-display text-2xl text-slate-900">✈️ اختر وجهتك</h2>
          <p className="text-sm text-slate-600">اختار الدولة، وبعدين المدينة، وهنكمّلك البحث على طول</p>
        </div>
        {fromOptions.length > 1 ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">من</span>
            <select
              value={effectiveFrom}
              onChange={(e) => setSelectedFrom(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-800 outline-none"
            >
              {fromOptions.map((code) => (
                <option key={code} value={code}>
                  {airportByCode.get(code)?.name ?? code} ({code})
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {countries.map((country) => (
          <button
            key={country}
            type="button"
            onClick={() => setSelectedCountry(country)}
            className={
              country === effectiveCountry
                ? "smart-chip smart-chip-active-home shrink-0"
                : "smart-chip shrink-0"
            }
          >
            {country}
            <span className="font-latin text-xs text-slate-400">{byCountry.get(country)?.length}</span>
          </button>
        ))}
      </div>

      <div dir="ltr" className="group/marquee overflow-hidden">
        {displayCities.length > 0 ? (
          <div
            key={`${effectiveFrom}-${effectiveCountry}`}
            className="marquee-track flex w-max gap-3 px-4 sm:px-0"
            style={{ animationDuration: `${Math.max(displayCities.length, 3) * 4.5}s` }}
          >
            {displayCities.map(({ airport, minPrice }, idx) => {
              const image = getDestinationImage(airport, imageCache, `${airport.code}-${idx}`);
              return (
                <DestinationCard
                  key={`${airport.code}-${idx}`}
                  to={`/search?from=${effectiveFrom}&to=${airport.code}`}
                  image={image}
                  title={airport.city}
                  subtitle={`من ${fromCity}`}
                  price={minPrice}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
