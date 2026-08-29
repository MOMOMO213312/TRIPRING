import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchPublicAnnouncements } from "../../lib/notifications";
import type { NotificationRow } from "../../types/database";

const TYPE_ICON: Partial<Record<NotificationRow["type"], string>> = {
  flash_deal: "🔥",
  airport_info: "✈️",
  circular: "📢",
  site_announcement: "📣",
};

/** Public scrolling ticker for site-wide announcements (deals, news, updates).
 *  Shows every sent `all_public` announcement automatically — no separate
 *  "is_ticker" flag to remember when publishing, so nothing gets missed.
 *  Shows nothing if there are no active announcements. */
export function AnnouncementTicker() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchPublicAnnouncements()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  if (dismissed || items.length === 0) return null;

  return (
    <div className="relative border-b border-[#1E3A8A]/10 bg-[#1E3A8A] text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-xs sm:text-sm">
        <div className="flex-1 overflow-hidden">
          <div className="flex animate-[ticker_28s_linear_infinite] items-center gap-10 whitespace-nowrap">
            {[...items, ...items].map((n, idx) => (
              <span key={`${n.id}-${idx}`} className="inline-flex items-center gap-1.5">
                <span>{TYPE_ICON[n.type] ?? "📌"}</span>
                {n.link_url ? (
                  <Link to={n.link_url} className="font-semibold hover:underline">
                    {n.title}
                  </Link>
                ) : (
                  <span className="font-semibold">{n.title}</span>
                )}
                {n.body ? <span className="text-white/70">— {n.body}</span> : null}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="إخفاء"
          className="shrink-0 rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>
      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
