import { getCurrentUser } from "./auth";
import { supabase } from "./supabase";
import type {
  AgencyRow,
  AgencyVerificationDocument,
  AirlineRow,
  AirportRow,
  BookingRow,
  BookingServiceStatus,
  BookingStatus,
  DealRow,
  ProfileRow,
  Tables,
} from "../types/database";

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

// ── Verification documents (self-service) ───────────────────────────────
// Agency staff can upload their own official documents and see their
// verification status, but can't set verification_status themselves — that
// stays admin-only (see lib/admin.ts setAgencyVerificationStatus). Uploads
// go through the agency_append_document() RPC (SECURITY DEFINER) so an
// agency can only ever touch its own row's document list, never anyone
// else's or any other column on agencies.
const AGENCY_DOC_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const AGENCY_DOC_MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function fetchMyAgency(agencyId: string): Promise<AgencyRow | null> {
  const { data, error } = await supabase.from("agencies").select("*").eq("id", agencyId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as AgencyRow | null;
}

export async function uploadMyAgencyDocument(agencyId: string, label: string, file: File): Promise<AgencyRow> {
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

  const { data, error } = await supabase.rpc("agency_append_document", {
    p_label: label,
    p_path: path,
  } as never);
  if (error) throw new Error(error.message);
  return data as AgencyRow;
}

export async function getMyAgencyDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("agency-documents").createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export type { AgencyVerificationDocument };

const DEAL_FULL_COLUMNS =
  "id,agency_id,deal_type,airline_code,from_airport,to_airport,departure_date,departure_time,return_date,arrival_time,flight_duration_minutes,stops,stopover_airport,baggage_kg,travel_class,price,original_price,child_price,infant_price,base_fare,taxes_fees,available_seats,is_featured,status,duration_hours,expires_at,notes,currency,min_membership_tier,created_at,updated_at";

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
  // Extended fields — all optional so the existing single-deal form (which
  // doesn't set any of these) still compiles and works unchanged; the bulk
  // import path is the only one that currently fills them in.
  flightNumber?: string | null;
  aircraftType?: string | null;
  operatingAirlineCode?: string | null;
  stopoverAirport?: string | null;
  layoverMinutes?: number | null;
  arrivalDate?: string | null;
  flightDurationMinutes?: number | null;
  fareFamily?: string | null;
  refundable?: boolean | null;
  changeable?: boolean | null;
  changeFee?: number | null;
  cancellationFee?: number | null;
  checkedBagsCount?: number | null;
  cabinBaggageKg?: number | null;
  extraBaggagePrice?: number | null;
  baseFare?: number | null;
  taxesFees?: number | null;
  minMembershipTier?: "free" | "premium";
  tripTypes?: string[];
  isFeatured?: boolean;
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

/** Extended columns appended to the right of every route tab (see
 *  public/templates/tripring-deals-template.xlsx) — all optional, a row
 *  that leaves them blank still imports fine with the basics above. */
export const DEAL_IMPORT_EXTRA_COLUMNS = [
  "flight_number",
  "aircraft_type",
  "operating_airline_code",
  "stopover_airport",
  "layover_minutes",
  "arrival_date",
  "flight_duration_minutes",
  "fare_family",
  "refundable",
  "changeable",
  "change_fee",
  "cancellation_fee",
  "checked_bags_count",
  "cabin_baggage_kg",
  "extra_baggage_price",
  "base_fare",
  "taxes_fees",
  "min_membership_tier",
  "trip_types",
  "is_featured",
] as const;

const DEAL_TYPES: DealRow["deal_type"][] = ["flash", "last_minute", "empty_seat", "special_fare"];
const STOP_TYPES: DealRow["stops"][] = ["direct", "one_stop", "multi_stop"];
const MEMBERSHIP_TIERS = ["free", "premium"] as const;
const TRIP_TYPES = [
  "beach", "city", "adventure", "business", "family",
  "religious", "shopping", "nature", "ski", "honeymoon",
];

function toBoolOrNull(value: unknown): boolean | null {
  if (value == null || value === "") return null;
  const s = String(value).trim().toUpperCase();
  if (s === "TRUE" || s === "1" || s === "YES") return true;
  if (s === "FALSE" || s === "0" || s === "NO") return false;
  return null;
}

/** Default validity window for a manually-imported (non-live) fare: short on
 *  purpose, since the price was hand-copied off Amadeus and isn't re-checked
 *  automatically — a long window would let a stale fare sit on the site. */
export const DEAL_IMPORT_DEFAULT_VALID_HOURS = 6;

export type DuplicateMatch = {
  existingDealId: string;
  agencyName: string | null;
  price: number;
  currency: string | null;
  matchedBy: "flight_number" | "route_date";
};

export type BulkImportRow = {
  rowNumber: number;
  rowLabel: string;
  input: DealFormInput;
  duplicate?: DuplicateMatch | null;
};
export type BulkImportError = { rowNumber: number; rowLabel: string; message: string };
export type BulkImportResult = { rows: BulkImportRow[]; errors: BulkImportError[] };

/** Sheet names in the multi-tab template (see public/templates/tripring-deals-template.xlsx)
 *  that hold instructions/dropdown source data rather than deal rows — skipped on import. */
export const DEAL_IMPORT_META_SHEETS = ["تعليمات", "القوائم"];

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
  sheetLabel?: string,
): BulkImportResult {
  const airportCodes = new Set(airports.map((a) => a.code));
  const airlineCodes = new Set(airlines.map((a) => a.code));
  const rows: BulkImportRow[] = [];
  const errors: BulkImportError[] = [];

  rawRows.forEach((raw, i) => {
    const rowNumber = i + 2; // account for the header row so numbers match what staff see in Excel
    const rowLabel = sheetLabel ? `${sheetLabel} – صف ${rowNumber}` : `صف ${rowNumber}`;
    const get = (key: string) => raw[key] ?? raw[key.toUpperCase()] ?? raw[key.toLowerCase()];

    // The route-tab template pre-fills from_airport/to_airport on every
    // working row (up to row 300) so staff never retype the route — that
    // means an untouched row still has those two cells populated. Treat a
    // row as "not actually used yet" (and skip it silently, no error) when
    // neither of the two truly required fill-in fields — departure date and
    // price — has anything in it.
    const departureDateRaw = get("departure_date");
    const priceRaw = get("price");
    if ((departureDateRaw == null || departureDateRaw === "") && (priceRaw == null || priceRaw === "")) {
      return;
    }

    const fromAirport = String(get("from_airport") ?? "").trim().toUpperCase();
    const toAirport = String(get("to_airport") ?? "").trim().toUpperCase();
    const departureDate = excelDateToIso(departureDateRaw);
    const price = toNumberOrNull(priceRaw);
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

    // Extended (optional) fields — validated the same "skip silently if
    // blank, flag only if actually filled-in-but-wrong" way as the rest.
    const operatingAirlineCodeRaw = get("operating_airline_code");
    const operatingAirlineCode = operatingAirlineCodeRaw ? String(operatingAirlineCodeRaw).trim().toUpperCase() : null;
    if (operatingAirlineCode && !airlineCodes.has(operatingAirlineCode)) {
      rowErrors.push(`شركة الطيران المشغّلة "${operatingAirlineCode}" غير موجودة`);
    }

    const stopoverAirportRaw = get("stopover_airport");
    const stopoverAirport = stopoverAirportRaw ? String(stopoverAirportRaw).trim().toUpperCase() : null;
    if (stopoverAirport && !airportCodes.has(stopoverAirport)) {
      rowErrors.push(`مطار التوقف "${stopoverAirport}" غير موجود`);
    }

    const minMembershipTierRaw = String(get("min_membership_tier") ?? "free").trim();
    if (get("min_membership_tier") && !MEMBERSHIP_TIERS.includes(minMembershipTierRaw as "free" | "premium")) {
      rowErrors.push(`min_membership_tier "${minMembershipTierRaw}" غير صحيح (free/premium)`);
    }
    const minMembershipTier = (MEMBERSHIP_TIERS as readonly string[]).includes(minMembershipTierRaw)
      ? (minMembershipTierRaw as "free" | "premium")
      : "free";

    const tripTypesRaw = String(get("trip_types") ?? "").trim();
    const tripTypes = tripTypesRaw
      ? tripTypesRaw
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : [];
    const badTripTypes = tripTypes.filter((t) => !TRIP_TYPES.includes(t));
    if (badTripTypes.length > 0) rowErrors.push(`trip_types غير معروفة: ${badTripTypes.join(", ")}`);

    if (rowErrors.length > 0) {
      errors.push({ rowNumber, rowLabel, message: rowErrors.join("، ") });
      return;
    }

    rows.push({
      rowNumber,
      rowLabel,
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
        flightNumber: get("flight_number") ? String(get("flight_number")).trim() : null,
        aircraftType: get("aircraft_type") ? String(get("aircraft_type")).trim() : null,
        operatingAirlineCode,
        stopoverAirport,
        layoverMinutes: toNumberOrNull(get("layover_minutes")),
        arrivalDate: excelDateToIso(get("arrival_date")),
        flightDurationMinutes: toNumberOrNull(get("flight_duration_minutes")),
        fareFamily: get("fare_family") ? String(get("fare_family")).trim() : null,
        refundable: toBoolOrNull(get("refundable")),
        changeable: toBoolOrNull(get("changeable")),
        changeFee: toNumberOrNull(get("change_fee")),
        cancellationFee: toNumberOrNull(get("cancellation_fee")),
        checkedBagsCount: toNumberOrNull(get("checked_bags_count")),
        cabinBaggageKg: toNumberOrNull(get("cabin_baggage_kg")),
        extraBaggagePrice: toNumberOrNull(get("extra_baggage_price")),
        baseFare: toNumberOrNull(get("base_fare")),
        taxesFees: toNumberOrNull(get("taxes_fees")),
        minMembershipTier,
        tripTypes,
        isFeatured: toBoolOrNull(get("is_featured")) ?? false,
      },
    });
  });

  return { rows, errors };
}

/** Checks parsed rows against live deals already on the site — from this
 *  agency or any other — before the batch is ever inserted. Only `active`
 *  deals are checked: RLS only allows reading active rows in the first
 *  place, and a duplicate only matters once it's actually publicly live.
 *  Two match strengths: an exact flight_number match on the same route+date
 *  is treated as the same physical flight regardless of who listed it first;
 *  without a flight number, a same route+date+airline match is flagged as a
 *  softer "possible duplicate" since two agencies can legitimately sell the
 *  same route on the same day as different flights. Rows are annotated in
 *  place (mutates `rows`) rather than filtered — the agency decides in the
 *  preview whether to still import a flagged row. */
export async function annotateDuplicateDeals(rows: BulkImportRow[]): Promise<void> {
  if (rows.length === 0) return;

  const dates = Array.from(new Set(rows.map((r) => r.input.departureDate)));
  const fromAirports = Array.from(new Set(rows.map((r) => r.input.fromAirport)));
  const toAirports = Array.from(new Set(rows.map((r) => r.input.toAirport)));

  const { data, error } = await supabase
    .from("deals")
    .select("id,agency_id,from_airport,to_airport,departure_date,airline_code,flight_number,price,currency,agencies(name)")
    .eq("status", "active")
    .in("departure_date", dates)
    .in("from_airport", fromAirports)
    .in("to_airport", toAirports);

  if (error || !data) return; // Best-effort: a lookup failure shouldn't block import, just skip the warning.

  type ExistingDeal = {
    id: string;
    from_airport: string;
    to_airport: string;
    departure_date: string;
    airline_code: string | null;
    flight_number: string | null;
    price: number;
    currency: string | null;
    agencies: { name: string | null } | null;
  };
  const existing = data as unknown as ExistingDeal[];

  for (const row of rows) {
    const { fromAirport, toAirport, departureDate, airlineCode, flightNumber } = row.input;

    const byFlightNumber = flightNumber
      ? existing.find(
          (d) =>
            d.from_airport === fromAirport &&
            d.to_airport === toAirport &&
            d.departure_date === departureDate &&
            d.flight_number === flightNumber &&
            (!airlineCode || d.airline_code === airlineCode),
        )
      : null;

    const byRouteDate =
      !byFlightNumber && airlineCode
        ? existing.find(
            (d) =>
              d.from_airport === fromAirport &&
              d.to_airport === toAirport &&
              d.departure_date === departureDate &&
              d.airline_code === airlineCode,
          )
        : null;

    const match = byFlightNumber ?? byRouteDate;
    if (!match) {
      row.duplicate = null;
      continue;
    }
    row.duplicate = {
      existingDealId: match.id,
      agencyName: match.agencies?.name ?? null,
      price: match.price,
      currency: match.currency,
      matchedBy: byFlightNumber ? "flight_number" : "route_date",
    };
  }
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
      flight_number: input.flightNumber ?? null,
      aircraft_type: input.aircraftType ?? null,
      operating_airline_code: input.operatingAirlineCode ?? null,
      stopover_airport: input.stopoverAirport ?? null,
      layover_minutes: input.layoverMinutes ?? null,
      arrival_date: input.arrivalDate ?? null,
      flight_duration_minutes: input.flightDurationMinutes ?? null,
      fare_family: input.fareFamily ?? null,
      refundable: input.refundable ?? null,
      changeable: input.changeable ?? null,
      change_fee: input.changeFee ?? null,
      cancellation_fee: input.cancellationFee ?? null,
      checked_bags_count: input.checkedBagsCount ?? null,
      cabin_baggage_kg: input.cabinBaggageKg ?? null,
      extra_baggage_price: input.extraBaggagePrice ?? null,
      base_fare: input.baseFare ?? null,
      taxes_fees: input.taxesFees ?? null,
      min_membership_tier: input.minMembershipTier ?? "free",
      trip_types: input.tripTypes ?? [],
      is_featured: input.isFeatured ?? false,
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
      base_fare: input.baseFare ?? null,
      taxes_fees: input.taxesFees ?? null,
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
  if (patch.baseFare !== undefined) dbPatch.base_fare = patch.baseFare;
  if (patch.taxesFees !== undefined) dbPatch.taxes_fees = patch.taxesFees;
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

const TICKET_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const TICKET_MAX_BYTES = 8 * 1024 * 1024; // 8MB

/**
 * Uploads the real ticket file (PDF or image) to the `tickets` storage bucket
 * under this agency's own folder — the bucket's RLS policy only allows an
 * agency to write inside `${their agency_id}/...`, so this can't be used to
 * overwrite another agency's tickets. Returns the public URL to store on
 * bookings.ticket_url, same field the old "paste a link" flow used, so
 * nothing downstream (MyTripsPage, admin views) needs to change.
 */
export async function uploadTicketFile(agencyId: string, bookingId: string, file: File): Promise<string> {
  if (!TICKET_ALLOWED_TYPES.includes(file.type)) {
    throw new Error("الملف يجب أن يكون PDF أو صورة (JPG/PNG/WebP)");
  }
  if (file.size > TICKET_MAX_BYTES) {
    throw new Error("حجم الملف أكبر من 8 ميجابايت");
  }

  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `${agencyId}/${bookingId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("tickets")
    .upload(path, file, { contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from("tickets").getPublicUrl(path);
  return data.publicUrl;
}

const BOOKING_FULL_COLUMNS =
  "id,booking_number,deal_id,agency_id,customer_name,customer_phone,customer_email,notes,channel,payment_method,status,payment_proof_url,payment_ref,payment_at,ticket_url,handled_by,created_at,updated_at,unit_price,total_price,currency,adults_count,children_count,infants_count,travelers_count,fare_package_tier,fare_package_markup";

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

/** A single requested add-on service, joined with its booking + service name, for the agency confirmation queue. */
export type BookingServiceQueueRow = {
  id: string;
  booking_id: string;
  quantity: number;
  price: number;
  status: BookingServiceStatus;
  updated_at: string;
  service: { name: string; type: string } | null;
  booking: { booking_number: number; customer_name: string; customer_phone: string } | null;
};

/**
 * Requested add-on services (seat selection, extra baggage, transfers, etc)
 * for this agency's bookings, most-recently-updated first. Pass a status to
 * filter (e.g. the "pending_confirmation" queue); omit for the full history.
 */
export async function fetchAgencyBookingServices(
  agencyId: string,
  status?: BookingServiceStatus,
): Promise<BookingServiceQueueRow[]> {
  let query = supabase
    .from("booking_services")
    .select(
      "id,booking_id,quantity,price,status,updated_at,service:additional_services(name,type),booking:bookings!inner(booking_number,customer_name,customer_phone,agency_id)",
    )
    .eq("booking.agency_id", agencyId)
    .order("updated_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BookingServiceQueueRow[];
}

/** Marks a booking's requested service as confirmed/failed/refunded with the airline or provider. */
export async function updateBookingServiceStatus(
  bookingServiceId: string,
  status: BookingServiceStatus,
): Promise<void> {
  const { error } = await supabase
    .from("booking_services")
    .update({ status } as never)
    .eq("id", bookingServiceId);
  if (error) throw new Error(error.message);
}

export type AgencyReviewRowFull = Tables<"agency_reviews">;
