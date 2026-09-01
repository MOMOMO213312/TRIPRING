import { getCurrentUser } from "./auth";
import { supabase } from "./supabase";
import type { BillingPeriod, CustomerSubscriptionRow, MembershipTierRow, PaymentMethod } from "../types/database";

// ── Customer membership program ─────────────────────────────────────────────
// A customer pays for a Basic/Smart/Premium tier (discount % + included free
// services + priority alert minutes). Mirrors the reseller subscription flow
// in affiliate.ts, but writes to membership_tiers / customer_subscriptions
// and — once an admin approves it — profiles.membership is kept in sync by
// the sync_customer_membership DB trigger.

export async function fetchActiveMembershipTiers(): Promise<MembershipTierRow[]> {
  const { data, error } = await supabase
    .from("membership_tiers")
    .select("*")
    .eq("is_active", true)
    .order("price_monthly", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MembershipTierRow[];
}

/** Opportunistic expiry pass (no cron dependency) — flips any subscription
 *  whose ends_at has passed to 'expired', which downgrades profiles.membership
 *  back to 'free' via the DB trigger. Safe to call on every page load. */
export async function expireDueSubscriptions(): Promise<void> {
  const { error } = await supabase.rpc("expire_due_customer_subscriptions");
  if (error) throw new Error(error.message);
}

/** Most recent subscription row for the signed-in customer (any status). */
export async function fetchMyLatestSubscription(): Promise<CustomerSubscriptionRow | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("customer_subscriptions")
    .select("*")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CustomerSubscriptionRow | null) ?? null;
}

export const CUSTOMER_SUBSCRIPTION_STATUS_LABELS: Record<CustomerSubscriptionRow["status"], string> = {
  pending_payment: "بانتظار المراجعة",
  active: "نشط",
  expired: "منتهي",
  rejected: "مرفوض",
  cancelled: "ملغي",
};

export function subscriptionIsActive(sub: CustomerSubscriptionRow | null): boolean {
  if (!sub || sub.status !== "active" || !sub.ends_at) return false;
  return new Date(sub.ends_at).getTime() > Date.now();
}

const SUB_PROOF_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const SUB_PROOF_MAX_BYTES = 5 * 1024 * 1024; // 5MB

/** Uploads the payment proof to the same payment-proofs bucket bookings use
 *  (under a customer-subscriptions/ prefix) and creates the pending_payment
 *  subscription row for admin review. */
export async function submitCustomerSubscription(input: {
  tierId: string;
  billingPeriod: BillingPeriod;
  paymentMethod: PaymentMethod;
  paymentRef: string;
  proofFile: File;
}): Promise<CustomerSubscriptionRow> {
  const user = await getCurrentUser();
  if (!user) throw new Error("لازم تسجل الدخول الأول");

  const { tierId, billingPeriod, paymentMethod, paymentRef, proofFile } = input;
  if (!SUB_PROOF_ALLOWED_TYPES.includes(proofFile.type)) {
    throw new Error("الملف يجب أن يكون صورة (JPG/PNG/WebP) أو PDF");
  }
  if (proofFile.size > SUB_PROOF_MAX_BYTES) {
    throw new Error("حجم الملف أكبر من 5 ميجابايت");
  }

  const ext = proofFile.name.split(".").pop() ?? "bin";
  const path = `customer-subscriptions/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("payment-proofs")
    .upload(path, proofFile, { contentType: proofFile.type });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from("payment-proofs").getPublicUrl(path);

  const { data, error } = await supabase
    .from("customer_subscriptions")
    .insert([
      {
        customer_id: user.id,
        tier_id: tierId,
        billing_period: billingPeriod,
        status: "pending_payment",
        payment_method: paymentMethod,
        payment_ref: paymentRef.trim() || null,
        payment_proof_url: publicUrlData.publicUrl,
      },
    ] as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CustomerSubscriptionRow;
}
