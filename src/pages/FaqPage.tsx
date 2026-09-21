import { useTranslation } from "react-i18next";

type FaqItem = { q: string; a: string };
type FaqSection = { title: string; items: FaqItem[] };

export function FaqPage() {
  const { t } = useTranslation("faq");
  const sections = t("sections", { returnObjects: true }) as FaqSection[];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold text-slate-900">{t("title")}</h1>
      <p className="mt-3 text-slate-600">{t("intro")}</p>

      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="mb-3 text-lg font-bold text-[#0C7BB3]">{section.title}</h2>
            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {section.items.map((item) => (
                <details key={item.q} className="group p-5 open:bg-slate-50">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">
                    {item.q}
                    <span className="shrink-0 text-slate-400 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
