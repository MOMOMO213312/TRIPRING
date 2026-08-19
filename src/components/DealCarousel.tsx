import type { Catalog } from "../hooks/useCatalog";
import type { DealRow } from "../types/database";
import { FlightDealCard } from "./FlightDealCard";

export function DealCarousel({ deals, catalog }: { deals: DealRow[]; catalog: Catalog }) {
  if (deals.length === 0) return null;

  // Duplicate the list so the marquee track can loop seamlessly: translating
  // the track by exactly -50% of its width lands back on an identical copy
  // of the first card, so the motion never "jumps". Same technique as the
  // "Travel To" destinations marquee, so both sections move the same way.
  const loopItems = [...deals, ...deals];
  const durationSeconds = deals.length * 4.5;

  return (
    <div dir="ltr" className="group/marquee overflow-hidden">
      <div className="marquee-track flex w-max gap-4 px-4 sm:px-0" style={{ animationDuration: `${durationSeconds}s` }}>
        {loopItems.map((deal, idx) => (
          <FlightDealCard key={`${deal.id}-${idx}`} deal={deal} catalog={catalog} />
        ))}
      </div>
    </div>
  );
}
