// Airline Control Center — data layer
// Same pattern as src/lib/groundPortal.ts: a supplier login is a normal
// Supabase Auth user with a row in `supplier_users` (type='airline').
// All reads go through SECURITY DEFINER "get_my_airline_*" RPCs — the
// underlying v_airline_* views have no SELECT grant for
// authenticated/anon, same lock-down as v_ground_operations_queue.
// Do not switch any of these to `.from(view)`.

import { supabase } from "./supabase";
import type { LocalizedTextMap } from "../types/database";

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
  // enriched — ensures the request carries the full ticket/service data,
  // not just a flight+customer stub (booking_id/booking_number = "ticket").
  booking_id: string | null;
  booking_number: number | null;
  quantity: number;
  customer_price: number | null;
  currency: string | null;
  payment_status: string | null;
  execution_note: string | null;
  delivery_location: string | null;
  delivery_method: string | null;
  terms: string | null;
  max_weight_kg: number | null;
  ground_supplier_id: string | null;
  ground_supplier_phone: string | null;
  sla_hours: number | null;
  sla_deadline: string | null;
  departure_time: string | null;
  customer_email: string | null;
  agency_name: string | null;
  booking_notes: string | null;
  passenger_names: string | null;
}

export interface AirlineAgreementRow {
  agreement_id: string;
  airline_supplier_id: string;
  ground_supplier_id: string;
  ground_supplier_name: string;
  airport_code: string;
  status: "draft" | "active" | "suspended" | "ended";
  airline_approved: boolean;
  airline_approved_at: string | null;
  airline_review_note: string | null;
  sla_hours: number | null;
  sla_notes: string | null;
  currency: string;
  starts_at: string | null;
  ends_at: string | null;
  item_count: number;
  created_at: string;
}

export interface AirlineAgreementItemRow {
  item_id: string;
  agreement_id: string;
  service_type: string;
  service_name: string;
  billing_unit: "per_pax" | "per_flight" | "flat";
  cost_price: number;
  is_active: boolean;
}

export interface AirlineFlightOfferDetailRow {
  deal_id: string;
  flight_number: string | null;
  from_airport: string;
  to_airport: string;
  departure_date: string;
  travel_class: string | null;
  fare_family: string | null;
  base_fare: number | null;
  taxes_fees: number | null;
  price: number;
  original_price: number | null;
  child_price: number | null;
  infant_price: number | null;
  currency: string;
  available_seats: number;
  refundable: boolean | null;
  changeable: boolean | null;
  change_fee: number | null;
  cancellation_fee: number | null;
  fare_rules: string | null;
  baggage_kg: number | null;
  cabin_baggage_kg: number | null;
  checked_bags_count: number | null;
  extra_baggage_price: number | null;
  min_membership_tier: string | null;
  price_checked_at: string | null;
  status: string;
}

export type SettlementStatus = "draft" | "pending" | "paid" | "disputed" | "cancelled";

export interface AirlineSettlementRow {
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
}

/** Full fare detail for one flight/deal — fare rules, baggage, refund/
 *  change policy. Used by the expandable row in AirlinePortalFlightsPage;
 *  the RPC itself already existed on the DB (airline-scoped SECURITY
 *  DEFINER check via linked_airline_code) but had no caller in the front
 *  end until now. */
export async function fetchAirlineFlightOfferDetail(dealId: string): Promise<AirlineFlightOfferDetailRow | null> {
  const { data, error } = await supabase
    .rpc("get_my_airline_flight_offer_detail", { p_deal_id: dealId } as never)
    .select("*");
  if (error) throw error;
  const rows = (data ?? []) as AirlineFlightOfferDetailRow[];
  return rows[0] ?? null;
}

/** كشوف الحساب — `supplier_settlements` RLS is generic per supplier_users
 *  row (not ground-specific), same table Ground Portal reads from. No new
 *  backend needed for the airline side to see its own settlements. */
export async function fetchAirlineSettlements(): Promise<AirlineSettlementRow[]> {
  const { data, error } = await supabase
    .from("supplier_settlements")
    .select("*")
    .order("period_end", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AirlineSettlementRow[];
}

/** Contracts/العقود — read-only on the airline side by design (only the
 *  ground supplier can create/edit an agreement; this matches the real SGHA
 *  relationship and the RLS already in place on these tables). */
export async function fetchAirlineAgreements(): Promise<AirlineAgreementRow[]> {
  const { data, error } = await supabase.rpc("get_my_airline_agreements" as never).select("*");
  if (error) throw error;
  return (data ?? []) as AirlineAgreementRow[];
}

/** The contracting airline approves (or rejects) a ground-handler agreement.
 *  Only an approved agreement is used to route ground services to that handler.
 *  Authorization is enforced inside the SECURITY DEFINER RPC (airline owner or admin). */
export async function reviewGroundAgreement(agreementId: string, approve: boolean, note: string | null) {
  const { error } = await supabase.rpc(
    "review_ground_service_agreement" as never,
    { p_agreement_id: agreementId, p_approve: approve, p_note: note } as never,
  );
  if (error) throw error;
}

export async function fetchAirlineAgreementItems(agreementId: string): Promise<AirlineAgreementItemRow[]> {
  const { data, error } = await supabase
    .rpc("get_my_airline_agreement_items", { p_agreement_id: agreementId } as never)
    .select("*");
  if (error) throw error;
  return (data ?? []) as AirlineAgreementItemRow[];
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

export interface AirlineRoutePerformanceRow {
  route: string;
  bookings: number;
  revenue: number;
  avgPrice: number;
}

export interface AirlineMonthlyPerformanceRow {
  month: string; // YYYY-MM
  bookings: number;
  revenue: number;
}

export interface AirlinePerformanceReport {
  currency: string | null;
  totalBookings: number;
  ticketIssuedCount: number;
  cancelledCount: number;
  cancellationRate: number; // 0..1
  totalRevenue: number;
  avgBookingValue: number;
  byRoute: AirlineRoutePerformanceRow[];
  byMonth: AirlineMonthlyPerformanceRow[];
}

const CANCELLED_STATUSES = new Set(["cancelled", "canceled"]);

/** Pure aggregation over already-fetched bookings — no new RPC needed.
 *  get_my_airline_bookings() already returns everything this report needs
 *  (route, total_price, currency, status, created_at) per booking; this
 *  just groups/sums it client-side. If the volume ever outgrows that,
 *  move this logic into a SQL view/RPC without changing the page. */
export function buildAirlinePerformanceReport(bookings: AirlineBookingRow[]): AirlinePerformanceReport {
  const currencyCounts = new Map<string, number>();
  for (const b of bookings) {
    if (b.currency) currencyCounts.set(b.currency, (currencyCounts.get(b.currency) ?? 0) + 1);
  }
  let currency: string | null = null;
  let bestCount = 0;
  for (const [cur, count] of currencyCounts) {
    if (count > bestCount) {
      currency = cur;
      bestCount = count;
    }
  }

  const priced = bookings.filter((b) => b.total_price != null && (currency == null || b.currency === currency));

  let ticketIssuedCount = 0;
  let cancelledCount = 0;
  for (const b of bookings) {
    if (CANCELLED_STATUSES.has(b.status)) cancelledCount += 1;
    else ticketIssuedCount += 1;
  }

  const totalRevenue = priced.reduce((sum, b) => sum + (b.total_price ?? 0), 0);

  const routeMap = new Map<string, { bookings: number; revenue: number }>();
  for (const b of priced) {
    const key = `${b.from_airport} → ${b.to_airport}`;
    const entry = routeMap.get(key) ?? { bookings: 0, revenue: 0 };
    entry.bookings += 1;
    entry.revenue += b.total_price ?? 0;
    routeMap.set(key, entry);
  }
  const byRoute: AirlineRoutePerformanceRow[] = [...routeMap.entries()]
    .map(([route, v]) => ({ route, bookings: v.bookings, revenue: v.revenue, avgPrice: v.revenue / v.bookings }))
    .sort((a, b) => b.revenue - a.revenue);

  const monthMap = new Map<string, { bookings: number; revenue: number }>();
  for (const b of priced) {
    const month = b.created_at.slice(0, 7);
    const entry = monthMap.get(month) ?? { bookings: 0, revenue: 0 };
    entry.bookings += 1;
    entry.revenue += b.total_price ?? 0;
    monthMap.set(month, entry);
  }
  const byMonth: AirlineMonthlyPerformanceRow[] = [...monthMap.entries()]
    .map(([month, v]) => ({ month, bookings: v.bookings, revenue: v.revenue }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    currency,
    totalBookings: bookings.length,
    ticketIssuedCount,
    cancelledCount,
    cancellationRate: bookings.length > 0 ? cancelledCount / bookings.length : 0,
    totalRevenue,
    avgBookingValue: priced.length > 0 ? totalRevenue / priced.length : 0,
    byRoute,
    byMonth,
  };
}

/** Ancillary types an airline can self-serve — enforced server-side inside
 *  `airline_upsert_service` (v_allowed_types); this list must stay in sync
 *  with that function. Excludes agency-affiliate categories (hotel/
 *  car_rental/travel_insurance/etc.) — only the unambiguous "airline owns
 *  and prices this" product/assistance/ground-execution types, per the
 *  agreed Phase A/B/(rules) decision. 19 types total, grouped for display
 *  to match the agreed reference image (7 groups) — the grouping below is
 *  a UI/display choice only, not enforced by the database. */
export const AIRLINE_ANCILLARY_TYPES = [
  "fast_track",
  "priority_boarding",
  "priority_baggage",
  "check_in_assistance",
  "lounge",
  "meet_assist",
  "seat_selection",
  "meal_upgrade",
  "extra_baggage",
  "baggage_wrapping",
  "baggage_storage",
  "connection_protection",
  "arrival_assistance",
  "immigration_assistance",
  "unaccompanied_minor",
  "family_seating",
  "wheelchair",
  "boarding_assistance",
  "flight_change_option",
] as const;
export type AirlineAncillaryType = (typeof AIRLINE_ANCILLARY_TYPES)[number];

export type AirlineServiceGroupId =
  | "priority_speed"
  | "comfort"
  | "baggage"
  | "transit"
  | "family_kids"
  | "senior_prm"
  | "flexible";

export interface AirlineServiceTypeMeta {
  type: AirlineAncillaryType;
  label: string;
  /** Optional type-specific keys for the free-form `attributes` jsonb field —
   *  purely a UI convenience over a generic object column; not validated by
   *  a per-type schema on the server. */
  attributeFields?: { key: string; label: string; placeholder?: string }[];
}

export interface AirlineServiceGroup {
  id: AirlineServiceGroupId;
  label: string;
  types: AirlineServiceTypeMeta[];
}

/** 7 display groups matching the reference image (منتجات الإيرادات الإضافية
 *  في خدمات المناولة الأرضية). Order here is the tab order in the UI. */
export const AIRLINE_SERVICE_GROUPS: AirlineServiceGroup[] = [
  {
    id: "priority_speed",
    label: "الأولوية والسرعة",
    types: [
      { type: "fast_track", label: "المسار السريع (Fast Track)" },
      { type: "priority_boarding", label: "أولوية الصعود للطائرة" },
      { type: "priority_baggage", label: "أولوية استلام الأمتعة" },
      { type: "check_in_assistance", label: "أولوية إنهاء إجراءات السفر" },
    ],
  },
  {
    id: "comfort",
    label: "الراحة والرفاهية",
    types: [
      { type: "lounge", label: "صالة كبار الشخصيات (VIP Lounge)", attributeFields: [{ key: "lounge_name", label: "اسم الصالة" }] },
      { type: "meet_assist", label: "خدمات الاستقبال والمساعدة", attributeFields: [{ key: "meeting_point", label: "نقطة اللقاء" }] },
      { type: "seat_selection", label: "اختيار المقعد", attributeFields: [{ key: "seat_zone", label: "نوع المقعد (نافذة / ممر / صف مخرج طوارئ)" }] },
      { type: "meal_upgrade", label: "ترقية الوجبة", attributeFields: [{ key: "meal_type", label: "نوع الوجبة" }] },
    ],
  },
  {
    id: "baggage",
    label: "خدمات الأمتعة",
    types: [
      { type: "extra_baggage", label: "حقيبة إضافية" },
      { type: "baggage_wrapping", label: "تغليف الأمتعة" },
      { type: "baggage_storage", label: "تخزين الأمتعة", attributeFields: [{ key: "storage_duration_hours", label: "مدة التخزين (ساعات)" }] },
    ],
  },
  {
    id: "transit",
    label: "الترانزيت والربط",
    types: [
      { type: "connection_protection", label: "ضمان ضد فوات الرحلة", attributeFields: [{ key: "min_connection_minutes", label: "أقل وقت ربط مضمون (دقيقة)" }] },
      { type: "arrival_assistance", label: "استقبال ومساعدة عند الوصول" },
      { type: "immigration_assistance", label: "تسهيل إجراءات الجوازات والعبور" },
    ],
  },
  {
    id: "family_kids",
    label: "العائلات والأطفال",
    types: [
      { type: "unaccompanied_minor", label: "خدمة الأطفال غير المصحوبين", attributeFields: [{ key: "age_range", label: "الفئة العمرية" }] },
      { type: "family_seating", label: "مقاعد متجاورة للعائلة", attributeFields: [{ key: "max_group_size", label: "أقصى عدد أفراد" }] },
    ],
  },
  {
    id: "senior_prm",
    label: "كبار السن وذوي الإعاقة",
    types: [
      { type: "wheelchair", label: "مساعدة كبار السن وذوي الإعاقة (كرسي متحرك)", attributeFields: [{ key: "assistance_level", label: "مستوى المساعدة" }] },
      { type: "boarding_assistance", label: "مرافقة من الباب للطائرة" },
    ],
  },
  {
    id: "flexible",
    label: "الخدمات الخاصة والمرنة",
    types: [{ type: "flight_change_option", label: "خيار تغيير موعد الرحلة", attributeFields: [{ key: "advance_notice_hours", label: "مهلة الإخطار قبل التغيير (ساعات)" }] }],
  },
];

/** Flat type → label / group lookup built from AIRLINE_SERVICE_GROUPS, so
 *  the rest of the app (table cells, filters) doesn't have to re-walk the
 *  groups array. */
export const AIRLINE_SERVICE_TYPE_META: Record<AirlineAncillaryType, AirlineServiceTypeMeta> = Object.fromEntries(
  AIRLINE_SERVICE_GROUPS.flatMap((g) => g.types.map((t) => [t.type, t])),
) as Record<AirlineAncillaryType, AirlineServiceTypeMeta>;

export const AIRLINE_SERVICE_TYPE_GROUP: Record<AirlineAncillaryType, AirlineServiceGroupId> = Object.fromEntries(
  AIRLINE_SERVICE_GROUPS.flatMap((g) => g.types.map((t) => [t.type, g.id])),
) as Record<AirlineAncillaryType, AirlineServiceGroupId>;

export interface AirlineServiceRow {
  id: string;
  type: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
  category: string | null;
  delivery_location: string | null;
  delivery_method: string | null;
  terms: string | null;
  max_weight_kg: number | null;
  max_quantity_per_pax: number | null;
  capacity_per_flight: number | null;
  attributes: Record<string, string> | null;
  active_rules_count: number;
  name_i18n?: LocalizedTextMap | null;
  description_i18n?: LocalizedTextMap | null;
  terms_i18n?: LocalizedTextMap | null;
}

/** الخدمات الإضافية — the airline's own ancillary catalog. Read-scoped to
 *  the caller's own airline_supplier_id server-side inside the RPC. */
export async function fetchAirlineServices(): Promise<AirlineServiceRow[]> {
  const { data, error } = await supabase.rpc("get_my_airline_services" as never).select("*");
  if (error) throw error;
  return (data ?? []) as AirlineServiceRow[];
}

/** Create (p_id omitted) or update (p_id set) one of the airline's own
 *  ancillary services. Ownership/type-whitelist/field-length/limit checks
 *  are enforced server-side — the client can't create a service outside
 *  AIRLINE_ANCILLARY_TYPES or edit another supplier's row. On update, type
 *  can't be changed (matches the RPC, which ignores p_type when p_id is set). */
export async function upsertAirlineService(input: {
  id?: string;
  type?: AirlineAncillaryType;
  name?: string;
  description?: string | null;
  price?: number;
  isActive?: boolean;
  deliveryLocation?: string | null;
  deliveryMethod?: string | null;
  terms?: string | null;
  maxWeightKg?: number | null;
  maxQuantityPerPax?: number | null;
  capacityPerFlight?: number | null;
  attributes?: Record<string, string> | null;
  nameI18n?: LocalizedTextMap | null;
  descriptionI18n?: LocalizedTextMap | null;
  termsI18n?: LocalizedTextMap | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("airline_upsert_service" as never, {
    p_id: input.id ?? null,
    p_type: input.type ?? null,
    p_name: input.name ?? null,
    p_description: input.description ?? null,
    p_price: input.price ?? null,
    p_is_active: input.isActive ?? true,
    p_delivery_location: input.deliveryLocation ?? null,
    p_delivery_method: input.deliveryMethod ?? null,
    p_terms: input.terms ?? null,
    p_max_weight_kg: input.maxWeightKg ?? null,
    p_max_quantity_per_pax: input.maxQuantityPerPax ?? null,
    p_capacity_per_flight: input.capacityPerFlight ?? null,
    p_attributes: input.attributes ?? null,
    p_name_i18n: input.nameI18n ?? null,
    p_description_i18n: input.descriptionI18n ?? null,
    p_terms_i18n: input.termsI18n ?? null,
  } as never);
  if (error) throw error;
  return data as string;
}

export async function setAirlineServiceActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.rpc("airline_set_service_active" as never, {
    p_id: id,
    p_is_active: isActive,
  } as never);
  if (error) throw error;
}

export type AirlineServiceRuleAirportRole = "any" | "departure" | "arrival";

export interface AirlineServiceRuleRow {
  id: string;
  airport_code: string | null;
  airport_role: AirlineServiceRuleAirportRole;
  travel_class: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  flight_number: string | null;
  from_airport: string | null;
  to_airport: string | null;
  deal_id: string | null;
  cutoff_hours: number | null;
  note: string | null;
}

/** قواعد الإتاحة لخدمة معيّنة — على أنهي رحلات/مسارات/مطارات تظهر الخدمة.
 *  Bug fix applied server-side this session; this is the first caller. */
export async function fetchAirlineServiceRules(additionalServiceId: string): Promise<AirlineServiceRuleRow[]> {
  const { data, error } = await supabase
    .rpc("get_my_service_rules", { p_additional_service_id: additionalServiceId } as never)
    .select("*");
  if (error) throw error;
  return (data ?? []) as AirlineServiceRuleRow[];
}

/** Create (p_id omitted) or update (p_id set) one availability rule.
 *  Ownership of the parent service, and — when a specific deal_id is given —
 *  that the flight actually belongs to this airline, are both enforced
 *  server-side. */
export async function upsertAirlineServiceRule(input: {
  id?: string;
  additionalServiceId: string;
  airportCode?: string | null;
  airportRole?: AirlineServiceRuleAirportRole;
  travelClass?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
  flightNumber?: string | null;
  fromAirport?: string | null;
  toAirport?: string | null;
  dealId?: string | null;
  cutoffHours?: number | null;
  note?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("airline_upsert_service_rule" as never, {
    p_id: input.id ?? null,
    p_additional_service_id: input.additionalServiceId,
    p_airport_code: input.airportCode ?? null,
    p_travel_class: input.travelClass ?? null,
    p_starts_at: input.startsAt ?? null,
    p_ends_at: input.endsAt ?? null,
    p_is_active: input.isActive ?? true,
    p_flight_number: input.flightNumber ?? null,
    p_from_airport: input.fromAirport ?? null,
    p_to_airport: input.toAirport ?? null,
    p_airport_role: input.airportRole ?? "any",
    p_deal_id: input.dealId ?? null,
    p_cutoff_hours: input.cutoffHours ?? null,
    p_note: input.note ?? null,
  } as never);
  if (error) throw error;
  return data as string;
}

export async function deleteAirlineServiceRule(id: string): Promise<void> {
  const { error } = await supabase.rpc("airline_delete_service_rule" as never, { p_id: id } as never);
  if (error) throw error;
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
