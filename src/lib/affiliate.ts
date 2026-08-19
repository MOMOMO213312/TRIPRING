import { getCurrentUser } from "./auth";
import { supabase } from "./supabase";
import type { AffiliateRow } from "../types/database";

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
