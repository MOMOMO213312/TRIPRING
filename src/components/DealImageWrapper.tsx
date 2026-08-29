import { DealCard } from "./DealCard";
import { useDealImage } from "../hooks/useCatalog";
import type { Catalog } from "../hooks/useCatalog";
import type { DealRow } from "../types/database";

export function DealImageWrapper({
  deal,
  catalog,
  rank,
  compact,
  comparing,
  onToggleCompare,
}: {
  deal: DealRow;
  catalog: Catalog;
  rank?: number;
  compact?: boolean;
  comparing?: boolean;
  onToggleCompare?: (dealId: string) => void;
}) {
  const imageUrl = useDealImage(deal.to_airport, catalog, deal.id);
  return (
    <DealCard
      deal={deal}
      airports={catalog.airports}
      airlines={catalog.airlines}
      agencies={catalog.agencies}
      references={catalog.references}
      imageUrl={imageUrl}
      rank={rank}
      compact={compact}
      comparing={comparing}
      onToggleCompare={onToggleCompare}
    />
  );
}
