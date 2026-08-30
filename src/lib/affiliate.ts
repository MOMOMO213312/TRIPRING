import { getCurrentUser } from "./auth";
import { supabase } from "./supabase";
import type {
  AffiliateResaleOrderRow,
  AffiliateResellerSubscriptionRow,
  AffiliateRow,
  PaymentMethod,
  ResellerSubscriptionPlanRow,
} from "../types/database";

/** Returns the signed-in user's affiliate record, or null if they aren't
 *  registered as an affiliate yet. Affiliate rows are created by an admin
 *  only (RLS: "affiliates: admin manage"), so there's no self-signup here. */
export async function fetchMyAffiliateProfile(): Promise<AffiliateRow | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase.from("affiliates").select("*").eq("profile_id", user.id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AffiliateRow | null) ?? null;
}

export function affiliateReferralLink(referralCode: string): string {
  return `${window.location.origin}/?ref=${referralCode}`;
}

export function affiliateTierLabel(tier: AffiliateRow["tier"]): string {
  switch (tier) {
    case "gold":
      return "ذهبي";
    case "silver":
      return "فضي";
    case "bronze":
    default:
      return "برونزي";
  }
}

// ── Reseller subscription program (net-price program) ──────────────────────
// Separate track from the referral-commission program above: here the
// affiliate pays TripRing for a plan to unlock get_reseller_net_price(),
// then resells deals to their own customers via create_affiliate_resale_order.

export async function fetchActiveResellerPlans(): Promise<ResellerSubscriptionPlanRow[]> {
  const { data, error } = await supabase
    .from("reseller_subscription_plans")
    .select("*")
    .eq("is_active", true)
    .order("price", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as ResellerSubscriptionPlanRow[];
}

/** Most recent subscription row for this affiliate (any status) — enough to
 *  decide what to show: active/valid, pending review, or needs a new one. */
export async function fetchMyLatestResellerSubscription(
  affiliateId: string,
): Promise<AffiliateResellerSubscriptionRow | null> {
  const { data, error } = await supabase
    .from("affiliate_reseller_subscriptions")
    .select("*")
    .eq("affiliate_id", affiliateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AffiliateResellerSubscriptionRow | null) ?? null;
}

export const RESELLER_SUBSCRIPTION_STATUS_LABELS: Record<AffiliateResellerSubscriptionRow["status"], string> = {
  pending_payment: "بانتظار المراجعة",
  active: "نشط",
  expired: "منتهي",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

export function resellerSubscriptionIsActive(sub: AffiliateResellerSubscriptionRow | null): boolean {
  if (!sub || sub.status !== "active" || !sub.ends_at) return false;
  return new Date(sub.ends_at).getTime() > Date.now();
}

const SUB_PROOF_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const SUB_PROOF_MAX_BYTES = 5 * 1024 * 1024; // 5MB

/** Uploads the payment proof to the same `payment-proofs` bucket bookings
 *  use (under a reseller-subscriptions/ prefix) and creates the
 *  pending_payment subscription row for admin review. */
export async function submitResellerSubscription(input: {
  affiliateId: string;
  planId: string;
  paymentMethod: PaymentMethod;
  paymentRef: string;
  proofFile: File;
}): Promise<AffiliateResellerSubscriptionRow> {
  const { affiliateId, planId, paymentMethod, paymentRef, proofFile } = input;
  if (!SUB_PROOF_ALLOWED_TYPES.includes(proofFile.type)) {
    throw new Error("الملف يجب أن يكون صورة (JPG/PNG/WebP) أو PDF");
  }
  if (proofFile.size > SUB_PROOF_MAX_BYTES) {
    throw new Error("حجم الملف أكبر من 5 ميجابايت");
  }

  const ext = proofFile.name.split(".").pop() ?? "bin";
  const path = `reseller-subscriptions/${affiliateId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("payment-proofs")
    .upload(path, proofFile, { contentType: proofFile.type });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from("payment-proofs").getPublicUrl(path);

  const { data, error } = await supabase
    .from("affiliate_reseller_subscriptions")
    .insert([
      {
        affiliate_id: affiliateId,
        plan_id: planId,
        status: "pending_payment",
        payment_method: paymentMethod,
        payment_ref: paymentRef.trim() || null,
        payment_proof_url: publicUrlData.publicUrl,
      },
    ] as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AffiliateResellerSubscriptionRow;
}

export async function fetchResellerNetPrice(dealId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_reseller_net_price", { p_deal_id: dealId } as never);
  if (error) throw new Error(error.message);
  return data as number;
}

export async function createAffiliateResaleOrder(input: {
  dealId: string;
  sellPrice: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  adultsCount: number;
  childrenCount: number;
  infantsCount: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_affiliate_resale_order", {
    p_deal_id: input.dealId,
    p_sell_price: input.sellPrice,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_customer_email: input.customerEmail ?? null,
    p_adults_count: input.adultsCount,
    p_children_count: input.childrenCount,
    p_infants_count: input.infantsCount,
  } as never);
  if (error) throw new Error(error.message);
  return data as string;
}

export const RESALE_ORDER_STATUS_LABELS: Record<AffiliateResaleOrderRow["status"], string> = {
  draft: "مسودة",
  pending_admin_review: "بانتظار المراجعة",
  booking_created: "تم إنشاء الحجز",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

export async function fetchMyResaleOrders(affiliateId: string): Promise<AffiliateResaleOrderRow[]> {
  const { data, error } = await supabase
    .from("affiliate_resale_orders")
    .select("*")
    .eq("affiliate_id", affiliateId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AffiliateResaleOrderRow[];
}
