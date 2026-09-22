import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

// "تواريخ مرنة" (flexible dates) was removed from here — it linked to
// /search?flexible=1 but SearchResultsPage never read or applied that
// param, so the chip silently did nothing. Flexible-date search (widening
// the query across a date range, not just the single-deal ±3-day view on
// DealDetailPage) needs real implementation before this chip comes back.
const CHIPS = [
  { icon: "💰", id: "cheapest", sort: "price_asc" },
  { icon: "✈️", id: "direct", stops: "direct" },
] as const;

export function SmartFilterChips() {
  const { t } = useTranslation("search");
  const navigate = useNavigate();

  function go(chip: (typeof CHIPS)[number]) {
    const q = new URLSearchParams();
    if ("sort" in chip && chip.sort) q.set("sort", chip.sort);
    if ("stops" in chip && chip.stops) q.set("stops", chip.stops);
    navigate(`/search?${q.toString()}`);
  }

  return (
    <div className="scrollbar-none -mt-1 flex gap-2 overflow-x-auto px-4 pb-1 sm:justify-center sm:px-0">
      {CHIPS.map((chip) => (
        <button key={chip.id} type="button" onClick={() => go(chip)} className="smart-chip">
          <span aria-hidden>{chip.icon}</span>
          {t(`chips.${chip.id}`)}
        </button>
      ))}
      <button
        type="button"
        onClick={() => navigate("/deals")}
        className="smart-chip border-dashed text-slate-500"
      >
        {t("chips.allFilters")}
      </button>
    </div>
  );
}
