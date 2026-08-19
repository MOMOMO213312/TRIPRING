import { SCORE_TIER_COLORS, SCORE_TIER_LABEL, scoreTier } from "../lib/deal-utils";
import { formatLatinNumber } from "../lib/utils";

type Props = {
  score: number;
  size?: number;
  /** Show the tier label (e.g. "صفقة استثنائية") below the ring. */
  showLabel?: boolean;
};

export function DealScoreRing({ score, size = 52, showLabel = false }: Props) {
  const stroke = Math.max(3, Math.round(size / 13));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100) / 100;
  const dash = circumference * progress;
  const tier = scoreTier(score);
  const colors = SCORE_TIER_COLORS[tier];

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <div
        className="relative inline-flex shrink-0 items-center justify-center rounded-full"
        style={{ width: size, height: size, backgroundColor: colors.bg }}
        title={`Deal Score ${score}`}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={colors.ring} strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.fg}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
          />
        </svg>
        <span
          className="font-latin absolute font-bold"
          style={{ color: colors.fg, fontSize: Math.max(11, size * 0.28) }}
        >
          {formatLatinNumber(score)}
        </span>
      </div>
      {showLabel ? (
        <span className="text-[11px] font-semibold" style={{ color: colors.fg }}>
          {SCORE_TIER_LABEL[tier]}
        </span>
      ) : null}
    </div>
  );
}
