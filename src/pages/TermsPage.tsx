import { useTranslation } from "react-i18next";

import { LegalLayout } from "../components/LegalLayout";

type TermsSection = { heading: string; body: string };

export function TermsPage() {
  const { t } = useTranslation("legal");
  const sections = t("terms.sections", { returnObjects: true }) as TermsSection[];

  return (
    <LegalLayout
      title={t("terms.title")}
      intro={t("terms.intro")}
      sections={sections.map((s) => ({ heading: s.heading, body: <p>{s.body}</p> }))}
    />
  );
}
