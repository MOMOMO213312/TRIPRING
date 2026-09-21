import i18n, { LANG_LOCALE, normalizeLang } from "../i18n";
import type { AirportRow } from "../types/database";

/**
 * `airports.country` is DB data: mostly Arabic country names ("مصر"), a few rows use an ISO
 * alpha-2 code ("US"). To show it in the active UI language we map the Arabic spellings to ISO
 * codes and let the browser's Intl.DisplayNames do the translation — no per-language table.
 */
const AR_COUNTRY_TO_ISO: Record<string, string> = {
  "أذربيجان": "AZ", "ألبانيا": "AL", "ألمانيا": "DE", "أوزبكستان": "UZ", "إثيوبيا": "ET",
  "إسبانيا": "ES", "إندونيسيا": "ID", "إيطاليا": "IT", "الأردن": "JO", "الإمارات": "AE",
  "البحرين": "BH", "البرتغال": "PT", "البوسنة والهرسك": "BA", "التشيك": "CZ", "الجزائر": "DZ",
  "الدنمارك": "DK", "السعودية": "SA", "السودان": "SD", "السويد": "SE", "الصومال": "SO",
  "الصين": "CN", "العراق": "IQ", "الفلبين": "PH", "الكويت": "KW", "المالديف": "MV",
  "المجر": "HU", "المغرب": "MA", "النمسا": "AT", "الهند": "IN", "الولايات المتحدة": "US",
  "اليابان": "JP", "اليمن": "YE", "اليونان": "GR", "باكستان": "PK", "بريطانيا": "GB",
  "بلجيكا": "BE", "بولندا": "PL", "تايلاند": "TH", "تركيا": "TR", "تونس": "TN",
  "جزر القمر": "KM", "جنوب أفريقيا": "ZA", "جورجيا": "GE", "جيبوتي": "DJ", "روسيا": "RU",
  "سريلانكا": "LK", "سنغافورة": "SG", "سوريا": "SY", "سويسرا": "CH", "صربيا": "RS",
  "عمان": "OM", "فرنسا": "FR", "فيتنام": "VN", "قبرص": "CY", "قطر": "QA", "كازاخستان": "KZ",
  "كندا": "CA", "كوريا الجنوبية": "KR", "كينيا": "KE", "لبنان": "LB", "ليبيا": "LY",
  "ماليزيا": "MY", "مصر": "EG", "موريتانيا": "MR", "هولندا": "NL",
};

/** Country name in the active UI language; falls back to the raw DB value for unknown entries. */
export function countryName(country: string): string {
  const lang = normalizeLang(i18n.language);
  const isIso = /^[A-Z]{2}$/.test(country);
  // Arabic UI keeps the curated Arabic spelling from the DB unless the row only holds a code.
  if (lang === "ar" && !isIso) return country;
  const iso = isIso ? country : AR_COUNTRY_TO_ISO[country];
  if (!iso) return country;
  try {
    return new Intl.DisplayNames([LANG_LOCALE[lang]], { type: "region" }).of(iso) ?? country;
  } catch {
    return country;
  }
}

/** City name in the active UI language (Arabic UI → `city`, en/tr → `city_en` when we have it). */
export function airportCityName(airport: Pick<AirportRow, "city" | "city_en">): string {
  return normalizeLang(i18n.language) === "ar" ? airport.city : airport.city_en || airport.city;
}
