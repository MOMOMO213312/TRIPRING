import type { PriceTrendPoint } from "../lib/api";
import { formatLatinNumber } from "../lib/utils";
import { useCurrency } from "../hooks/useCurrency";

type Props = {
  title: string;
  points: PriceTrendPoint[];
  /** Currency the points' prices are stored in (the deal's own currency). */
  currency: string;
};

export function PriceHistoryChart({ title, points: rawPoints, currency }: Props) {
  const { fmt, convert, currency: displayCurrency, fmtIn } = useCurrency();
  // Chart in the visitor's display currency when we can convert; otherwise keep the deal's own currency
  // (never label an EGP series with "$").
  const canConvert = currency !== displayCurrency && convert(1, currency) != null;
  const labelCurrency = canConvert ? displayCurrency : currency;
  const points = canConvert
    ? rawPoints.map((p) => ({ ...p, price: convert(p.price, currency) ?? p.price }))
    : rawPoints;
  if (points.length < 2) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">لا توجد بيانات كافية لعرض الرسم البياني</p>
      </div>
    );
  }

  const width = 400;
  const height = 120;
  const pad = 24;
  const prices = points.map((p) => p.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((p.price - minP) / range) * (height - pad * 2);
    return { x, y, ...p };
  });

  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="font-latin mt-0.5 text-[10px] text-slate-400">{labelCurrency}</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 w-full max-w-lg" aria-label={title}>
        {[0, 0.5, 1].map((t) => {
          const y = height - pad - t * (height - pad * 2);
          const price = minP + t * range;
          return (
            <g key={t}>
              <line x1={pad} x2={width - pad} y1={y} y2={y} stroke="#E5E7EB" strokeWidth={1} />
              <text x={4} y={y + 4} className="fill-slate-400 text-[10px]">
                {formatLatinNumber(Math.round(price))}
              </text>
            </g>
          );
        })}
        <path d={line} fill="none" stroke="#0C7BB3" strokeWidth={2.5} strokeLinecap="round" />
        {coords.map((c) => (
          <circle key={c.date} cx={c.x} cy={c.y} r={3} fill="#0C7BB3" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
      <p className="font-latin mt-1 text-xs text-slate-500">
        أدنى سعر حالي: {canConvert ? `\u200E≈ ${fmtIn(points[points.length - 1]?.price ?? 0, labelCurrency)}` : fmt(points[points.length - 1]?.price ?? 0, currency)}
      </p>
    </div>
  );
}
