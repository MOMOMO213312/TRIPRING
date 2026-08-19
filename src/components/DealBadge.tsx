import { cn } from "../lib/utils";

export type DealBadgeTone = "excellent" | "good" | "savings" | "urgent" | "neutral";

const TONE_STYLES: Record<DealBadgeTone, string> = {
  excellent: "bg-score-bg text-success border-success-bg",
  good: "bg-primary-light text-primary border-primary-ring",
  savings: "bg-score-bg text-success border-success-bg",
  urgent: "bg-amber-50 text-amber-700 border-amber-100",
  neutral: "bg-slate-50 text-slate-600 border-slate-200",
};

type Props = {
  tone?: DealBadgeTone;
  icon?: string;
  children: React.ReactNode;
  className?: string;
};

/** Small pill used across cards/detail pages to flag opportunity quality (e.g. "🟢 Excellent Opportunity"). */
export function DealBadge({ tone = "neutral", icon, children, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        TONE_STYLES[tone],
        className,
      )}
    >
      {icon ? <span aria-hidden>{icon}</span> : null}
      {children}
    </span>
  );
}
