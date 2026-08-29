import type { InputHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string };

export function Input({ label, error, className, id, ...props }: Props) {
  const inputId = id ?? props.name;
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-sm font-medium text-slate-700">{label}</span> : null}
      <input
        id={inputId}
        className={cn(
          "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-[#BFE3F6]",
          error && "border-red-300 focus:border-red-400 focus:ring-red-100",
          className,
        )}
        {...props}
      />
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
