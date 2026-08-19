import type { PriceTrendPoint } from "../lib/api";
import { formatLatinNumber, formatPrice } from "../lib/utils";

type Props = {
  title: string;
  points: PriceTrendPoint[];
};

export function PriceHistoryChart({ title, points }: Props) {
  if (points.length < 2) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="font-bold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-500">لا توجد بيانات كافية لعرض الرسم البياني</p>
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
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="font-bold text-gray-900">{title}</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 w-full max-w-lg" aria-label={title}>
        {[0, 0.5, 1].map((t) => {
          const y = height - pad - t * (height - pad * 2);
          const price = minP + t * range;
          return (
            <g key={t}>
              <line x1={pad} x2={width - pad} y1={y} y2={y} stroke="#E5E7EB" strokeWidth={1} />
              <text x={4} y={y + 4} className="fill-gray-400 text-[10px]">
                {formatLatinNumber(Math.round(price))}
              </text>
            </g>
          );
        })}
        <path d={line} fill="none" stroke="#299FD1" strokeWidth={2.5} strokeLinecap="round" />
        {coords.map((c) => (
          <circle key={c.date} cx={c.x} cy={c.y} r={3} fill="#299FD1" />
        ))}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-gray-400">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
      <p className="font-latin mt-1 text-xs text-gray-500">
        أدنى سعر حالي: {formatPrice(points[points.length - 1]?.price ?? 0)}
      </p>
    </div>
  );
}
