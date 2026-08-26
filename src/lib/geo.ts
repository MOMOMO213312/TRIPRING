/**
 * Approximate lat/lng for airports likely present in the `airports` table
 * (Egypt/Middle East focus + main international hubs). Used only for
 * plotting dots on the Live Deals Map — not stored in the database.
 * Add codes here as needed; airports without an entry are simply skipped
 * on the map rather than guessed.
 */
export const AIRPORT_COORDS: Record<string, { lat: number; lon: number }> = {
  CAI: { lat: 30.13, lon: 31.4 },
  ALY: { lat: 31.18, lon: 29.95 },
  SSH: { lat: 27.98, lon: 34.4 },
  HRG: { lat: 27.18, lon: 33.8 },
  LXR: { lat: 25.67, lon: 32.7 },
  ASW: { lat: 23.96, lon: 32.82 },
  DXB: { lat: 25.25, lon: 55.36 },
  AUH: { lat: 24.43, lon: 54.65 },
  JED: { lat: 21.5, lon: 39.2 },
  RUH: { lat: 24.96, lon: 46.7 },
  DMM: { lat: 26.47, lon: 49.8 },
  MED: { lat: 24.55, lon: 39.7 },
  DOH: { lat: 25.27, lon: 51.61 },
  KWI: { lat: 29.23, lon: 47.97 },
  BAH: { lat: 26.27, lon: 50.63 },
  MCT: { lat: 23.6, lon: 58.28 },
  AMM: { lat: 31.98, lon: 35.99 },
  BEY: { lat: 33.82, lon: 35.49 },
  IST: { lat: 41.28, lon: 28.75 },
  SAW: { lat: 40.9, lon: 29.31 },
  ADB: { lat: 38.29, lon: 27.16 },
  LHR: { lat: 51.47, lon: -0.45 },
  CDG: { lat: 49.0, lon: 2.55 },
  FRA: { lat: 50.03, lon: 8.57 },
  MAD: { lat: 40.47, lon: -3.56 },
  FCO: { lat: 41.8, lon: 12.25 },
  AMS: { lat: 52.31, lon: 4.76 },
  ATH: { lat: 37.94, lon: 23.95 },
  CMN: { lat: 33.37, lon: -7.59 },
  TUN: { lat: 36.85, lon: 10.23 },
  ALG: { lat: 36.69, lon: 3.21 },
  JNB: { lat: -26.13, lon: 28.24 },
  NBO: { lat: -1.32, lon: 36.93 },
  LOS: { lat: 6.58, lon: 3.32 },
  JFK: { lat: 40.64, lon: -73.78 },
  IKA: { lat: 35.42, lon: 51.15 },
  DEL: { lat: 28.56, lon: 77.1 },
  BOM: { lat: 19.09, lon: 72.87 },
  BKK: { lat: 13.69, lon: 100.75 },
  SIN: { lat: 1.36, lon: 103.99 },
  KHI: { lat: 24.9, lon: 67.16 },
  SYD: { lat: -33.95, lon: 151.18 },
};

const VIEW_W = 1000;
const VIEW_H = 500;

/** Simple equirectangular projection into the map's SVG viewBox. */
export function projectAirport(code: string): { x: number; y: number } | null {
  const coord = AIRPORT_COORDS[code];
  if (!coord) return null;
  const x = ((coord.lon + 180) / 360) * VIEW_W;
  const y = ((90 - coord.lat) / 180) * VIEW_H;
  return { x, y };
}
