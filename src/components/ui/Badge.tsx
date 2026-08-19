import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

type Tone = "default" | "flash" | "last_minute" | "empty_seat" | "special_fare" | "savings" | "urgent";

const tones: Record<Tone, string> = {
  default: "bg-gray-100 text-gray-700",
  flash: "bg-[#D2EEF9] text-[#155E7A]",
  last_minute: "bg-amber-100 text-amber-800",
  empty_seat: "bg-green-100 text-green-800",
  special_fare: "bg-purple-100 text-purple-800",
  savings: "bg-green-50 text-green-700 border border-green-200",
  urgent: "bg-red-50 text-red-700 border border-red-200",
};

type Props = HTMLAttributes<HTMLSpanElement> & { tone?: Tone };

export function Badge({ tone = "default", className, children, ...props }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
