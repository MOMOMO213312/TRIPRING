// Ground Provider Portal — data layer
// Reuses the existing TripRing Supabase client/session (same project,
// same auth.users — a supplier login is just a normal Supabase Auth user
// who has a row in `supplier_users`).
//
// supplier_users / supplier_settlements / v_ground_operations_queue /
// v_supplier_service_report / supplier_update_execution_status were added
// directly on the production DB as part of the Phase 5.1/5.2 orchestration
// work and were never added to src/types/database.ts (which is hand-
// maintained, not generated) — same convention already established in
// src/lib/orchestration.ts for suppliers/order_items/etc. Typed locally
// here rather than touching the shared file, per "لا نكسر الموجود".

import { supabase } from "./supabase";

export type SlaState = "green" | "amber" | "red" | "closed";
export type ExecutionStatus =
  | "not_started"
  | "accepted"
  | "in_progress"
  | "completed"
  | "failed"
  | "no_show";
export type SettlementStatus = "draft" | "pending" | "paid" | "disputed" | "cancelled";

export interface GroundQueueRow {
  order_item_id: string;
  order_id: string;
  supplier_id: string;
  fulfillment_status: string;
  execution_status: ExecutionStatus;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  execution_note: string | null;
  service_name: string;
  service_type: string;
  service_category: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  flight_number: string | null;
  airline_code: string | null;
  operating_airline_code: string | null;
  from_airport: string | null;
  to_airport: string | null;
  departure_date: string | null;
  departure_time: string | null;
  arrival_date: string | null;
  arrival_time: string | null;
  scheduled_departure_at: string | null;
  scheduled_arrival_at: string | null;
  sla_hours: number | null;
  sla_deadline: string | null;
  sla_state: SlaState;
  // enriched — full ticket/request completeness for the ground handler's queue.
  booking_id: string | null;
  booking_number: number | null;
  quantity: number;
  airport_leg: "departure" | "arrival" | null;
  delivery_location: string | null;
  delivery_method: string | null;
  terms: string | null;
  max_weight_kg: number | null;
  agency_name: string | null;
  booking_notes: string | null;
  passenger_names: string | null;
}

export interface SupplierReportRow {
  supplier_id: string;
  completed_count: number;
  failed_count: number;
  no_show_count: number;
  open_count: number;
  sla_breaches: number;
  avg_handling_time: string | null; // Postgres interval as text
}

export interface SettlementRow {
  id: string;
  supplier_id: string;
  contract_id: string | null;
  period_start: string;
  period_end: string;
  currency: string;
  gross_customer_amount: number;
  supplier_cost_total: number;
  platform_margin_total: number;
  amount_due_supplier: number;
  amount_paid: number;
  items_count: number;
  status: SettlementStatus;
  generated_at: string;
  generated_by: string | null;
  paid_at: string | null;
  payment_ref: string | null;
  notes: string | null;
}

/** Which supplier does the currently logged-in user belong to? */
export async function getMySupplierId(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from("supplier_users")
    .select("supplier_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { supplier_id: string }).supplier_id;
}

/**
 * Today's + all open queue for the logged-in supplier.
 *
 * SECURITY: goes through get_my_ground_operations_queue() (SECURITY DEFINER
 * RPC), not a direct select on v_ground_operations_queue. The raw view has
 * no SELECT grant for `authenticated`/`anon` (locked down after the
 * cross-supplier exposure incident) — the RPC is the only sanctioned
 * provider-facing read path. Do not switch this back to `.from(view)`.
 */
export async function fetchGroundQueue(): Promise<GroundQueueRow[]> {
  const { data, error } = await supabase
    .rpc("get_my_ground_operations_queue", { p_status_filter: null } as never)
    .select("*")
    .order("scheduled_departure_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as GroundQueueRow[];
}

/** Accept / Start / Complete / Fail / No-show — the only valid transitions. */
export async function updateExecutionStatus(
  orderItemId: string,
  newStatus: ExecutionStatus,
  note?: string,
) {
  const { data, error } = await supabase.rpc(
    "supplier_update_execution_status",
    {
      p_order_item_id: orderItemId,
      p_new_status: newStatus,
      p_note: note ?? null,
    } as never,
  );
  if (error) throw error;
  return data;
}

/**
 * SECURITY: goes through get_my_supplier_service_report() (SECURITY DEFINER
 * RPC), not a direct select on v_supplier_service_report — same reasoning
 * as fetchGroundQueue() above. The raw view has no grant for authenticated.
 */
export async function fetchSupplierReport(): Promise<SupplierReportRow | null> {
  const { data, error } = await supabase
    .rpc("get_my_supplier_service_report" as never)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data as SupplierReportRow | null;
}

export async function fetchSettlements(): Promise<SettlementRow[]> {
  const { data, error } = await supabase
    .from("supplier_settlements")
    .select("*")
    .order("period_end", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SettlementRow[];
}

// ---------------------------------------------------------------------
// Airline Management (SGHA-style agreements) — Phase 8 addition.
// ground_service_agreements / ground_service_agreement_items were added
// directly on the production DB (same convention as the queue/report/
// settlement types above) and are not in src/types/database.ts.
// ---------------------------------------------------------------------

export type AgreementStatus = "draft" | "active" | "suspended" | "ended";
export type BillingUnit = "per_pax" | "per_flight" | "flat";

export interface AirlineSupplierOption {
  id: string;
  name: string;
  linked_airline_code: string | null;
}

export interface ServiceCatalogOption {
  id: string;
  type: string;
  generic_name: string;
}

export interface AgreementItemRow {
  id: string;
  agreement_id: string;
  service_catalog_id: string;
  billing_unit: BillingUnit;
  cost_price: number;
  is_active: boolean;
  service_catalog?: ServiceCatalogOption | null;
}

export interface AgreementRow {
  id: string;
  ground_supplier_id: string;
  airline_supplier_id: string;
  airport_code: string;
  status: AgreementStatus;
  airline_approved: boolean;
  airline_review_note: string | null;
  sla_hours: number | null;
  sla_notes: string | null;
  currency: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  airline?: { id: string; name: string; linked_airline_code: string | null } | null;
  items?: AgreementItemRow[];
}

/** Active airline suppliers, for the "airline" picker when creating an agreement. */
export async function fetchActiveAirlineSuppliers(): Promise<AirlineSupplierOption[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, linked_airline_code")
    .eq("type", "airline")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return (data ?? []) as AirlineSupplierOption[];
}

/**
 * Airport-facing service types only (lounge/fast_track/meet_assist/
 * wheelchair/check_in_assistance/boarding_assistance/arrival_assistance/
 * immigration_assistance). Ground transportation (airport_transfer/
 * private_car/shuttle) is GOAIR's domain, not a ground handler's — kept
 * out of this picker deliberately per the Airline/Agency/Ground Handler
 * role split.
 */
export async function fetchAirportServiceCatalog(): Promise<ServiceCatalogOption[]> {
  const { data, error } = await supabase
    .from("service_catalog")
    .select("id, type, generic_name")
    .eq("category", "airport")
    .order("generic_name");
  if (error) throw error;
  return (data ?? []) as ServiceCatalogOption[];
}

/** All agreements belonging to the logged-in ground provider, with airline + pricing items. */
export async function fetchMyAgreements(): Promise<AgreementRow[]> {
  const supplierId = await getMySupplierId();
  if (!supplierId) return [];

  const { data, error } = await supabase
    .from("ground_service_agreements")
    .select(
      "id, ground_supplier_id, airline_supplier_id, airport_code, status, airline_approved, airline_review_note, sla_hours, sla_notes, currency, starts_at, ends_at, created_at, " +
        "airline:suppliers!ground_service_agreements_airline_supplier_id_fkey(id, name, linked_airline_code), " +
        "items:ground_service_agreement_items(id, agreement_id, service_catalog_id, billing_unit, cost_price, is_active, service_catalog:service_catalog(id, type, generic_name))",
    )
    .eq("ground_supplier_id", supplierId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AgreementRow[];
}

export async function createAgreement(input: {
  airlineSupplierId: string;
  airportCode: string;
  slaHours: number | null;
  currency: string;
}): Promise<string> {
  const supplierId = await getMySupplierId();
  if (!supplierId) throw new Error("لا يوجد حساب مورد مرتبط بالمستخدم الحالي");

  const { data, error } = await supabase
    .from("ground_service_agreements")
    .insert({
      ground_supplier_id: supplierId,
      airline_supplier_id: input.airlineSupplierId,
      airport_code: input.airportCode,
      sla_hours: input.slaHours,
      currency: input.currency,
      status: "draft",
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateAgreementStatus(agreementId: string, status: AgreementStatus) {
  const { error } = await supabase
    .from("ground_service_agreements")
    .update({ status } as never)
    .eq("id", agreementId);
  if (error) throw error;
}

export async function addAgreementItem(input: {
  agreementId: string;
  serviceCatalogId: string;
  billingUnit: BillingUnit;
  costPrice: number;
}) {
  const { error } = await supabase.from("ground_service_agreement_items").insert({
    agreement_id: input.agreementId,
    service_catalog_id: input.serviceCatalogId,
    billing_unit: input.billingUnit,
    cost_price: input.costPrice,
  } as never);
  if (error) throw error;
}

export async function toggleAgreementItemActive(itemId: string, isActive: boolean) {
  const { error } = await supabase
    .from("ground_service_agreement_items")
    .update({ is_active: isActive } as never)
    .eq("id", itemId);
  if (error) throw error;
}

export async function deleteAgreementItem(itemId: string) {
  const { error } = await supabase.from("ground_service_agreement_items").delete().eq("id", itemId);
  if (error) throw error;
}
