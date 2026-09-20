import i18n, { DEFAULT_LANG, LANG_LOCALE, normalizeLang } from "./index";

/** Intl locale for the currently active UI language (ar-EG / en-US / tr-TR). */
export function getLocale(): string {
  return LANG_LOCALE[normalizeLang(i18n.language) ?? DEFAULT_LANG];
}
