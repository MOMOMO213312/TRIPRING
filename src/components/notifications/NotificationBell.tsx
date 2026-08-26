import { useEffect, useRef, useState } from "react";

import { fetchMyNotifications, fetchMyReadIds, markNotificationRead, NOTIFICATION_TYPE_LABELS } from "../../lib/notifications";
import type { NotificationRow } from "../../types/database";

/** Bell + dropdown for signed-in users (agency staff, affiliates, admin).
 *  RLS scopes `fetchMyNotifications` to what this account is allowed to see —
 *  no role prop needed here. */
export function NotificationBell() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  function load() {
    setLoading(true);
    Promise.all([fetchMyNotifications(), fetchMyReadIds()])
      .then(([n, r]) => {
        setItems(n);
        setReadIds(r);
      })
      .catch(() => {
        /* silent — the bell just stays empty on failure */
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = items.filter((n) => !readIds.has(n.id)).length;

  async function handleOpenItem(n: NotificationRow) {
    if (!readIds.has(n.id)) {
      setReadIds((prev) => new Set(prev).add(n.id));
      markNotificationRead(n.id).catch(() => {
        /* best-effort */
      });
    }
    if (n.link_url) window.location.assign(n.link_url);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="الإشعارات"
        className="relative flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-[#0C7BB3]/40 hover:text-[#0C7BB3]"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4.5">
          <path d="M6 8a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 6.5H4.5C4.5 13.5 6 12 6 8Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 18a2.5 2.5 0 0 0 5 0" strokeLinecap="round" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute left-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-900">الإشعارات</div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">جاري التحميل...</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">لا يوجد إشعارات حاليًا</p>
            ) : (
              items.map((n) => {
                const unread = !readIds.has(n.id);
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleOpenItem(n)}
                    className={`block w-full border-b border-slate-50 px-4 py-3 text-right transition hover:bg-slate-50 ${
                      unread ? "bg-[#0C7BB3]/5" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{n.title}</span>
                      {unread ? <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#0C7BB3]" /> : null}
                    </div>
                    {n.body ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p> : null}
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{NOTIFICATION_TYPE_LABELS[n.type]}</span>
                      <span>·</span>
                      <span>{new Date(n.created_at).toLocaleDateString("ar-EG")}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
