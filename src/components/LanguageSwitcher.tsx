import { useTranslation } from "react-i18next";

import { SUPPORTED_LANGS, normalizeLang, type Lang } from "../i18n";

/** Compact 3-way language toggle (العربية / English / Türkçe). */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const current = normalizeLang(i18n.resolvedLanguage);

  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className={`font-latin inline-flex overflow-hidden rounded-full border border-slate-200 text-xs ${className}`}
    >
      {SUPPORTED_LANGS.map((code: Lang) => (
        <button
          key={code}
          type="button"
          onClick={() => void i18n.changeLanguage(code)}
          aria-pressed={current === code}
          className={`px-2.5 py-1.5 transition ${
            current === code ? "bg-[#1E3A8A] font-semibold text-white" : "text-slate-600 hover:text-[#1E3A8A]"
          }`}
        >
          {t(`lang.${code}`)}
        </button>
      ))}
    </div>
  );
}
