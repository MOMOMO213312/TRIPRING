import { useEffect, useState } from "react";

import { AgencyBookingServicesTab } from "../components/agency/AgencyBookingServicesTab";
import { AgencyBookingsTab } from "../components/agency/AgencyBookingsTab";
import { AgencyCustomersTab } from "../components/agency/AgencyCustomersTab";
import { AgencyDealsTab } from "../components/agency/AgencyDealsTab";
import { AgencyDocumentsTab } from "../components/agency/AgencyDocumentsTab";
import { AgencyHomeTab } from "../components/agency/AgencyHomeTab";
import { AgencyPaymentTab } from "../components/agency/AgencyPaymentTab";
import { AgencyServicesTab } from "../components/agency/AgencyServicesTab";
import { AgencyTeamTab } from "../components/agency/AgencyTeamTab";
import { AgencyTripGoTab } from "../components/agency/AgencyTripGoTab";
import { AgencyLoginGate } from "../components/agency/AgencyLoginGate";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { fetchMyAgencyProfile, type AgencyProfile } from "../lib/agency";
import { signOut, useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";

// 6 top-level sections (the agreed IA), each holding one or more of the
// existing tabs. Grouping is UI-only — no tab's own component/logic changed.
type SubTab =
  | "home"
  | "deals"
  | "tripgo"
  | "customers"
  | "bookings"
  | "services"
  | "service_requests"
  | "payments"
  | "documents"
  | "team";

type Group = {
  key: string;
  label: string;
  subTabs: { key: SubTab; label: string }[];
};

const GROUPS: Group[] = [
  { key: "home", label: "الرئيسية", subTabs: [{ key: "home", label: "الرئيسية" }] },
  {
    key: "search",
    label: "البحث والحجز",
    subTabs: [
      { key: "deals", label: "العروض" },
      { key: "tripgo", label: "🚐 TripGo" },
    ],
  },
  { key: "customers", label: "العملاء", subTabs: [{ key: "customers", label: "العملاء" }] },
  { key: "trips", label: "رحلاتي", subTabs: [{ key: "bookings", label: "الحجوزات والتذاكر" }] },
  {
    key: "services_group",
    label: "الخدمات",
    subTabs: [
      { key: "services", label: "خدماتي" },
      { key: "service_requests", label: "طلبات الخدمات" },
    ],
  },
  {
    key: "admin",
    label: "الإدارة",
    subTabs: [
      { key: "payments", label: "الدفع/الحالة" },
      { key: "documents", label: "الوثائق والشهادات" },
      { key: "team", label: "الفريق" },
    ],
  },
];

function groupOf(sub: SubTab): Group {
  return GROUPS.find((g) => g.subTabs.some((s) => s.key === sub))!;
}

export function AgencyDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<AgencyProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [tab, setTab] = useState<SubTab>("home");
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

  const activeGroup = groupOf(tab);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">لوحة الوكالة</h1>
          <p className="text-sm text-slate-500">
            {profile.agency_name ?? "وكالتك"} — {profile.full_name ?? "مستخدم"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Button variant="outline" onClick={() => signOut().then(() => window.location.reload())}>
            تسجيل الخروج
          </Button>
        </div>
      </div>

      {/* Level 1: the 6 sections */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setTab(g.subTabs[0].key)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              activeGroup.key === g.key ? "bg-[#0C7BB3] text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Level 2: sub-tabs, only shown when the active section has more than one */}
      {activeGroup.subTabs.length > 1 ? (
        <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
          {activeGroup.subTabs.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setTab(s.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === s.key ? "bg-[#E5F4FB] text-[#0C7BB3]" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "home" ? (
        <AgencyHomeTab agencyId={profile.agency_id!} agencyName={profile.agency_name} key={`home-${refreshKey}`} />
      ) : null}
      {tab === "deals" ? (
        <AgencyDealsTab agencyId={profile.agency_id!} key={`deals-${refreshKey}`} />
      ) : null}
      {tab === "tripgo" ? <AgencyTripGoTab agencyId={profile.agency_id!} key={`tripgo-${refreshKey}`} /> : null}
      {tab === "customers" ? (
        <AgencyCustomersTab agencyId={profile.agency_id!} key={`customers-${refreshKey}`} />
      ) : null}
      {tab === "services" ? <AgencyServicesTab agencyId={profile.agency_id!} key={`services-${refreshKey}`} /> : null}
      {tab === "bookings" ? (
        <AgencyBookingsTab
          agencyId={profile.agency_id!}
          key={`bookings-${refreshKey}`}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      ) : null}
      {tab === "service_requests" ? (
        <AgencyBookingServicesTab agencyId={profile.agency_id!} key={`service_requests-${refreshKey}`} />
      ) : null}
      {tab === "payments" ? (
        <AgencyPaymentTab
          agencyId={profile.agency_id!}
          key={`payments-${refreshKey}`}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      ) : null}
      {tab === "documents" ? <AgencyDocumentsTab agencyId={profile.agency_id!} key={`documents-${refreshKey}`} /> : null}
      {tab === "team" ? (
        <AgencyTeamTab
          agencyId={profile.agency_id!}
          isOwner={profile.agency_role === "owner"}
          key={`team-${refreshKey}`}
        />
      ) : null}
    </div>
  );
}
