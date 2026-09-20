import { useEffect, useRef, useState } from "react";

import { useCurrency } from "../hooks/useCurrency";

/**
 * Display-currency picker for the header. Changing it re-prices every customer-facing screen
 * (converted with the live rate); it does NOT change what a booking is charged in — that is chosen
 * on the checkout page from the currencies the payment side can actually collect.
 */
export function CurrencySwitcher({ align = "end" }: { align?: "start" | "end" }) {
  const { currency, setCurrency, currencies } = useCurrency();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="عملة العرض"
        className="font-latin flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:border-[#1E3A8A]/40 hover:text-[#1E3A8A]"
      >
        {currency}
        <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="اختر عملة العرض"
          className={`absolute top-full z-50 mt-2 max-h-80 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg ${
            align === "end" ? "end-0" : "start-0"
          }`}
        >
          {currencies.map((c) => (
            <li key={c.code} role="option" aria-selected={c.code === currency}>
              <button
                type="button"
                onClick={() => {
                  setCurrency(c.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start transition hover:bg-slate-50 ${
                  c.code === currency ? "bg-[#1E3A8A]/5 font-semibold text-[#1E3A8A]" : "text-slate-700"
                }`}
              >
                <span>{c.name_ar}</span>
                <span className="font-latin text-xs text-slate-500">{c.code}</span>
              </button>
            </li>
          ))}
          <li className="px-3 pb-2 pt-1 text-[11px] leading-snug text-slate-400">
            الأسعار المعروضة تقديرية بسعر الصرف الحالي — العملة النهائية للدفع بتتحدد وقت الحجز.
          </li>
        </ul>
      ) : null}
    </div>
  );
}
