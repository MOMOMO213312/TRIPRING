import type { SelectHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type Option = { value: string; label: string };

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  options: Option[];
  placeholder?: string;
};

export function Select({ label, options, placeholder, className, ...props }: Props) {
  return (
    <label className="block space-y-1.5">
      {label ? <span className="text-sm font-medium text-slate-700">{label}</span> : null}
      <select
        className={cn(
          "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-[#BFE3F6]",
          className,
        )}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
