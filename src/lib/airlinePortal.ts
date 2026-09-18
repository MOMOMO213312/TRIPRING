// Airline Control Center — data layer
// Same pattern as src/lib/groundPortal.ts: a supplier login is a normal
// Supabase Auth user with a row in `supplier_users` (type='airline').
// All reads go through SECURITY DEFINER "get_my_airline_*" RPCs — the
// underlying v_airline_* views have no SELECT grant for
// authenticated/anon, same lock-down as v_ground_operations_queue.
// Do not switch any of these to `.from(view)`.

import { supabase } from "./supabase";

export interface AirlineOverviewRow {
  airline_supplier_id: string;
  airline_name: string;
  linked_airline_code: string | null;
  active_flights: number;
  departures_next_30d: number;
  total_bookings: number;
  active_bookings: number;
  ground_requests_open: number;
}

export interface AirlineFlightRow {
  airline_supplier_id: string;
  deal_id: string;
  airline_code: string | null;
  operating_airline_code: string | null;
  flight_number: string | null;
  from_airport: string;
  to_airport: string;
  departure_date: string;
  departure_time: string | null;
  arrival_time: string | null;
  return_date: string | null;
  stops: string;
  travel_class: string | null;
  price: number;
  currency: string;
  available_seats: number;
  status: string;
  source_system: string;
  booking_count: number;
  created_at: string;
  updated_at: string;
}

export interface AirlineBookingRow {
  airline_supplier_id: string;
  booking_id: string;
  booking_number: number;
  deal_id: string;
  flight_number: string | null;
  from_airport: string;
  to_airport: string;
  departure_date: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  channel: string;
  travelers_count: number;
  total_price: number | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
}

export type GroundRequestExecutionStatus =
  | "not_started"
  | "accepted"
  | "in_progress"
  | "completed"
  | "failed"
  | "no_show";

export interface AirlineGroundRequestRow {
  airline_supplier_id: string;
  order_item_id: string;
  order_id: string;
  fulfillment_status: string;
  execution_status: GroundRequestExecutionStatus;
  airport_leg: "departure" | "arrival" | null;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  service_type: string;
  service_name: string;
  ground_supplier_name: string | null;
  flight_number: string | null;
  departure_date: string | null;
  from_airport: string | null;
  to_airport: string | null;
  customer_name: string;
  customer_phone: string;
}

/** Which supplier does the currently logged-in user belong to?
 *  Identical query to getMySupplierId in groundPortal.ts — a user's
 *  supplier_users row doesn't carry a type by itself, so the login page
 *  confirms it's an airline by checking the id shows up in
 *  get_my_airline_overview() (which is airline-type-scoped server-side). */
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

export async function fetchAirlineOverview(): Promise<AirlineOverviewRow[]> {
  const { data, error } = await supabase.rpc("get_my_airline_overview" as never).select("*");
  if (error) throw error;
  return (data ?? []) as AirlineOverviewRow[];
}

export async function fetchAirlineFlights(statusFilter: string | null = null): Promise<AirlineFlightRow[]> {
  const { data, error } = await supabase
    .rpc("get_my_airline_flights", { p_status_filter: statusFilter } as never)
    .select("*")
    .order("departure_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AirlineFlightRow[];
}

export async function fetchAirlineBookings(statusFilter: string | null = null): Promise<AirlineBookingRow[]> {
  const { data, error } = await supabase
    .rpc("get_my_airline_bookings", { p_status_filter: statusFilter } as never)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AirlineBookingRow[];
}

export async function fetchAirlineGroundRequests(
  executionStatusFilter: string | null = null,
): Promise<AirlineGroundRequestRow[]> {
  const { data, error } = await supabase
    .rpc("get_my_airline_ground_requests", { p_execution_status_filter: executionStatusFilter } as never)
    .select("*")
    .order("departure_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AirlineGroundRequestRow[];
}
