import { getCurrentUser } from "./auth";
import { supabase } from "./supabase";
import type { TicketResaleRow } from "./api";
import type {
  AffiliateResaleOrderRow,
  AffiliateResellerSubscriptionRow,
  AffiliateRow,
  AgencyRow,
  AgencyVerificationDocument,
  BookingRow,
  DealRow,
  ProfileRow,
  ProviderType,
  ResaleStatus,
  ResellerSubscriptionPlanRow,
  ResellerSubscriptionStatus,
} from "../types/database";

const AGENCY_DOC_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const AGENCY_DOC_MAX_BYTES = 8 * 1024 * 1024; // 8MB

// ── Access gate ──────────────────────────────────────────────────────────
// Mirrors fetchMyAgencyProfile's shape (see lib/agency.ts) but checks for
// the "admin" role instead of "agency" — same pattern, different gate.
export async function fetchMyAdminProfile(): Promise<ProfileRow | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,role,full_name,phone,agency_id,agency_role,membership,created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) return null;

  const row = profile as ProfileRow;
  if (row.role !== "admin") return null;
  return row;
}

// ── Agencies ─────────────────────────────────────────────────────────────
export async function fetchAllAgencies(): Promise<AgencyRow[]> {
  const { data, error } = await supabase.from("agencies").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AgencyRow[];
}

export async function setAgencyActive(agencyId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("agencies").update({ is_active: isActive } as never).eq("id", agencyId);
  if (error) throw new Error(error.message);
}

export async function updateAgencyCommission(agencyId: string, commissionRate: number): Promise<void> {
  const { error } = await supabase
    .from("agencies")
    .update({ commission_rate: commissionRate } as never)
    .eq("id", agencyId);
  if (error) throw new Error(error.message);
}

/** Which service categories (provider_type) this agency is permitted to self-manage
 *  from its own dashboard — see "خدماتي" tab / lib/serviceProviders.ts. */
export async function updateAgencyAllowedCategories(agencyId: string, categories: ProviderType[]): Promise<void> {
  const { error } = await supabase
    .from("agencies")
    .update({ allowed_categories: categories } as never)
    .eq("id", agencyId);
  if (error) throw new Error(error.message);
}

export async function createAgency(input: {
  name: string;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  commissionRate?: number | null;
  commercialRegisterNumber?: string | null;
  tourismLicenseNumber?: string | null;
}): Promise<AgencyRow> {
  const { data, error } = await supabase
    .from("agencies")
    .insert([
      {
        name: input.name.trim(),
        phone: input.phone || null,
        email: input.email || null,
        whatsapp: input.whatsapp || null,
        commission_rate: input.commissionRate ?? null,
        commercial_register_number: input.commercialRegisterNumber || null,
        tourism_license_number: input.tourismLicenseNumber || null,
        is_active: false, // new agencies start inactive until admin approves
      },
    ] as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AgencyRow;
}

/**
 * Invites a new agency staff user by email (or, if the email already has an
 * account, links their existing account) to the given agency. Runs entirely
 * server-side via the `invite-agency-user` Edge Function — creating/inviting
 * auth users needs the service_role key, which must never reach the browser.
 */
export async function inviteAgencyUser(input: {
  agencyId: string;
  email: string;
  fullName?: string;
  agencyRole?: string;
}): Promise<{ userId: string; agencyId: string; email: string }> {
  const { data, error } = await supabase.functions.invoke("invite-agency-user", {
    body: {
      agencyId: input.agencyId,
      email: input.email,
      fullName: input.fullName ?? null,
      agencyRole: input.agencyRole ?? null,
    },
  });
  if (error) {
    // supabase-js wraps non-2xx responses in a generic FunctionsHttpError;
    // the actual { error: "..." } message from our function is on context.
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = await context.clone().json();
        if (body?.error) throw new Error(body.error);
      } catch {
        // fall through to generic message below
      }
    }
    throw new Error(error.message);
  }
  return data as { userId: string; agencyId: string; email: string };
}

/**
 * Uploads one official document (commercial register, tourism license,
 * work certificate, etc.) to the private "agency-documents" bucket and
 * appends it to the agency's verification_documents list. Files are stored
 * under `${agencyId}/...` so the "owner select" storage policy (which checks
 * the profile's agency_id against the folder name) can find them.
 */
export async function uploadAgencyDocument(agencyId: string, label: string, file: File): Promise<AgencyRow> {
  if (!AGENCY_DOC_ALLOWED_TYPES.includes(file.type)) {
    throw new Error("الملف يجب أن يكون صورة (JPG/PNG/WebP) أو PDF");
  }
  if (file.size > AGENCY_DOC_MAX_BYTES) {
    throw new Error("حجم الملف أكبر من 8 ميجابايت");
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${agencyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("agency-documents")
    .upload(path, file, { contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { data: current, error: fetchError } = await supabase
    .from("agencies")
    .select("verification_documents")
    .eq("id", agencyId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const existing = ((current as { verification_documents: AgencyVerificationDocument[] } | null)
    ?.verification_documents ?? []) as AgencyVerificationDocument[];
  const nextDocs: AgencyVerificationDocument[] = [
    ...existing,
    { label, url: path, uploaded_at: new Date().toISOString() },
  ];

  const { data, error } = await supabase
    .from("agencies")
    .update({ verification_documents: nextDocs } as never)
    .eq("id", agencyId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AgencyRow;
}

/** Signed URL (bucket is private) so admins can view/download an uploaded document. */
export async function getAgencyDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("agency-documents").createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function setAgencyVerificationStatus(
  agencyId: string,
  status: "pending" | "verified" | "rejected",
): Promise<void> {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from("agencies")
    .update({
      verification_status: status,
      verified_at: status === "verified" ? new Date().toISOString() : null,
      verified_by: status === "verified" ? (user?.id ?? null) : null,
    } as never)
    .eq("id", agencyId);
  if (error) throw new Error(error.message);
}

// ── Bookings (platform-wide, not scoped to one agency) ─────────────────────
const BOOKING_FULL_COLUMNS =
  "id,booking_number,deal_id,agency_id,customer_name,customer_phone,customer_email,notes,channel,payment_method,status,payment_proof_url,payment_ref,payment_at,ticket_url,handled_by,created_at,updated_at,unit_price,total_price,currency,adults_count,children_count,infants_count,travelers_count,fare_package_tier,fare_package_markup";

export async function fetchAllBookings(): Promise<BookingRow[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_FULL_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  return (data ?? []) as BookingRow[];
}

/** Small lookup tables joined client-side so the admin bookings list can show
 *  the agency name and route without a heavier server-side join. */
export async function fetchAgencyNameMap(): Promise<Record<string, string>> {
  const { data, error } = await supabase.from("agencies").select("id,name");
  if (error) throw new Error(error.message);
  const map: Record<string, string> = {};
  for (const a of (data ?? []) as { id: string; name: string }[]) map[a.id] = a.name;
  return map;
}

export async function fetchDealRouteMap(dealIds: string[]): Promise<Record<string, Pick<DealRow, "from_airport" | "to_airport">>> {
  if (dealIds.length === 0) return {};
  const { data, error } = await supabase.from("deals").select("id,from_airport,to_airport").in("id", dealIds);
  if (error) throw new Error(error.message);
  const map: Record<string, Pick<DealRow, "from_airport" | "to_airport">> = {};
  for (const d of (data ?? []) as { id: string; from_airport: string; to_airport: string }[]) {
    map[d.id] = { from_airport: d.from_airport, to_airport: d.to_airport };
  }
  return map;
}

// ── Ticket resale review queue ──────────────────────────────────────────
export async function fetchResaleQueue(statuses?: ResaleStatus[]): Promise<TicketResaleRow[]> {
  let query = supabase.from("ticket_resales").select("*").order("created_at", { ascending: false });
  if (statuses?.length) query = query.in("status", statuses);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as TicketResaleRow[];
}

export async function updateResaleReview(
  resaleId: string,
  patch: { status: ResaleStatus; verificationNotes?: string | null },
): Promise<void> {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from("ticket_resales")
    .update({
      status: patch.status,
      verification_notes: patch.verificationNotes ?? null,
      verified_by: user?.id ?? null,
    } as never)
    .eq("id", resaleId);
  if (error) throw new Error(error.message);
}

// ── Reseller subscription plans (net-price affiliate program) ──────────────
// Separate from the referral-commission affiliate system above: these plans
// are what an affiliate pays for to unlock get_reseller_net_price() access.
export async function fetchResellerPlans(): Promise<ResellerSubscriptionPlanRow[]> {
  const { data, error } = await supabase
    .from("reseller_subscription_plans")
    .select("*")
    .order("price", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ResellerSubscriptionPlanRow[];
}

export async function createResellerPlan(input: {
  name: string;
  description?: string | null;
  price: number;
  durationDays: number;
}): Promise<ResellerSubscriptionPlanRow> {
  const { data, error } = await supabase
    .from("reseller_subscription_plans")
    .insert([
      {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        price: input.price,
        duration_days: input.durationDays,
        is_active: true,
      },
    ] as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ResellerSubscriptionPlanRow;
}

export async function updateResellerPlan(
  planId: string,
  patch: Partial<Pick<ResellerSubscriptionPlanRow, "name" | "description" | "price" | "duration_days" | "is_active">>,
): Promise<void> {
  const { error } = await supabase.from("reseller_subscription_plans").update(patch as never).eq("id", planId);
  if (error) throw new Error(error.message);
}

// ── Affiliate reseller subscriptions review (net-price program) ────────────
export async function fetchResellerSubscriptionQueue(
  statuses?: ResellerSubscriptionStatus[],
): Promise<AffiliateResellerSubscriptionRow[]> {
  let query = supabase
    .from("affiliate_reseller_subscriptions")
    .select("*")
    .order("created_at", { ascending: false });
  if (statuses?.length) query = query.in("status", statuses);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AffiliateResellerSubscriptionRow[];
}

/** Cross-referenced client-side (this codebase has no relational .select()
 *  joins anywhere) so the review tab can show who's asking and for what plan. */
export async function fetchAffiliatesByIds(ids: string[]): Promise<AffiliateRow[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("affiliates").select("*").in("id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as AffiliateRow[];
}

export async function fetchProfileNamesByIds(
  ids: string[],
): Promise<Pick<ProfileRow, "id" | "full_name" | "phone">[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("profiles").select("id,full_name,phone").in("id", ids);
  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<ProfileRow, "id" | "full_name" | "phone">[];
}

export async function activateResellerSubscription(subscriptionId: string, durationDays: number): Promise<void> {
  const user = await getCurrentUser();
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const { error } = await supabase
    .from("affiliate_reseller_subscriptions")
    .update({
      status: "active",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      verified_by: user?.id ?? null,
      verified_at: new Date().toISOString(),
    } as never)
    .eq("id", subscriptionId);
  if (error) throw new Error(error.message);
}

export async function rejectResellerSubscription(subscriptionId: string): Promise<void> {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from("affiliate_reseller_subscriptions")
    .update({
      status: "rejected",
      verified_by: user?.id ?? null,
      verified_at: new Date().toISOString(),
    } as never)
    .eq("id", subscriptionId);
  if (error) throw new Error(error.message);
}

// ── Affiliate resale orders review (net-price program: sell → real booking) ─
// A resale order is the affiliate's promise of a sale at their own sell_price;
// it only becomes a real, ticketable booking once an admin approves it here —
// the affiliate never issues a ticket themselves.
export async function fetchResaleOrderQueue(
  statuses?: AffiliateResaleOrderRow["status"][],
): Promise<AffiliateResaleOrderRow[]> {
  let query = supabase.from("affiliate_resale_orders").select("*").order("created_at", { ascending: false });
  if (statuses?.length) query = query.in("status", statuses);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AffiliateResaleOrderRow[];
}

/** Approves the resale order: creates the real booking at the affiliate's
 *  sell_price, credits the affiliate's commission (handled by a DB trigger),
 *  and flips the order to booking_created. Admin still issues the ticket
 *  afterwards from the normal Bookings tab, same as any other booking. */
export async function adminConvertResaleOrderToBooking(
  resaleOrderId: string,
): Promise<{ booking_number: number; total_price: number; currency: string; status: string }> {
  const { data, error } = await supabase.rpc("admin_convert_resale_order_to_booking", {
    p_resale_order_id: resaleOrderId,
  } as never);
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return row as { booking_number: number; total_price: number; currency: string; status: string };
}

export async function adminRejectResaleOrder(resaleOrderId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("admin_reject_resale_order", {
    p_resale_order_id: resaleOrderId,
    p_reason: reason ?? null,
  } as never);
  if (error) throw new Error(error.message);
}

export const RESALE_ORDER_STATUS_LABELS: Record<AffiliateResaleOrderRow["status"], string> = {
  draft: "مسودة",
  pending_admin_review: "بانتظار المراجعة",
  booking_created: "تم إنشاء الحجز",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

export const RESELLER_SUBSCRIPTION_STATUS_LABELS: Record<ResellerSubscriptionStatus, string> = {
  pending_payment: "بانتظار المراجعة",
  active: "نشط",
  expired: "منتهي",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

export const RESALE_STATUS_LABELS: Record<ResaleStatus, string> = {
  submitted: "بانتظار المراجعة",
  under_review: "تحت المراجعة",
  verified: "تم التحقق",
  rejected: "مرفوض",
  listed: "معروض للبيع",
  reserved: "محجوز",
  sold: "تم البيع",
  expired: "منتهي",
  cancelled: "ملغي",
  converted_to_deal: "تحول لعرض",
};
