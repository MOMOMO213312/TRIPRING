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
import { PortalShell } from "../components/portal/PortalShell";
import type { PortalNavItem } from "../components/portal/PortalShell";
import type { PortalIconName } from "../components/portal/PortalIcon";
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
  icon: PortalIconName;
  subTabs: { key: SubTab; label: string }[];
};

const GROUPS: Group[] = [
  { key: "home", icon: "dashboard", label: "الرئيسية", subTabs: [{ key: "home", label: "الرئيسية" }] },
  {
    key: "search",
    icon: "search",
    label: "البحث والحجز",
    subTabs: [
      { key: "deals", label: "العروض" },
      { key: "tripgo", label: "🚐 TripGo" },
    ],
  },
  { key: "customers", icon: "users", label: "العملاء", subTabs: [{ key: "customers", label: "العملاء" }] },
  { key: "trips", icon: "plane", label: "رحلاتي", subTabs: [{ key: "bookings", label: "الحجوزات والتذاكر" }] },
  {
    key: "services_group",
    icon: "star",
    label: "الخدمات",
    subTabs: [
      { key: "services", label: "خدماتي" },
      { key: "service_requests", label: "طلبات الخدمات" },
    ],
  },
  {
    key: "admin",
    icon: "sliders",
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
    return <div className="pt-center text-sm text-slate-500">جاري التحميل...</div>;
  }

  if (!user) {
    return (
      <div className="pt-center">
        <AgencyLoginGate />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="pt-center">
        <div className="mx-auto max-w-lg space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-bold text-amber-900">هذا الحساب غير مفعّل كحساب وكالة</p>
          <p className="text-sm text-amber-800">
            تواصل مع إدارة TripRing لتفعيل صلاحيات الوكالة على هذا الحساب.
          </p>
          <Button variant="outline" onClick={() => signOut().then(() => window.location.reload())}>
            تسجيل الخروج
          </Button>
        </div>
      </div>
    );
  }

  const activeGroup = groupOf(tab);

  const nav: PortalNavItem[] = GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    icon: g.icon,
    onClick: () => setTab(g.subTabs[0].key),
  }));

  return (
    <PortalShell
      portal="agency"
      portalLabel="Partner Portal"
      roleLabel="وكالة سفر"
      orgName={profile.agency_name ?? "وكالتك"}
      userName={profile.full_name ?? "مستخدم"}
      nav={nav}
      activeKey={activeGroup.key}
      topbarExtra={<NotificationBell />}
      onSignOut={() => signOut().then(() => window.location.reload())}
    >
      {/* Sub-tabs, only shown when the active section has more than one */}
      {activeGroup.subTabs.length > 1 ? (
        <div className="pt-tabs">
          {activeGroup.subTabs.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setTab(s.key)}
              className={`pt-tab${tab === s.key ? " active" : ""}`}
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
    </PortalShell>
  );
}
