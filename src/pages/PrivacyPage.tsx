import { useTranslation } from "react-i18next";

import { LegalLayout } from "../components/LegalLayout";

type PrivacySection = { heading: string; body?: string; items?: string[] };

export function PrivacyPage() {
  const { t } = useTranslation("legal");
  const sections = t("privacy.sections", { returnObjects: true }) as PrivacySection[];

  return (
    <LegalLayout
      title={t("privacy.title")}
      intro={t("privacy.intro")}
      sections={sections.map((s) => ({
        heading: s.heading,
        body: s.items ? (
          <ul className="list-inside list-disc space-y-1">
            {s.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>{s.body}</p>
        ),
      }))}
    />
  );
}
