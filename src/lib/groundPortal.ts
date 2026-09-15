// Ground Provider Portal — data layer
// Reuses the existing TripRing Supabase client/session (same project,
// same auth.users — a supplier login is just a normal Supabase Auth user
// who has a row in `supplier_users`).

import { supabase } from './supabaseClient'; // existing tripring-fresh client

export type SlaState = 'green' | 'amber' | 'red' | 'closed';
export type ExecutionStatus =
  | 'not_started'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'no_show';

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
  from_airport: string | null;
  to_airport: string | null;
  departure_date: string | null;
  departure_time: string | null;
  scheduled_departure_at: string | null;
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
  period_start: string;
  period_end: string;
  currency: string;
  gross_customer_amount: number;
  supplier_cost_total: number;
  amount_due_supplier: number;
  amount_paid: number;
  items_count: number;
  status: string;
  generated_at: string;
  paid_at: string | null;
}

/** Which supplier does the currently logged-in user belong to? */
export async function getMySupplierId(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from('supplier_users')
    .select('supplier_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data.supplier_id;
}

/** Today's + all open queue for the logged-in supplier (RLS already scopes this). */
export async function fetchGroundQueue(): Promise<GroundQueueRow[]> {
  const { data, error } = await supabase
    .from('v_ground_operations_queue')
    .select('*')
    .order('scheduled_departure_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as GroundQueueRow[];
}

/** Accept / Start / Complete / Fail / No-show — the only valid transitions. */
export async function updateExecutionStatus(
  orderItemId: string,
  newStatus: ExecutionStatus,
  note?: string
) {
  const { data, error } = await supabase.rpc('supplier_update_execution_status', {
    p_order_item_id: orderItemId,
    p_new_status: newStatus,
    p_note: note ?? null,
  });
  if (error) throw error;
  return data;
}

export async function fetchSupplierReport(): Promise<SupplierReportRow | null> {
  const { data, error } = await supabase
    .from('v_supplier_service_report')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as SupplierReportRow | null;
}

export async function fetchSettlements(): Promise<SettlementRow[]> {
  const { data, error } = await supabase
    .from('supplier_settlements')
    .select('*')
    .order('period_end', { ascending: false });
  if (error) throw error;
  return data as SettlementRow[];
}
