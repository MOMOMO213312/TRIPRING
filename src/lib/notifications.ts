import { getCurrentUser } from "./auth";
import { supabase } from "./supabase";
import type { NotificationRow, NotificationStatus } from "../types/database";

// ── Public / customer-facing ────────────────────────────────────────────
/** Active public announcements (ticker/banner) — no auth required. */
export async function fetchPublicAnnouncements(): Promise<NotificationRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("audience", "all_public")
    .eq("status", "sent")
    .lte("starts_at", nowIso)
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as NotificationRow[];
}

// ── Signed-in bell (agency staff / affiliates / admin) ──────────────────
/** Sent notifications visible to the current signed-in user, per RLS (role/agency/affiliate scoped). */
export async function fetchMyNotifications(): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as NotificationRow[];
}

export async function fetchMyReadIds(): Promise<Set<string>> {
  const user = await getCurrentUser();
  if (!user) return new Set();
  const { data, error } = await supabase.from("notification_reads").select("notification_id").eq("customer_id", user.id);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => (r as { notification_id: string }).notification_id));
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const { error } = await supabase
    .from("notification_reads")
    .upsert([{ notification_id: notificationId, customer_id: user.id }] as never, {
      onConflict: "notification_id,customer_id",
    });
  if (error) throw new Error(error.message);
}

// ── Admin authoring ──────────────────────────────────────────────────────
export async function fetchAllNotificationsAdmin(): Promise<NotificationRow[]> {
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as NotificationRow[];
}

export type CreateNotificationInput = {
  type: NotificationRow["type"];
  title: string;
  body: string;
  linkUrl?: string | null;
  audience: NotificationRow["audience"];
  targetAgencyId?: string | null;
  targetAffiliateId?: string | null;
  channels: NotificationRow["channels"];
  isTicker: boolean;
  priority?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  scheduledAt?: string | null;
};

export async function createNotification(input: CreateNotificationInput): Promise<NotificationRow> {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("notifications")
    .insert([
      {
        type: input.type,
        title: input.title.trim(),
        body: input.body.trim(),
        link_url: input.linkUrl || null,
        audience: input.audience,
        target_agency_id: input.targetAgencyId || null,
        target_affiliate_id: input.targetAffiliateId || null,
        channels: input.channels,
        is_ticker: input.isTicker,
        priority: input.priority ?? "normal",
        starts_at: input.startsAt || new Date().toISOString(),
        ends_at: input.endsAt || null,
        scheduled_at: input.scheduledAt || null,
        status: input.scheduledAt ? "scheduled" : "draft",
        created_by: user?.id ?? null,
      },
    ] as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as NotificationRow;
}

export async function setNotificationStatus(id: string, status: NotificationStatus): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "sent") patch.sent_at = new Date().toISOString();
  const { error } = await supabase.from("notifications").update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Targeting lookups (for the admin "specific agency/affiliate" pickers) ─
export async function fetchAgenciesForTargeting(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from("agencies").select("id,name").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string }[];
}

export async function fetchAffiliatesForTargeting(): Promise<{ id: string; referral_code: string }[]> {
  const { data, error } = await supabase.from("affiliates").select("id,referral_code").order("referral_code");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; referral_code: string }[];
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationRow["type"], string> = {
  flash_deal: "عرض/فلاش ديل",
  site_announcement: "إعلان عام على الموقع",
  airport_info: "معلومة مطار",
  circular: "تعميم/إجراء جديد",
  agency_bulletin: "نشرة داخلية للوكالات",
  affiliate_bulletin: "نشرة داخلية للأفلييت",
};

export const NOTIFICATION_AUDIENCE_LABELS: Record<NotificationRow["audience"], string> = {
  all_public: "الجميع (عملاء/زوار الموقع)",
  agencies: "كل الوكالات",
  affiliates: "كل الأفلييت",
  specific_agency: "وكالة معينة",
  specific_affiliate: "أفلييت معين",
};

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
  draft: "مسودة",
  scheduled: "مجدول",
  sent: "تم الإرسال",
  cancelled: "ملغي",
};
