import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "../i18n";

/**
 * Site language picker. Changing it flips i18next's active language, which in turn flips
 * <html dir/lang> (see src/i18n/index.ts) so RTL/LTR layout and every translated string
 * update together, and persists the choice in localStorage for the next visit.
 */
export function LanguageSwitcher({ align = "end" }: { align?: "start" | "end" }) {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? "ar") as SupportedLanguage;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language.switch")}
        className="font-latin flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:border-[#1E3A8A]/40 hover:text-[#1E3A8A]"
      >
        {current.toUpperCase()}
        <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label={t("language.switch")}
          className={`absolute top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg ${
            align === "end" ? "end-0" : "start-0"
          }`}
        >
          {SUPPORTED_LANGUAGES.map((code) => (
            <li key={code} role="option" aria-selected={code === current}>
              <button
                type="button"
                onClick={() => {
                  void i18n.changeLanguage(code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start transition hover:bg-slate-50 ${
                  code === current ? "bg-[#1E3A8A]/5 font-semibold text-[#1E3A8A]" : "text-slate-700"
                }`}
              >
                <span>{t(`language.${code}`)}</span>
                <span className="font-latin text-xs text-slate-500">{code.toUpperCase()}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
