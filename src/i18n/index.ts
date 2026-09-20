import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import ar from "./locales/ar.json";
import en from "./locales/en.json";
import tr from "./locales/tr.json";

export const SUPPORTED_LANGUAGES = ["ar", "en", "tr"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const RTL_LANGUAGES: readonly SupportedLanguage[] = ["ar"];

/** Applied once on init and again on every language change — keeps <html dir/lang> in sync
 * with i18next so RTL-only CSS (and any margin-left/right instead of logical properties)
 * gets exercised correctly in both directions. */
export function applyDocumentDirection(lng: string) {
  const isRtl = RTL_LANGUAGES.includes(lng as SupportedLanguage);
  document.documentElement.dir = isRtl ? "rtl" : "ltr";
  document.documentElement.lang = lng;
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
      tr: { translation: tr },
    },
    fallbackLng: "ar",
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    detection: {
      // localStorage first (explicit user choice persists across visits), then browser lang,
      // then the fallback above. No <html lang> lookup — we own that via applyDocumentDirection.
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "tripring_lang",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  });

applyDocumentDirection(i18n.resolvedLanguage ?? "ar");
i18n.on("languageChanged", applyDocumentDirection);

export default i18n;
