import { getCurrentUser } from "./auth";
import { supabase } from "./supabase";
import type { AirlineRow, AirportRow, BookingRow, BookingStatus, DealRow, ProfileRow, Tables } from "../types/database";

export type AgencyProfile = ProfileRow & { agency_name: string | null };

/** Returns the signed-in user's profile joined with their agency name, or null if not agency staff. */
export async function fetchMyAgencyProfile(): Promise<AgencyProfile | null> {
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
  if (row.role !== "agency" || !row.agency_id) return null;

  const { data: agency } = await supabase
    .from("agencies")
    .select("name")
    .eq("id", row.agency_id)
    .maybeSingle();

  return { ...row, agency_name: (agency as { name: string } | null)?.name ?? null };
}

const DEAL_FULL_COLUMNS =
  "id,agency_id,deal_type,airline_code,from_airport,to_airport,departure_date,departure_time,return_date,arrival_time,flight_duration_minutes,stops,stopover_airport,baggage_kg,travel_class,price,original_price,child_price,infant_price,available_seats,is_featured,status,duration_hours,expires_at,notes,currency,min_membership_tier,created_at,updated_at";

export async function fetchAgencyDeals(agencyId: string): Promise<DealRow[]> {
  const { data, error } = await supabase
    .from("deals")
    .select(DEAL_FULL_COLUMNS)
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DealRow[];
}

export type DealFormInput = {
  dealType: DealRow["deal_type"];
  airlineCode: string | null;
  fromAirport: string;
  toAirport: string;
  departureDate: string;
  departureTime: string | null;
  returnDate: string | null;
  arrivalTime: string | null;
  stops: DealRow["stops"];
  baggageKg: number | null;
  travelClass: string | null;
  price: number;
  originalPrice: number | null;
  childPrice: number | null;
  infantPrice: number | null;
  availableSeats: number;
  durationHours: number;
  expiresAt: string;
  notes: string | null;
  currency: string;
};

// ── Bulk import from Excel/CSV ──────────────────────────────────────────
// Agency staff copy fares off the Amadeus screen into a spreadsheet, then
// upload it here instead of re-typing every route into the one-deal-at-a-
// time form. Parsing/validation happens fully client-side (nothing touches
// Supabase) so staff can fix mistakes in the preview before anything is
// written — a bad row must never silently become a live public deal.

export const DEAL_IMPORT_TEMPLATE_COLUMNS = [
  "from_airport",
  "to_airport",
  "departure_date",
  "departure_time",
  "return_date",
  "arrival_time",
  "airline_code",
  "deal_type",
  "stops",
  "baggage_kg",
  "travel_class",
  "price",
  "original_price",
  "child_price",
  "infant_price",
  "available_seats",
  "duration_hours",
  "expires_at",
  "currency",
  "notes",
] as const;

const DEAL_TYPES: DealRow["deal_type"][] = ["flash", "last_minute", "empty_seat", "special_fare"];
const STOP_TYPES: DealRow["stops"][] = ["direct", "one_stop", "multi_stop"];

/** Default validity window for a manually-imported (non-live) fare: short on
 *  purpose, since the price was hand-copied off Amadeus and isn't re-checked
 *  automatically — a long window would let a stale fare sit on the site. */
export const DEAL_IMPORT_DEFAULT_VALID_HOURS = 6;

export type BulkImportRow = { rowNumber: number; input: DealFormInput };
export type BulkImportError = { rowNumber: number; message: string };
export type BulkImportResult = { rows: BulkImportRow[]; errors: BulkImportError[] };

function excelDateToIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    // Excel serial date (days since 1899-12-30).
    const ms = Math.round((value - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function excelTimeToHms(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") {
    const totalMinutes = Math.round(value * 24 * 60);
    const h = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
    const m = String(totalMinutes % 60).padStart(2, "0");
    return `${h}:${m}`;
  }
  return String(value).trim();
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Parses spreadsheet rows (already converted to plain objects, header row as
 *  keys) into validated deal inputs. Every row is checked independently so
 *  one bad row never blocks the rest of the batch — it's reported as an
 *  error and the agency fixes just that row. */
export function parseDealImportRows(
  rawRows: Record<string, unknown>[],
  airports: AirportRow[],
  airlines: AirlineRow[],
): BulkImportResult {
  const airportCodes = new Set(airports.map((a) => a.code));
  const airlineCodes = new Set(airlines.map((a) => a.code));
  const rows: BulkImportRow[] = [];
  const errors: BulkImportError[] = [];

  rawRows.forEach((raw, i) => {
    const rowNumber = i + 2; // account for the header row so numbers match what staff see in Excel
    const get = (key: string) => raw[key] ?? raw[key.toUpperCase()] ?? raw[key.toLowerCase()];

    const fromAirport = String(get("from_airport") ?? "").trim().toUpperCase();
    const toAirport = String(get("to_airport") ?? "").trim().toUpperCase();
    const departureDate = excelDateToIso(get("departure_date"));
    const price = toNumberOrNull(get("price"));
    const rowErrors: string[] = [];

    if (!fromAirport) rowErrors.push("مطار المغادرة (from_airport) فاضي");
    else if (!airportCodes.has(fromAirport)) rowErrors.push(`مطار المغادرة "${fromAirport}" غير موجود`);

    if (!toAirport) rowErrors.push("مطار الوصول (to_airport) فاضي");
    else if (!airportCodes.has(toAirport)) rowErrors.push(`مطار الوصول "${toAirport}" غير موجود`);

    if (fromAirport && toAirport && fromAirport === toAirport) rowErrors.push("مطار المغادرة والوصول نفس الشيء");

    if (!departureDate) rowErrors.push("تاريخ المغادرة (departure_date) غير صالح");

    if (price === null || price <= 0) rowErrors.push("السعر (price) غير صالح");

    const airlineCodeRaw = get("airline_code");
    const airlineCode = airlineCodeRaw ? String(airlineCodeRaw).trim().toUpperCase() : null;
    if (airlineCode && !airlineCodes.has(airlineCode)) rowErrors.push(`شركة الطيران "${airlineCode}" غير موجودة`);

    const dealTypeRaw = String(get("deal_type") ?? "flash").trim() as DealRow["deal_type"];
    const dealType = DEAL_TYPES.includes(dealTypeRaw) ? dealTypeRaw : "flash";

    const stopsRaw = String(get("stops") ?? "direct").trim() as DealRow["stops"];
    const stops = STOP_TYPES.includes(stopsRaw) ? stopsRaw : "direct";

    const returnDate = excelDateToIso(get("return_date"));
    const availableSeats = toNumberOrNull(get("available_seats")) ?? 1;
    const durationHours = toNumberOrNull(get("duration_hours")) ?? 24;

    let expiresAt = get("expires_at") ? excelDateToIso(get("expires_at")) : null;
    if (!expiresAt) {
      expiresAt = new Date(Date.now() + DEAL_IMPORT_DEFAULT_VALID_HOURS * 3600 * 1000).toISOString();
    } else {
      // A bare date column with no time defaults to end-of-day so the deal doesn't expire the instant it's imported.
      expiresAt = new Date(`${expiresAt}T23:59:00`).toISOString();
    }

    if (rowErrors.length > 0) {
      errors.push({ rowNumber, message: rowErrors.join("، ") });
      return;
    }

    rows.push({
      rowNumber,
      input: {
        dealType,
        airlineCode,
        fromAirport,
        toAirport,
        departureDate: departureDate!,
        departureTime: excelTimeToHms(get("departure_time")),
        returnDate,
        arrivalTime: excelTimeToHms(get("arrival_time")),
        stops,
        baggageKg: toNumberOrNull(get("baggage_kg")),
        travelClass: String(get("travel_class") ?? "economy").trim() || "economy",
        price: price!,
        originalPrice: toNumberOrNull(get("original_price")),
        childPrice: toNumberOrNull(get("child_price")),
        infantPrice: toNumberOrNull(get("infant_price")),
        availableSeats,
        durationHours,
        expiresAt,
        notes: get("notes") ? String(get("notes")) : null,
        currency: String(get("currency") ?? "USD").trim() || "USD",
      },
    });
  });

  return { rows, errors };
}

/** Inserts every validated row as one batch. All-or-nothing: if Supabase
 *  rejects the batch, nothing is partially written that the agency wouldn't
 *  see reflected in the preview they approved. */
export async function bulkCreateDeals(agencyId: string, inputs: DealFormInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const { error } = await supabase.from("deals").insert(
    inputs.map((input) => ({
      agency_id: agencyId,
      deal_type: input.dealType,
      airline_code: input.airlineCode || null,
      from_airport: input.fromAirport,
      to_airport: input.toAirport,
      departure_date: input.departureDate,
      departure_time: input.departureTime || null,
      return_date: input.returnDate || null,
      arrival_time: input.arrivalTime || null,
      stops: input.stops,
      baggage_kg: input.baggageKg,
      travel_class: input.travelClass || "economy",
      price: input.price,
      original_price: input.originalPrice,
      child_price: input.childPrice,
      infant_price: input.infantPrice,
      available_seats: input.availableSeats,
      duration_hours: input.durationHours,
      expires_at: input.expiresAt,
      notes: input.notes || null,
      currency: input.currency,
      status: "active",
    })) as never,
  );
  if (error) throw new Error(error.message);
}

export async function createDeal(agencyId: string, input: DealFormInput): Promise<void> {
  const { error } = await supabase.from("deals").insert([
    {
      agency_id: agencyId,
      deal_type: input.dealType,
      airline_code: input.airlineCode || null,
      from_airport: input.fromAirport,
      to_airport: input.toAirport,
      departure_date: input.departureDate,
      departure_time: input.departureTime || null,
      return_date: input.returnDate || null,
      arrival_time: input.arrivalTime || null,
      stops: input.stops,
      baggage_kg: input.baggageKg,
      travel_class: input.travelClass || "economy",
      price: input.price,
      original_price: input.originalPrice,
      child_price: input.childPrice,
      infant_price: input.infantPrice,
      available_seats: input.availableSeats,
      duration_hours: input.durationHours,
      expires_at: input.expiresAt,
      notes: input.notes || null,
      currency: input.currency,
      status: "active",
    },
  ] as never);
  if (error) throw new Error(error.message);
}

export async function updateDeal(dealId: string, patch: Partial<DealFormInput>): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.dealType !== undefined) dbPatch.deal_type = patch.dealType;
  if (patch.airlineCode !== undefined) dbPatch.airline_code = patch.airlineCode || null;
  if (patch.fromAirport !== undefined) dbPatch.from_airport = patch.fromAirport;
  if (patch.toAirport !== undefined) dbPatch.to_airport = patch.toAirport;
  if (patch.departureDate !== undefined) dbPatch.departure_date = patch.departureDate;
  if (patch.departureTime !== undefined) dbPatch.departure_time = patch.departureTime || null;
  if (patch.returnDate !== undefined) dbPatch.return_date = patch.returnDate || null;
  if (patch.arrivalTime !== undefined) dbPatch.arrival_time = patch.arrivalTime || null;
  if (patch.stops !== undefined) dbPatch.stops = patch.stops;
  if (patch.baggageKg !== undefined) dbPatch.baggage_kg = patch.baggageKg;
  if (patch.travelClass !== undefined) dbPatch.travel_class = patch.travelClass || "economy";
  if (patch.price !== undefined) dbPatch.price = patch.price;
  if (patch.originalPrice !== undefined) dbPatch.original_price = patch.originalPrice;
  if (patch.childPrice !== undefined) dbPatch.child_price = patch.childPrice;
  if (patch.infantPrice !== undefined) dbPatch.infant_price = patch.infantPrice;
  if (patch.availableSeats !== undefined) dbPatch.available_seats = patch.availableSeats;
  if (patch.durationHours !== undefined) dbPatch.duration_hours = patch.durationHours;
  if (patch.expiresAt !== undefined) dbPatch.expires_at = patch.expiresAt;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes || null;
  if (patch.currency !== undefined) dbPatch.currency = patch.currency;

  const { error } = await supabase.from("deals").update(dbPatch as never).eq("id", dealId);
  if (error) throw new Error(error.message);
}

/** Toggle a deal between active and cancelled ("pause"/"resume") without touching other fields. */
export async function setDealStatus(dealId: string, status: DealRow["status"]): Promise<void> {
  const { error } = await supabase.from("deals").update({ status } as never).eq("id", dealId);
  if (error) throw new Error(error.message);
}

export type BookingStatusGroup = "new" | "awaiting_payment" | "confirmed" | "cancelled" | "all";

const BOOKING_FULL_COLUMNS =
  "id,booking_number,deal_id,agency_id,customer_name,customer_phone,customer_email,notes,channel,payment_method,status,payment_proof_url,payment_ref,payment_at,ticket_url,handled_by,created_at,updated_at,unit_price,total_price,currency,adults_count,children_count,infants_count,travelers_count";

const STATUS_GROUPS: Record<Exclude<BookingStatusGroup, "all">, BookingStatus[]> = {
  new: ["new"],
  awaiting_payment: ["awaiting_payment", "payment_uploaded"],
  confirmed: ["paid", "ticket_issued"],
  cancelled: ["cancelled"],
};

export async function fetchAgencyBookings(
  agencyId: string,
  group: BookingStatusGroup = "all",
): Promise<BookingRow[]> {
  let query = supabase
    .from("bookings")
    .select(BOOKING_FULL_COLUMNS)
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  if (group !== "all") {
    query = query.in("status", STATUS_GROUPS[group]);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as BookingRow[];
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  extra: Partial<{ paymentRef: string | null; ticketUrl: string | null }> = {},
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (extra.paymentRef !== undefined) patch.payment_ref = extra.paymentRef || null;
  if (extra.ticketUrl !== undefined) patch.ticket_url = extra.ticketUrl || null;
  if (status === "paid") patch.payment_at = new Date().toISOString();

  const { error } = await supabase.from("bookings").update(patch as never).eq("id", bookingId);
  if (error) throw new Error(error.message);
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  awaiting_payment: "بانتظار الدفع",
  payment_uploaded: "تم رفع إثبات الدفع",
  paid: "تم الدفع",
  ticket_issued: "تم إصدار التذكرة",
  cancelled: "ملغي",
};

export const DEAL_STATUS_LABELS: Record<DealRow["status"], string> = {
  draft: "مسودة",
  active: "نشط",
  expired: "منتهي",
  sold_out: "نفدت المقاعد",
  cancelled: "متوقف",
};

export type AgencyReviewRowFull = Tables<"agency_reviews">;
