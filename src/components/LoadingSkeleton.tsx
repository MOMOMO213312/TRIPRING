/** Grid of pulsing skeleton cards, shown instead of "جاري التحميل..." text while deals/cards load. */
export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-pulse h-[360px]" />
      ))}
    </div>
  );
}

/** Single-line skeleton bar, for lists/rows (trips, alerts, resale tickets). */
export function LineSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-pulse h-16" />
      ))}
    </div>
  );
}
