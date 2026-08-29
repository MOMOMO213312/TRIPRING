import { supabase } from "./supabase";
import type { AdditionalServiceRow, ProviderType, ServiceCategory, ServiceProviderRow } from "../types/database";

/** All categories an agency can be granted, in display order. */
export const PROVIDER_TYPES: ProviderType[] = ["transport", "tourism", "insurance", "ground_handling", "airport"];

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  transport: "🚐 النقل",
  tourism: "🗺️ السياحة",
  insurance: "🛡️ التأمين",
  ground_handling: "🧳 الخدمات الأرضية",
  airport: "✈️ المطار",
};

/** additional_services.type (service_type enum) — which values make sense
 *  to offer under each provider_type, since the two enums don't line up 1:1. */
type ServiceType = AdditionalServiceRow["type"];
export const PROVIDER_TYPE_SERVICE_TYPES: Record<ProviderType, { value: ServiceType; label: string }[]> = {
  transport: [
    { value: "airport_transfer", label: "توصيل من/إلى المطار" },
    { value: "private_car", label: "سيارة خاصة" },
    { value: "shuttle", label: "نقل جماعي (شاتل)" },
  ],
  tourism: [
    { value: "destination_experience", label: "جولة/نشاط سياحي" },
    { value: "hotel", label: "حجز فندق" },
    { value: "car_rental", label: "تأجير سيارات" },
  ],
  insurance: [{ value: "travel_insurance", label: "تأمين سفر" }],
  ground_handling: [
    { value: "meet_assist", label: "استقبال ومساعدة" },
    { value: "fast_track", label: "فاست تراك" },
    { value: "extra_baggage", label: "أمتعة إضافية" },
  ],
  airport: [
    { value: "lounge", label: "دخول صالة المطار" },
    { value: "fast_track", label: "فاست تراك" },
  ],
};

/** additional_services.category (5-value check constraint) per provider_type — best fit. */
export const PROVIDER_TYPE_CATEGORY: Record<ProviderType, ServiceCategory> = {
  transport: "transport",
  tourism: "destination",
  insurance: "insurance",
  ground_handling: "airport",
  airport: "airport",
};

/** This agency's own service_providers rows (one per category it has been granted and has activated). */
export async function fetchMyProviders(agencyId: string): Promise<ServiceProviderRow[]> {
  const { data, error } = await supabase.from("service_providers").select("*").eq("agency_id", agencyId);
  if (error) throw new Error(error.message);
  return (data ?? []) as ServiceProviderRow[];
}

/** Creates this agency's service_providers row for a category the first time it adds a service there.
 *  RLS enforces the category must be in agencies.allowed_categories — a disallowed category is rejected server-side. */
export async function activateMyProviderCategory(
  agencyId: string,
  providerType: ProviderType,
  name: string,
): Promise<ServiceProviderRow> {
  const { data, error } = await supabase
    .from("service_providers")
    .insert([{ agency_id: agencyId, provider_type: providerType, name, is_active: true }] as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ServiceProviderRow;
}

export async function fetchMyServices(providerIds: string[]): Promise<AdditionalServiceRow[]> {
  if (providerIds.length === 0) return [];
  const { data, error } = await supabase.from("additional_services").select("*").in("provider_id", providerIds);
  if (error) throw new Error(error.message);
  return (data ?? []) as AdditionalServiceRow[];
}

export async function createMyService(input: {
  providerId: string;
  providerType: ProviderType;
  type: ServiceType;
  name: string;
  description: string | null;
  price: number;
}): Promise<void> {
  const { error } = await supabase.from("additional_services").insert([
    {
      provider_id: input.providerId,
      type: input.type,
      name: input.name,
      description: input.description,
      price: input.price,
      category: PROVIDER_TYPE_CATEGORY[input.providerType],
      is_active: true,
      fulfillment_type: "in_house",
    },
  ] as never);
  if (error) throw new Error(error.message);
}

export async function updateMyService(
  serviceId: string,
  patch: Partial<{ name: string; description: string | null; price: number; isActive: boolean }>,
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.price !== undefined) dbPatch.price = patch.price;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
  const { error } = await supabase.from("additional_services").update(dbPatch as never).eq("id", serviceId);
  if (error) throw new Error(error.message);
}

export async function deleteMyService(serviceId: string): Promise<void> {
  const { error } = await supabase.from("additional_services").delete().eq("id", serviceId);
  if (error) throw new Error(error.message);
}
