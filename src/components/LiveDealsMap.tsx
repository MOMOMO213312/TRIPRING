import { useMemo } from "react";

import { airportLabel } from "../lib/deal-utils";
import { projectAirport } from "../lib/geo";
import { formatPrice } from "../lib/utils";
import type { AirportRow, DealRow } from "../types/database";
import { Card } from "./ui/Card";

type Props = {
  deals: DealRow[];
  airports: AirportRow[];
};

// Stylized (not geographically precise) continent silhouettes — enough to
// read as "world map" at a glance, matching the flat look used elsewhere.
const CONTINENTS = [
  // North America
  "M120,70 C180,55 250,60 280,90 C300,115 290,150 260,175 C240,195 200,210 175,230 C150,245 115,235 100,205 C85,175 90,130 100,100 C105,85 110,75 120,70 Z",
  // South America
  "M230,255 C255,245 285,255 295,285 C305,320 300,360 285,395 C275,418 255,430 240,415 C225,398 220,360 215,325 C212,300 215,270 230,255 Z",
  // Europe
  "M470,75 C505,65 545,70 565,90 C580,105 570,125 550,135 C525,145 495,140 475,125 C462,113 460,90 470,75 Z",
  // Africa
  "M475,165 C520,155 570,160 595,190 C610,215 605,250 595,285 C585,320 570,360 545,385 C525,400 505,390 495,365 C480,325 475,280 470,235 C468,210 468,185 475,165 Z",
  // Asia
  "M600,60 C660,45 740,50 810,70 C870,88 920,110 935,145 C945,170 920,190 890,195 C850,200 810,180 775,190 C740,200 715,225 685,215 C660,205 655,175 630,160 C605,145 590,130 590,105 C590,88 592,72 600,60 Z",
  // Australia
  "M855,320 C890,312 930,318 945,340 C955,358 945,378 920,385 C895,392 865,388 850,368 C840,352 842,332 855,320 Z",
];

export function LiveDealsMap({ deals, airports }: Props) {
  const points = useMemo(() => {
    const seen = new Map<string, { code: string; count: number; price: number }>();
    for (const d of deals) {
      const code = d.to_airport;
      const existing = seen.get(code);
      if (existing) {
        existing.count += 1;
        existing.price = Math.min(existing.price, d.price);
      } else {
        seen.set(code, { code, count: 1, price: d.price });
      }
    }
    return [...seen.values()]
      .map((v) => ({ ...v, pos: projectAirport(v.code) }))
      .filter((v): v is typeof v & { pos: { x: number; y: number } } => v.pos !== null);
  }, [deals]);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold text-slate-900">خريطة العروض المباشرة</h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#DC2626]" /> عدة عروض نشطة
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-[#16A34A]" /> عرض واحد نشط
          </span>
        </div>
      </div>

      <svg viewBox="0 0 1000 500" className="w-full rounded-lg bg-[#0B1220]">
        {CONTINENTS.map((d, i) => (
          <path key={i} d={d} fill="#1E2A45" stroke="#28365A" strokeWidth={1} />
        ))}

        {points.length === 0 ? (
          <text x={500} y={250} textAnchor="middle" className="fill-slate-500 text-[16px]">
            لا توجد عروض نشطة لعرضها على الخريطة
          </text>
        ) : (
          points.map((p) => {
            const hot = p.count >= 3;
            const color = hot ? "#DC2626" : "#16A34A";
            return (
              <g key={p.code}>
                <circle cx={p.pos.x} cy={p.pos.y} r={hot ? 9 : 7} fill={color} fillOpacity={0.25}>
                  <animate attributeName="r" values={`${hot ? 9 : 7};${hot ? 16 : 12};${hot ? 9 : 7}`} dur="2.2s" repeatCount="indefinite" />
                  <animate attributeName="fill-opacity" values="0.3;0;0.3" dur="2.2s" repeatCount="indefinite" />
                </circle>
                <circle cx={p.pos.x} cy={p.pos.y} r={4} fill={color} stroke="#0B1220" strokeWidth={1.5}>
                  <title>
                    {airportLabel(p.code, airports)} — {formatPrice(p.price)}
                    {p.count > 1 ? ` (${p.count} عروض)` : ""}
                  </title>
                </circle>
              </g>
            );
          })
        )}
      </svg>

      <p className="mt-3 text-xs text-slate-400">
        مواقع تقريبية للوجهات ذات العروض النشطة حاليًا — النقطة الحمراء تعني 3 عروض نشطة أو أكثر على نفس الوجهة.
      </p>
    </Card>
  );
}
