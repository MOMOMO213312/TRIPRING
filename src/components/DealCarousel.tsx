import { useDealImage } from "../hooks/useCatalog";
import type { Catalog } from "../hooks/useCatalog";
import { getTypicalPrice } from "../lib/api";
import { formatRouteCities, savingsPercent } from "../lib/deal-utils";
import type { DealRow } from "../types/database";
import { DestinationCard } from "./DestinationCard";

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
      <div className="marquee-track flex w-max gap-3 px-4 sm:px-0" style={{ animationDuration: `${durationSeconds}s` }}>
        {loopItems.map((deal, idx) => (
          <OpportunityCard key={`${deal.id}-${idx}`} deal={deal} catalog={catalog} />
        ))}
      </div>
    </div>
  );
}

function OpportunityCard({ deal, catalog }: { deal: DealRow; catalog: Catalog }) {
  const imageUrl = useDealImage(deal.to_airport, catalog, deal.id);
  const typical = getTypicalPrice(deal, catalog.references);
  const savings = savingsPercent(deal.price, typical);

  return (
    <DestinationCard
      to={`/deals/${deal.id}`}
      image={imageUrl}
      title={formatRouteCities(deal, catalog.airports)}
      priceLabel="يبدأ من"
      price={deal.price}
      badge={
        <div className="flex items-center gap-1.5">
          {deal.deal_score != null ? (
            <span className="font-latin rounded-full bg-white/95 px-2 py-0.5 text-xs font-extrabold text-gray-900 shadow-sm backdrop-blur-sm">
              {deal.deal_score}
            </span>
          ) : null}
          {savings ? (
            <span className="font-latin rounded-full bg-green-500/95 px-2 py-0.5 text-xs font-bold text-white shadow-sm backdrop-blur-sm">
              -{savings}%
            </span>
          ) : null}
        </div>
      }
    />
  );
}
