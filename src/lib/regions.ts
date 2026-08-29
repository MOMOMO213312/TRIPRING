import type { AirportRow } from "../types/database";

/**
 * "Destination" entry points for the Deals Center's discovery flow (see the
 * UX spec: Explore is a set of entry points into curated opportunities, not
 * a traditional filter sidebar). Each region groups one or more countries as
 * they're spelled in the `airports.country` column, so adding an airport in
 * an existing country automatically joins its region — no code change
 * needed. Country lists are a first pass; adjust as the airport catalog
 * grows.
 */
export type Region = {
  key: string;
  label: string;
  emoji: string;
  countries: string[];
};

export const REGIONS: Region[] = [
  { key: "saudi", label: "السعودية", emoji: "🇸🇦", countries: ["السعودية"] },
  { key: "uae", label: "الإمارات", emoji: "🇦🇪", countries: ["الإمارات"] },
  { key: "turkey", label: "تركيا", emoji: "🇹🇷", countries: ["تركيا"] },
  {
    key: "europe",
    label: "أوروبا",
    emoji: "🌍",
    countries: [
      "ألمانيا",
      "إسبانيا",
      "إيطاليا",
      "البرتغال",
      "البوسنة والهرسك",
      "النمسا",
      "بريطانيا",
      "بولندا",
      "اليونان",
      "فرنسا",
      "قبرص",
      "صربيا",
      "سويسرا",
      "هولندا",
      "ألبانيا",
      "روسيا",
    ],
  },
  {
    key: "asia",
    label: "آسيا",
    emoji: "🌏",
    countries: [
      "الصين",
      "إندونيسيا",
      "الفلبين",
      "الهند",
      "اليابان",
      "باكستان",
      "تايلاند",
      "سريلانكا",
      "سنغافورة",
      "فيتنام",
      "كازاخستان",
      "كوريا الجنوبية",
      "ماليزيا",
      "المالديف",
      "أوزبكستان",
      "جورجيا",
      "أذربيجان",
    ],
  },
];

/** Airport codes for a region, resolved live against the current catalog. */
export function regionAirportCodes(region: Region, airports: AirportRow[]): string[] {
  const countrySet = new Set(region.countries);
  return airports.filter((a) => countrySet.has(a.country)).map((a) => a.code);
}

export function findRegion(key: string | null): Region | undefined {
  return REGIONS.find((r) => r.key === key);
}
