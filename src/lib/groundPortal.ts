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
