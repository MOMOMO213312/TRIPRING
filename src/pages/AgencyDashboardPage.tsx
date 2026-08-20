import { useEffect, useState } from "react";

import { AgencyBookingsTab } from "../components/agency/AgencyBookingsTab";
import { AgencyDealsTab } from "../components/agency/AgencyDealsTab";
import { AgencyPaymentTab } from "../components/agency/AgencyPaymentTab";
import { AgencyLoginGate } from "../components/agency/AgencyLoginGate";
import { fetchMyAgencyProfile, type AgencyProfile } from "../lib/agency";
import { signOut, useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";

type Tab = "deals" | "bookings" | "payments";

export function AgencyDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<AgencyProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("deals");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    fetchMyAgencyProfile()
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

  if (!user) {
    return <AgencyLoginGate />;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="font-bold text-amber-900">هذا الحساب غير مفعّل كحساب وكالة</p>
        <p className="text-sm text-amber-800">
          تواصل مع إدارة TripRing لتفعيل صلاحيات الوكالة على هذا الحساب.
        </p>
        <Button variant="outline" onClick={() => signOut().then(() => window.location.reload())}>
          تسجيل الخروج
        </Button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "deals", label: "العروض" },
    { key: "bookings", label: "الحجوزات" },
    { key: "payments", label: "الدفع/الحالة" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">لوحة الوكالة</h1>
          <p className="text-sm text-slate-500">
            {profile.agency_name ?? "وكالتك"} — {profile.full_name ?? "مستخدم"}
          </p>
        </div>
        <Button variant="outline" onClick={() => signOut().then(() => window.location.reload())}>
          تسجيل الخروج
        </Button>
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

      {tab === "deals" ? (
        <AgencyDealsTab agencyId={profile.agency_id!} key={`deals-${refreshKey}`} />
      ) : null}
      {tab === "bookings" ? (
        <AgencyBookingsTab
          agencyId={profile.agency_id!}
          key={`bookings-${refreshKey}`}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      ) : null}
      {tab === "payments" ? (
        <AgencyPaymentTab
          agencyId={profile.agency_id!}
          key={`payments-${refreshKey}`}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      ) : null}
    </div>
  );
}
