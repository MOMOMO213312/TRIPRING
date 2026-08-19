import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-slate-200 bg-white p-4 sm:p-5", className)}
      {...props}
    >
      {children}
    </div>
  );
}
