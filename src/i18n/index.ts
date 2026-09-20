import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import arCommon from "./locales/ar/common.json";
import arErrors from "./locales/ar/errors.json";
import enCommon from "./locales/en/common.json";
import enErrors from "./locales/en/errors.json";
import trCommon from "./locales/tr/common.json";
import trErrors from "./locales/tr/errors.json";

export const SUPPORTED_LANGS = ["ar", "en", "tr"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];
export const DEFAULT_LANG: Lang = "ar";
export const LANG_STORAGE_KEY = "tripring.lang";

/** Text direction per language — Arabic is RTL, English/Turkish are LTR. */
export const LANG_DIR: Record<Lang, "rtl" | "ltr"> = { ar: "rtl", en: "ltr", tr: "ltr" };

/** BCP-47 locale used for Intl date/number formatting per language. */
export const LANG_LOCALE: Record<Lang, string> = { ar: "ar-EG", en: "en-US", tr: "tr-TR" };

export function normalizeLang(l: string | undefined | null): Lang {
  const base = (l ?? "").toLowerCase().split("-")[0];
  return (SUPPORTED_LANGS as readonly string[]).includes(base) ? (base as Lang) : DEFAULT_LANG;
}

function applyDocumentLang(l: string) {
  const lang = normalizeLang(l);
  document.documentElement.lang = lang;
  document.documentElement.dir = LANG_DIR[lang];
  const t = i18n.getFixedT(lang);
  document.title = t("common:meta.title");
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute("content", t("common:meta.description"));
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { common: arCommon, errors: arErrors },
      en: { common: enCommon, errors: enErrors },
      tr: { common: trCommon, errors: trErrors },
    },
    ns: ["common", "errors"],
    defaultNS: "common",
    fallbackLng: DEFAULT_LANG,
    supportedLngs: [...SUPPORTED_LANGS],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    // Only honour an explicit user choice (?lang=xx or a saved preference) — NOT the browser
    // language — until every screen is translated, otherwise Arabic-only pages would flip to LTR.
    detection: {
      order: ["querystring", "localStorage"],
      lookupQuerystring: "lang",
      lookupLocalStorage: LANG_STORAGE_KEY,
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false }, // React already escapes
    returnNull: false,
  });

applyDocumentLang(i18n.language);
i18n.on("languageChanged", applyDocumentLang);

export default i18n;
