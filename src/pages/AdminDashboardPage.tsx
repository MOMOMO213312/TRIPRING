import { useEffect, useState } from "react";

import { AdminAgenciesTab } from "../components/admin/AdminAgenciesTab";
import { AdminBookingsTab } from "../components/admin/AdminBookingsTab";
import { AdminCustomerSubscriptionsTab } from "../components/admin/AdminCustomerSubscriptionsTab";
import { AdminFarePackageTiersTab } from "../components/admin/AdminFarePackageTiersTab";
import { AdminFulfillmentTab } from "../components/admin/AdminFulfillmentTab";
import { AdminMembershipTiersTab } from "../components/admin/AdminMembershipTiersTab";
import { AdminNotificationsTab } from "../components/admin/AdminNotificationsTab";
import { AdminSettlementsTab } from "../components/admin/AdminSettlementsTab";
import { AdminSuppliersTab } from "../components/admin/AdminSuppliersTab";
import { AdminSupplierApplicationsTab } from "../components/admin/AdminSupplierApplicationsTab";
import { AdminResaleTab } from "../components/admin/AdminResaleTab";
import { AdminResellerOrdersTab } from "../components/admin/AdminResellerOrdersTab";
import { AdminResellerPlansTab } from "../components/admin/AdminResellerPlansTab";
import { AdminResellerSubscriptionsTab } from "../components/admin/AdminResellerSubscriptionsTab";
import { AgencyLoginGate } from "../components/agency/AgencyLoginGate";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { PortalShell } from "../components/portal/PortalShell";
import type { PortalNavItem } from "../components/portal/PortalShell";
import { Button } from "../components/ui/Button";
import { fetchMyAdminProfile } from "../lib/admin";
import { signOut, useAuth } from "../lib/auth";
import { PAYMENT_DETAILS_ARE_PLACEHOLDER } from "../lib/payment-config";
import type { ProfileRow } from "../types/database";

type Tab =
  | "suppliers"
  | "supplier_applications"
  | "fulfillment"
  | "settlements"
  | "agencies"
  | "bookings"
  | "resale"
  | "notifications"
  | "reseller_plans"
  | "reseller_subscriptions"
  | "reseller_orders"
  | "membership_tiers"
  | "customer_subscriptions"
  | "fare_package_tiers";

export function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("suppliers");

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
    return <div className="pt-center text-sm text-slate-500">جاري التحميل...</div>;
  }

  // Same login form used by the agency dashboard — one email/password gate,
  // the role decides which dashboard the account actually sees.
  if (!user) {
    return (
      <div className="pt-center">
        <AgencyLoginGate title="دخول لوحة الأدمن" subtitle="هذه اللوحة مخصصة لإدارة TripRing فقط." />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="pt-center">
        <div className="mx-auto max-w-lg space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="font-bold text-amber-900">هذا الحساب مش عنده صلاحيات أدمن</p>
          <p className="text-sm text-amber-800">
            لازم يكون role الحساب في جدول profiles = admin. يتحدد يدويًا من قاعدة البيانات حاليًا.
          </p>
          <Button variant="outline" onClick={() => signOut().then(() => window.location.reload())}>
            تسجيل الخروج
          </Button>
        </div>
      </div>
    );
  }

  // Same 14 tabs as before, now driven from the sidebar and grouped by
  // function. Tab components themselves are untouched.
  const nav: PortalNavItem[] = (
    [
      ["suppliers", "الموردين والعقود", "truck", "الشركاء والموردون"],
      ["supplier_applications", "طلبات الانضمام كمورد", "mail", "الشركاء والموردون"],
      ["agencies", "الوكالات", "building", "الشركاء والموردون"],
      ["fulfillment", "مراقبة التنفيذ", "activity", "العمليات"],
      ["bookings", "كل الحجوزات", "list", "العمليات"],
      ["resale", "مراجعة إعادة البيع", "refresh", "العمليات"],
      ["notifications", "الإشعارات", "bell", "العمليات"],
      ["settlements", "التسويات المالية", "wallet", "المالية"],
      ["reseller_plans", "باقات الأفلييت", "tag", "الأفلييت والاشتراكات"],
      ["reseller_subscriptions", "مراجعة اشتراكات الأفلييت", "shield", "الأفلييت والاشتراكات"],
      ["reseller_orders", "طلبات بيع الأفلييت", "box", "الأفلييت والاشتراكات"],
      ["membership_tiers", "باقات الاشتراك", "star", "الأفلييت والاشتراكات"],
      ["customer_subscriptions", "مراجعة اشتراكات العملاء", "users", "الأفلييت والاشتراكات"],
      ["fare_package_tiers", "باقات الرحلة", "layers", "الأفلييت والاشتراكات"],
    ] as const
  ).map(([key, label, icon, section]) => ({
    key,
    label,
    icon,
    section,
    onClick: () => setTab(key),
  }));

  return (
    <PortalShell
      portal="admin"
      portalLabel="TripRing Admin"
      roleLabel="أدمن"
      orgName="صلاحية إدارة كاملة"
      userName={profile.full_name ?? "مستخدم"}
      nav={nav}
      activeKey={tab}
      topbarExtra={<NotificationBell />}
      onSignOut={() => signOut().then(() => window.location.reload())}
    >
      {PAYMENT_DETAILS_ARE_PLACEHOLDER ? (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-bold">⚠️ بيانات دفع وهمية (Placeholder) لسه مفعّلة</p>
          <p className="mt-1">
            واحد أو أكتر من: رقم IBAN / معرّف InstaPay / رقم Vodafone Cash لسه على القيمة الافتراضية
            وليس بيانات الشركة الحقيقية. أي عميل يشوف صفحة الدفع دلوقتي ممكن يحول فلوسه لحساب غلط.
            لازم تتحدد القيم الحقيقية في متغيرات البيئة (VITE_BANK_IBAN, VITE_INSTAPAY_HANDLE,
            VITE_VODAFONE_CASH_NUMBER) قبل أي إطلاق حقيقي.
          </p>
        </div>
      ) : null}
      {tab === "suppliers" ? <AdminSuppliersTab /> : null}
      {tab === "supplier_applications" ? <AdminSupplierApplicationsTab /> : null}
      {tab === "fulfillment" ? <AdminFulfillmentTab /> : null}
      {tab === "settlements" ? <AdminSettlementsTab /> : null}
      {tab === "agencies" ? <AdminAgenciesTab /> : null}
      {tab === "bookings" ? <AdminBookingsTab /> : null}
      {tab === "resale" ? <AdminResaleTab /> : null}
      {tab === "notifications" ? <AdminNotificationsTab /> : null}
      {tab === "reseller_plans" ? <AdminResellerPlansTab /> : null}
      {tab === "reseller_subscriptions" ? <AdminResellerSubscriptionsTab /> : null}
      {tab === "reseller_orders" ? <AdminResellerOrdersTab /> : null}
      {tab === "membership_tiers" ? <AdminMembershipTiersTab /> : null}
      {tab === "customer_subscriptions" ? <AdminCustomerSubscriptionsTab /> : null}
      {tab === "fare_package_tiers" ? <AdminFarePackageTiersTab /> : null}
    </PortalShell>
  );
}
