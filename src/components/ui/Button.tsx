import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type Variant = "primary" | "secondary" | "outline" | "whatsapp";

const variants: Record<Variant, string> = {
  primary: "bg-[#0D9488] text-white hover:bg-[#0F766E]",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  outline: "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
  whatsapp: "bg-[#25D366] text-white hover:bg-[#1da851]",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
};

export function Button({
  variant = "primary",
  fullWidth,
  className,
  children,
  ...props
}: Props) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50",
        variants[variant],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
