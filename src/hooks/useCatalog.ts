import { useEffect, useState } from "react";

import {
  fetchAgencies,
  fetchAirlines,
  fetchAirports,
  fetchImageCache,
  fetchRoutePriceReferences,
  getDestinationImage,
} from "../lib/api";
import { friendlyErrorMessage } from "../lib/errors";
import type { AgencyRow, AirlineRow, AirportRow, ImageCacheRow, RoutePriceReferenceRow } from "../types/database";

export type Catalog = {
  airports: AirportRow[];
  airlines: AirlineRow[];
  agencies: AgencyRow[];
  references: RoutePriceReferenceRow[];
  imageCache: ImageCacheRow[];
  loading: boolean;
  error: string | null;
};

let cached: Omit<Catalog, "loading" | "error"> | null = null;

export function useCatalog(): Catalog {
  const [state, setState] = useState<Catalog>({
    airports: cached?.airports ?? [],
    airlines: cached?.airlines ?? [],
    agencies: cached?.agencies ?? [],
    references: cached?.references ?? [],
    imageCache: cached?.imageCache ?? [],
    loading: !cached,
    error: null,
  });

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    (async () => {
      try {
        const [airports, airlines, agencies, references, imageCache] = await Promise.all([
          fetchAirports(),
          fetchAirlines(),
          fetchAgencies(),
          fetchRoutePriceReferences(),
          fetchImageCache(),
        ]);
        if (cancelled) return;
        cached = { airports, airlines, agencies, references, imageCache };
        setState({ airports, airlines, agencies, references, imageCache, loading: false, error: null });
      } catch (e) {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: friendlyErrorMessage(e, "حصل خطأ في تحميل بيانات الموقع، جرّب تاني.", "useCatalog"),
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function useDealImage(toAirportCode: string, catalog: Catalog, seed?: string): string | null {
  const airport = catalog.airports.find((a) => a.code === toAirportCode);
  return getDestinationImage(airport, catalog.imageCache, seed ?? toAirportCode);
}
