import { getCurrentUser } from "./auth";
import { supabase } from "./supabase";
import type { TicketResaleRow } from "./api";
import type {
  AdditionalServiceRow,
  AgencyRow,
  AgencyVerificationDocument,
  BookingRow,
  DealRow,
  ProfileRow,
  ResaleStatus,
  TripGoBundleJoined,
  TripGoDealRow,
  TransportType,
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

// ── TripGo: manual transport-deal + bundle management ───────────────────
// Interim admin-only workflow (see TripRing project notes): providers don't
// have their own dashboard yet, so the admin posts tripgo_deals rows on
// behalf of an existing agency record and links them to flight deals via
// tripgo_bundles. Requires the "tripgo_deals: agency/admin insert" RLS
// policy (admin bypass added alongside this feature — the original policy
// only allowed an agency to insert its own rows).
export async function fetchAllTripGoDeals(): Promise<TripGoDealRow[]> {
  const { data, error } = await supabase
    .from("tripgo_deals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TripGoDealRow[];
}

export type CreateTripGoDealInput = {
  agencyId: string;
  transportType: TransportType;
  vehicleType?: string | null;
  fromAirport?: string | null;
  fromLocation?: string | null;
  toAirport?: string | null;
  toLocation?: string | null;
  pickupDate: string;
  pickupTime?: string | null;
  capacityTotal: number;
  price: number;
  currency?: string;
  durationMinutes?: number | null;
  notes?: string | null;
};

export async function createTripGoDeal(input: CreateTripGoDealInput): Promise<TripGoDealRow> {
  const user = await getCurrentUser();
  const { data, error } = await supabase
    .from("tripgo_deals")
    .insert({
      agency_id: input.agencyId,
      transport_type: input.transportType,
      vehicle_type: input.vehicleType ?? null,
      from_airport: input.fromAirport ?? null,
      from_location: input.fromLocation ?? null,
      to_airport: input.toAirport ?? null,
      to_location: input.toLocation ?? null,
      pickup_date: input.pickupDate,
      pickup_time: input.pickupTime ?? null,
      capacity_total: input.capacityTotal,
      capacity_available: input.capacityTotal,
      price: input.price,
      currency: input.currency ?? "USD",
      duration_minutes: input.durationMinutes ?? null,
      notes: input.notes ?? null,
      created_by: user?.id ?? null,
    } as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as TripGoDealRow;
}

export async function setTripGoDealStatus(tripGoDealId: string, status: TripGoDealRow["status"]): Promise<void> {
  const { error } = await supabase.from("tripgo_deals").update({ status } as never).eq("id", tripGoDealId);
  if (error) throw new Error(error.message);
}

export async function fetchAllTripGoBundles(): Promise<TripGoBundleJoined[]> {
  const { data, error } = await supabase
    .from("tripgo_bundles")
    .select("*, deal:deals!inner(*), tripgo_deal:tripgo_deals!inner(*)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TripGoBundleJoined[];
}

export async function createTripGoBundle(input: {
  dealId: string;
  tripGoDealId: string;
  transportCostPrice: number;
  agencySellingPrice: number;
}): Promise<void> {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from("tripgo_bundles")
    .insert({
      deal_id: input.dealId,
      tripgo_deal_id: input.tripGoDealId,
      transport_cost_price: input.transportCostPrice,
      agency_selling_price: input.agencySellingPrice,
      margin: input.agencySellingPrice - input.transportCostPrice,
      created_by: user?.id ?? null,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
}

export async function deleteTripGoBundle(bundleId: string): Promise<void> {
  const { error } = await supabase.from("tripgo_bundles").delete().eq("id", bundleId);
  if (error) throw new Error(error.message);
}

export const TRANSPORT_TYPE_LABELS: Record<TransportType, string> = {
  private: "🚗 خاص",
  shared: "🚐 تشاركي",
};

// ── Additional services (transport / insurance / meet & assist ...) ─────
// Flat-priced add-ons a customer can attach to any regular ticket —
// unrelated to TripGo's hidden-margin bundles above.
export async function fetchAllAdditionalServices(): Promise<AdditionalServiceRow[]> {
  const { data, error } = await supabase.from("additional_services").select("*").order("type", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdditionalServiceRow[];
}

export type SaveAdditionalServiceInput = {
  type: AdditionalServiceRow["type"];
  name: string;
  description?: string | null;
  price: number;
  category?: string | null;
  isActive: boolean;
};

export async function createAdditionalService(input: SaveAdditionalServiceInput): Promise<AdditionalServiceRow> {
  const { data, error } = await supabase
    .from("additional_services")
    .insert({
      type: input.type,
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      category: input.category ?? null,
      is_active: input.isActive,
    } as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as AdditionalServiceRow;
}

export async function updateAdditionalService(id: string, input: SaveAdditionalServiceInput): Promise<void> {
  const { error } = await supabase
    .from("additional_services")
    .update({
      type: input.type,
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      category: input.category ?? null,
      is_active: input.isActive,
    } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setAdditionalServiceActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("additional_services").update({ is_active: isActive } as never).eq("id", id);
  if (error) throw new Error(error.message);
}

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
