import type { LocalizedTextMap } from "../types/database";

/**
 * DB-driven content (service names, descriptions...) is authored in Arabic and stored in the plain
 * column; translations live next to it in a `*_i18n` jsonb column ({ "en": "...", "tr": "..." }).
 *
 * Resolution rule: the requested language's translation if it is a non-empty string, otherwise the
 * Arabic source — so a row nobody translated yet still renders (in Arabic) instead of going blank.
 */
export function pickLocalized(map: LocalizedTextMap | null | undefined, fallback: string, lang: string): string {
  const value = map?.[lang as keyof LocalizedTextMap];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
