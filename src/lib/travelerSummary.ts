import i18n from "../i18n";

/**
 * "2 adults · 1 child · 0 infants" in the current UI language (or `lng` for text that is
 * sent to the agency). Counts are pluralised per language by i18next, so English reads
 * "1 child" / "2 children" instead of "child(ren)".
 *
 * `omitZero` drops the child / infant parts when their count is 0 (used in compact messages).
 */
export function formatTravelerSummary(
  adults: number,
  children: number,
  infants: number,
  opts: { lng?: string; omitZero?: boolean } = {},
): string {
  const { lng, omitZero = false } = opts;
  const parts = [i18n.t("booking:traveler.adultsN", { count: adults, lng })];
  if (!omitZero || children > 0) parts.push(i18n.t("booking:traveler.childrenN", { count: children, lng }));
  if (!omitZero || infants > 0) parts.push(i18n.t("booking:traveler.infantsN", { count: infants, lng }));
  return parts.join(" · ");
}
