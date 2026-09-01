import { useEffect, useState } from "react";

import { AdminAgenciesTab } from "../components/admin/AdminAgenciesTab";
import { AdminBookingsTab } from "../components/admin/AdminBookingsTab";
import { AdminDealsTab } from "../components/admin/AdminDealsTab";
import { AdminNotificationsTab } from "../components/admin/AdminNotificationsTab";
import { AdminResaleTab } from "../components/admin/AdminResaleTab";
import { AdminResellerOrdersTab } from "../components/admin/AdminResellerOrdersTab";
import { AdminResellerPlansTab } from "../components/admin/AdminResellerPlansTab";
import { AdminResellerSubscriptionsTab } from "../components/admin/AdminResellerSubscriptionsTab";
import { AgencyLoginGate } from "../components/agency/AgencyLoginGate";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { Button } from "../components/ui/Button";
import { fetchMyAdminProfile } from "../lib/admin";
import { signOut, useAuth } from "../lib/auth";
import type { ProfileRow } from "../types/database";

type Tab =
  | "agencies"
  | "deals"
  | "bookings"
  | "resale"
  | "notifications"
  | "reseller_plans"
  | "reseller_subscriptions"
  | "reseller_orders";

export function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("agencies");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    fetchMyAdminProfile()
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (authLoading || profileLoading) {
    return <div className="py-16 text-center text-sm text-slate-500">جاري التحميل...</div>;
  }

  // Same login form used by the agency dashboard — one email/password gate,
  // the role decides which dashboard the account actually sees.
  if (!user) {
    return <AgencyLoginGate title="دخول لوحة الأدمن" subtitle="هذه اللوحة مخصصة لإدارة TripRing فقط." />;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="font-bold text-amber-900">هذا الحساب مش عنده صلاحيات أدمن</p>
        <p className="text-sm text-amber-800">
          لازم يكون role الحساب في جدول profiles = admin. يتحدد يدويًا من قاعدة البيانات حاليًا.
        </p>
        <Button variant="outline" onClick={() => signOut().then(() => window.location.reload())}>
          تسجيل الخروج
        </Button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "agencies", label: "الوكالات" },
    { key: "deals", label: "الرحلات" },
    { key: "bookings", label: "كل الحجوزات" },
    { key: "resale", label: "مراجعة إعادة البيع" },
    { key: "notifications", label: "الإشعارات" },
    { key: "reseller_plans", label: "باقات الأفلييت" },
    { key: "reseller_subscriptions", label: "مراجعة اشتراكات الأفلييت" },
    { key: "reseller_orders", label: "طلبات بيع الأفلييت" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">لوحة الأدمن</h1>
          <p className="text-sm text-slate-500">{profile.full_name ?? "مستخدم"} — صلاحية إدارة كاملة</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Button variant="outline" onClick={() => signOut().then(() => window.location.reload())}>
            تسجيل الخروج
          </Button>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t.key ? "bg-[#0C7BB3] text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "agencies" ? <AdminAgenciesTab /> : null}
      {tab === "deals" ? <AdminDealsTab /> : null}
      {tab === "bookings" ? <AdminBookingsTab /> : null}
      {tab === "resale" ? <AdminResaleTab /> : null}
      {tab === "notifications" ? <AdminNotificationsTab /> : null}
      {tab === "reseller_plans" ? <AdminResellerPlansTab /> : null}
      {tab === "reseller_subscriptions" ? <AdminResellerSubscriptionsTab /> : null}
      {tab === "reseller_orders" ? <AdminResellerOrdersTab /> : null}
    </div>
  );
}
