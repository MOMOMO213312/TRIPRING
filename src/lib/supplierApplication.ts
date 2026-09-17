import { supabase } from "./supabase";
import type { SupplierApplicationRow, SupplierOrgType } from "../types/database";

/** Submits a self-signup application to become a TripRing supplier (any org type).
 *  Requires an authenticated user (RLS/RPC checks auth.uid()); the RPC itself rejects
 *  a second submission while a previous one from the same user is still pending. */
export async function submitSupplierApplication(input: {
  orgType: SupplierOrgType;
  companyName: string;
  contactName: string;
  contactEmail: string;
  countryCode?: string | null;
  contactPhone?: string | null;
  contactWhatsapp?: string | null;
  website?: string | null;
  notes?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("submit_supplier_application", {
    p_org_type: input.orgType,
    p_company_name: input.companyName.trim(),
    p_contact_name: input.contactName.trim(),
    p_contact_email: input.contactEmail.trim(),
    p_country_code: input.countryCode || null,
    p_contact_phone: input.contactPhone || null,
    p_contact_whatsapp: input.contactWhatsapp || null,
    p_website: input.website || null,
    p_notes: input.notes || null,
  } as never);
  if (error) throw new Error(error.message);
  return data as string;
}

/** The current user's own application(s), most recent first — lets the page show
 *  "already submitted, status: X" instead of the form again. */
export async function fetchMySupplierApplications(): Promise<SupplierApplicationRow[]> {
  const { data, error } = await supabase
    .from("supplier_applications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SupplierApplicationRow[];
}
