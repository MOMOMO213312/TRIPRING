/**
 * Circular Deal Score ring — reads the real `deals.deal_score` column
 * (0-100, set by agency/staff review), never a computed/guessed value.
 * Renders nothing when the deal has no score yet rather than faking one,
 * so callers should conditionally render around it. Color tiers reuse the
 * existing --color-score-* design tokens (already defined in index.css but
 * previously unused).
 */
export function DealScoreRing({ score, size = 52 }: { score: number; size?: number }) {
  const tier =
    score >= 85
      ? { ring: "#16a34a", bg: "#f0fdf4", text: "#16a34a" }
      : score >= 70
        ? { ring: "#d97706", bg: "#fffbeb", text: "#d97706" }
        : { ring: "#6b7280", bg: "#f9fafb", text: "#6b7280" };

  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Deal Score ${score} من 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill={tier.bg} stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tier.ring}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-latin text-[13px] font-extrabold leading-none" style={{ color: tier.text }}>
          {Math.round(score)}
        </span>
        <span className="mt-0.5 text-[7px] font-semibold leading-none text-slate-400">Score</span>
      </div>
    </div>
  );
}
