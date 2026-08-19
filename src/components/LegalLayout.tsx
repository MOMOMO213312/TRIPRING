import type { ReactNode } from "react";

type Section = { heading: string; body: ReactNode };

type Props = {
  title: string;
  intro?: string;
  sections: Section[];
};

/** Shared visual shell for FAQ/Terms/Privacy — numbered sections, consistent typography. */
export function LegalLayout({ title, intro, sections }: Props) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold text-slate-900">{title}</h1>
      {intro ? <p className="mt-3 text-slate-600">{intro}</p> : null}

      <div className="mt-8 space-y-8">
        {sections.map((s, i) => (
          <section key={s.heading}>
            <h2 className="flex items-baseline gap-2 text-lg font-bold text-slate-900">
              <span className="font-latin text-[#0D9488]">{i + 1}.</span>
              {s.heading}
            </h2>
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">{s.body}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
