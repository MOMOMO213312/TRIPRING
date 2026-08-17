import { useNavigate } from "react-router-dom";

const CHIPS = [
  { icon: "💰", label: "أقل سعر", sort: "price_asc" },
  { icon: "🔥", label: "أعلى توفير", sort: "deal_score" },
  { icon: "⭐", label: "أعلى Deal Score", sort: "deal_score" },
  { icon: "✈️", label: "بدون توقف", stops: "direct" },
  { icon: "📅", label: "تواريخ مرنة", flexible: "1" },
] as const;

export function SmartFilterChips() {
  const navigate = useNavigate();

  function go(chip: (typeof CHIPS)[number]) {
    const q = new URLSearchParams();
    if ("sort" in chip && chip.sort) q.set("sort", chip.sort);
    if ("stops" in chip && chip.stops) q.set("stops", chip.stops);
    if ("flexible" in chip && chip.flexible) q.set("flexible", chip.flexible);
    navigate(`/search?${q.toString()}`);
  }

  return (
    <div className="scrollbar-none -mt-1 flex gap-2 overflow-x-auto px-4 pb-1 sm:justify-center sm:px-0">
      {CHIPS.map((chip) => (
        <button key={chip.label} type="button" onClick={() => go(chip)} className="smart-chip">
          <span aria-hidden>{chip.icon}</span>
          {chip.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => navigate("/deals")}
        className="smart-chip border-dashed text-gray-500"
      >
        + كل الفلاتر
      </button>
    </div>
  );
}
