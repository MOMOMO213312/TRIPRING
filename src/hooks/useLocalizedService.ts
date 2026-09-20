import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { normalizeLang } from "../i18n";
import { pickLocalized } from "../lib/localized";
import { serviceDisplayLabel } from "../lib/servicePackages";
import type { AdditionalServiceRow } from "../types/database";

/**
 * Customer-facing name/description of a catalog service in the current UI language.
 *
 * Display only. Anything that MATCHES or STORES service text (classifyService keyword matching,
 * de-duplicating against a booking's existing services, service_requests.service_name that staff read)
 * must keep using the Arabic `name` / `serviceDisplayLabel`, because that is what the DB and the
 * keyword lists are written in.
 */
export function useLocalizedService() {
  const { i18n } = useTranslation();
  const lang = normalizeLang(i18n.resolvedLanguage ?? i18n.language);
  return useMemo(
    () => ({
      lang,
      name: (s: AdditionalServiceRow): string => pickLocalized(s.name_i18n, serviceDisplayLabel(s), lang),
      description: (s: AdditionalServiceRow): string | null =>
        s.description ? pickLocalized(s.description_i18n, s.description, lang) : null,
    }),
    [lang],
  );
}
