import type { ReactNode } from "react";

type Suggestion = { label: string; onClick: () => void };

type Props = {
  icon?: string;
  title: string;
  subtitle?: string;
  suggestions?: Suggestion[];
  action?: { label: string; onClick: () => void };
  children?: ReactNode;
};

/** Shared empty-state used across search/deals/trips/alerts pages instead of a plain "no results" line. */
export function EmptyState({ icon = "🔍", title, subtitle, suggestions, action, children }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
      <span className="text-4xl" aria-hidden>
        {icon}
      </span>
      <p className="text-base font-bold text-slate-800">{title}</p>
      {subtitle ? <p className="max-w-md text-sm text-slate-500">{subtitle}</p> : null}

      {suggestions?.length ? (
        <ul className="mt-1 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <li key={s.label}>
              <button type="button" onClick={s.onClick} className="smart-chip">
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {children}

      {action ? (
        <button type="button" onClick={action.onClick} className="cta-primary mt-2 px-5 py-2.5 text-sm">
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
