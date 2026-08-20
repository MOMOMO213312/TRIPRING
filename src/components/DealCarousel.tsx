import type { Catalog } from "../hooks/useCatalog";
import type { DealRow } from "../types/database";
import { FlightDealCard } from "./FlightDealCard";

// Roughly a card's rendered width (280px) plus the row's gap-4 (16px). Only
// used to estimate how many duplicated copies of the deal list are needed to
// guarantee the marquee track is always wider than the widest realistic
// viewport — otherwise, with very few live deals, the track runs out of
// cards mid-scroll and the row visibly empties out into blank white space.
const APPROX_CARD_WIDTH = 296;
// Comfortably covers ultra-wide monitors; the track only needs to be this
// wide once, since it then loops by exactly one copy-width forever.
const TARGET_TRACK_WIDTH = 3600;
const MIN_COPIES = 2;
const MAX_COPIES = 8;

export function DealCarousel({ deals, catalog }: { deals: DealRow[]; catalog: Catalog }) {
  if (deals.length === 0) return null;

  // Repeat the real deal list enough times that the total track width always
  // exceeds TARGET_TRACK_WIDTH, then loop by exactly one copy-width (-100/copies%)
  // so the seam is invisible — instead of always duplicating exactly once
  // (-50%), which leaves a visible gap once there are only a handful of deals.
  const setWidth = Math.max(deals.length * APPROX_CARD_WIDTH, 1);
  const copies = Math.min(
    MAX_COPIES,
    Math.max(MIN_COPIES, Math.ceil(TARGET_TRACK_WIDTH / setWidth)),
  );
  const loopItems = Array.from({ length: copies }, () => deals).flat();
  const durationSeconds = deals.length * copies * 2.25;

  return (
    <div dir="ltr" className="group/marquee overflow-hidden">
      <div
        className="marquee-track flex w-max gap-4 px-4 sm:px-0"
        style={{
          animationDuration: `${durationSeconds}s`,
          ["--marquee-loop-x" as string]: `-${100 / copies}%`,
        }}
      >
        {loopItems.map((deal, idx) => (
          <FlightDealCard key={`${deal.id}-${idx}`} deal={deal} catalog={catalog} />
        ))}
      </div>
    </div>
  );
}
