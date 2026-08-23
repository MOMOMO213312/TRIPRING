import { useEffect, useMemo, useState } from "react";

import { hoursUntil } from "../lib/filters";

/** Live HH:MM:SS countdown to a deal's expires_at, or null while it's still far off / already expired. */
export function DealCountdown({ expiresAt }: { expiresAt: string }) {
  const [hoursLeft, setHoursLeft] = useState(() => hoursUntil(expiresAt));

  useEffect(() => {
    setHoursLeft(hoursUntil(expiresAt));
    const id = setInterval(() => setHoursLeft(hoursUntil(expiresAt)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const label = useMemo(() => {
    if (hoursLeft == null || hoursLeft <= 0) return null;
    const totalSeconds = Math.floor(hoursLeft * 3600);
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [hoursLeft]);

  if (!label) return null;

  return (
    <span
      dir="ltr"
      className="font-latin flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-1 text-[10px] font-bold text-slate-800 shadow-sm backdrop-blur-sm"
    >
      <span aria-hidden>⏱</span>
      {label}
    </span>
  );
}
