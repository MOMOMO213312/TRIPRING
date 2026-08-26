import { supabase } from "./supabase";
import type {
  BookingChannel,
  BookingStatus,
  BookingTravelerInput,
  PaymentMethod,
  TransportType,
  TripGoBookingResult,
  TripGoBundleJoined,
  TripGoDealRow,
} from "../types/database";

/**
 * TripGo = Flight Ticket + Transport sold as one bundled product.
 *
 * Backed by 3 independent tables (source of truth is the live DB, not this
 * file): `tripgo_deals` (a transport offer an agency posted — private car or
 * shared/group transport, fully separate from `additional_services`),
 * `tripgo_bundles` (links one flight `deals` row + one `tripgo_deals` row;
 * the deal-owning agency sets `agency_selling_price` freely on top of the
 * transport's cost, so margin is whatever the agency decides), and
 * `tripgo_bookings` (the transport-side booking, created together with the
 * flight `bookings` row by the `create_tripgo_booking` RPC).
 */

const BUNDLE_JOINED_COLUMNS = "*, deal:deals!inner(*), tripgo_deal:tripgo_deals!inner(*)";

export type TripGoSearchFilters = {
  from?: string;
  to?: string;
  date?: string;
};

/** Active, bookable TripGo bundles (flight active + transport active), optionally filtered by route/date. */
export async function fetchActiveTripGoBundles(filters: TripGoSearchFilters = {}): Promise<TripGoBundleJoined[]> {
  let query = supabase
    .from("tripgo_bundles")
    .select(BUNDLE_JOINED_COLUMNS)
    .eq("deal.status", "active")
    .eq("tripgo_deal.status", "active")
    .order("created_at", { ascending: false });

  if (filters.from) query = query.eq("deal.from_airport", filters.from);
  if (filters.to) query = query.eq("deal.to_airport", filters.to);
  if (filters.date) query = query.eq("deal.departure_date", filters.date);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TripGoBundleJoined[];
}

/** A single bundle with its flight + transport details, for the TripGo details/booking page. */
export async function fetchTripGoBundleById(bundleId: string): Promise<TripGoBundleJoined | null> {
  const { data, error } = await supabase
    .from("tripgo_bundles")
    .select(BUNDLE_JOINED_COLUMNS)
    .eq("id", bundleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as TripGoBundleJoined) ?? null;
}

/** Every bundle already built on top of a given flight deal (used to offer "add TripGo transport" on the deal page). */
export async function fetchBundlesForDeal(dealId: string): Promise<TripGoBundleJoined[]> {
  const { data, error } = await supabase
    .from("tripgo_bundles")
    .select(BUNDLE_JOINED_COLUMNS)
    .eq("deal_id", dealId)
    .eq("tripgo_deal.status", "active");
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TripGoBundleJoined[];
}

/** Transport units the booking will consume: 1 car for `private` regardless of pax, else 1 seat per adult+child — mirrors create_tripgo_booking's own logic. */
export function transportUnitsNeeded(transportType: TransportType, adults: number, children: number): number {
  if (transportType === "private") return 1;
  return Math.max(adults + children, 1);
}

export function tripGoTotal(flightPrice: number, transferPrice: number): number {
  return Math.round((flightPrice + transferPrice) * 100) / 100;
}

export function transferKindLabel(transportType: TransportType, vehicleType?: string | null): string {
  if (transportType === "private") return vehicleType ? `🚗 عربية خاصة · ${vehicleType}` : "🚗 عربية خاصة";
  return vehicleType ? `🚐 نقل تشاركي · ${vehicleType}` : "🚐 نقل تشاركي";
}

// ── Booking (customer-facing) ───────────────────────────────────────────

export type TripGoBookingInput = {
  dealId: string;
  tripGoBundleId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  adultsCount: number;
  childrenCount: number;
  infantsCount: number;
  channel?: BookingChannel;
  paymentMethod: PaymentMethod;
  travelers: BookingTravelerInput[];
};

export async function bookTripGo(input: TripGoBookingInput): Promise<TripGoBookingResult> {
  const { data, error } = await supabase.rpc("create_tripgo_booking", {
    p_deal_id: input.dealId,
    p_tripgo_bundle_id: input.tripGoBundleId,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_customer_email: input.customerEmail || null,
    p_adults_count: input.adultsCount,
    p_children_count: input.childrenCount,
    p_infants_count: input.infantsCount,
    p_channel: input.channel ?? "web",
    p_payment_method: input.paymentMethod,
    p_travelers: input.travelers as never,
  } as never);
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("تعذر إنشاء حجز TripGo");
  return row as TripGoBookingResult;
}

// ── Agency-side management ──────────────────────────────────────────────

export async function fetchAgencyTripGoDeals(agencyId: string): Promise<TripGoDealRow[]> {
  const { data, error } = await supabase
    .from("tripgo_deals")
    .select("*")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as TripGoDealRow[];
}

export type TripGoDealFormInput = {
  transportType: TransportType;
  vehicleType: string | null;
  fromAirport: string | null;
  fromLocation: string | null;
  toAirport: string | null;
  toLocation: string | null;
  pickupDate: string;
  pickupTime: string | null;
  capacityTotal: number;
  price: number;
  currency: string;
  durationMinutes: number | null;
  notes: string | null;
};

export async function createTripGoDeal(agencyId: string, input: TripGoDealFormInput): Promise<void> {
  const { error } = await supabase.from("tripgo_deals").insert([
    {
      agency_id: agencyId,
      transport_type: input.transportType,
      vehicle_type: input.vehicleType || null,
      from_airport: input.fromAirport || null,
      from_location: input.fromLocation || null,
      to_airport: input.toAirport || null,
      to_location: input.toLocation || null,
      pickup_date: input.pickupDate,
      pickup_time: input.pickupTime || null,
      capacity_total: input.capacityTotal,
      capacity_available: input.capacityTotal,
      price: input.price,
      currency: input.currency,
      duration_minutes: input.durationMinutes,
      notes: input.notes || null,
      status: "active",
    },
  ] as never);
  if (error) throw new Error(error.message);
}

export async function setTripGoDealStatus(tripgoDealId: string, status: TripGoDealRow["status"]): Promise<void> {
  const { error } = await supabase.from("tripgo_deals").update({ status } as never).eq("id", tripgoDealId);
  if (error) throw new Error(error.message);
}

/** Bundles created on top of the agency's own flight deals (deal-ownership is what RLS keys off, not tripgo_deal ownership). */
export async function fetchAgencyTripGoBundles(agencyId: string): Promise<TripGoBundleJoined[]> {
  const { data, error } = await supabase
    .from("tripgo_bundles")
    .select(BUNDLE_JOINED_COLUMNS)
    .eq("deal.agency_id", agencyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TripGoBundleJoined[];
}

/** Create a bundle linking one of the agency's flight deals to one of its TripGo transport deals, with a freely-chosen selling price. */
export async function createTripGoBundle(
  dealId: string,
  tripgoDealId: string,
  agencySellingPrice: number,
): Promise<void> {
  // transport_cost_price is snapshotted from the live tripgo_deals.price at creation time.
  const { data: tripgoDeal, error: fetchError } = await supabase
    .from("tripgo_deals")
    .select("price")
    .eq("id", tripgoDealId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const { error } = await supabase.from("tripgo_bundles").insert([
    {
      deal_id: dealId,
      tripgo_deal_id: tripgoDealId,
      agency_selling_price: agencySellingPrice,
      transport_cost_price: (tripgoDeal as { price: number }).price,
    },
  ] as never);
  if (error) throw new Error(error.message);
}

export async function deleteTripGoBundle(bundleId: string): Promise<void> {
  const { error } = await supabase.from("tripgo_bundles").delete().eq("id", bundleId);
  if (error) throw new Error(error.message);
}

export async function fetchAgencyTripGoBookings(agencyId: string) {
  const { data, error } = await supabase
    .from("tripgo_bookings")
    .select("*, tripgo_deal:tripgo_deals(*)")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateTripGoBookingStatus(
  tripgoBookingId: string,
  status: BookingStatus,
): Promise<void> {
  const { error } = await supabase.from("tripgo_bookings").update({ status } as never).eq("id", tripgoBookingId);
  if (error) throw new Error(error.message);
}
