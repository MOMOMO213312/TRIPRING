import { getCurrentUser } from "./auth";
import { PLATFORM_WHATSAPP } from "./constants";
import { supabase } from "./supabase";
import type {
  AdditionalServiceRow,
  AgencyRow,
  AirlineRow,
  AirportRow,
  BookingLookupResult,
  BookingServiceInput,
  BookingTravelerInput,
  Database,
  DealPriceHistoryRow,
  DealRow,
  DealType,
  ImageCacheRow,
  PaymentMethod,
  ResaleReason,
  RoutePriceReferenceRow,
  ServiceRequestRow,
  Tables,
} from "../types/database";

export type AgencyReviewRow = Tables<"agency_reviews">;
export type TicketResaleRow = Tables<"ticket_resales">;

/** Shape actually returned by the public/anonymous resale listing — excludes
 * passenger_name and pnr_reference, which are only safe to expose to the
 * seller/admin (see TICKET_RESALE_COLUMNS below). */
export type PublicTicketResaleRow = Omit<TicketResaleRow, "passenger_name" | "pnr_reference">;

export const DEAL_COLUMNS =
  "id,agency_id,deal_type,airline_code,from_airport,to_airport,departure_date,departure_time,return_date,arrival_time,flight_duration_minutes,duration_hours,stops,stopover_airport,baggage_kg,travel_class,price,original_price,child_price,infant_price,available_seats,is_featured,status,expires_at,currency,notes,deal_score,view_count,min_membership_tier,fare_family,refundable,changeable,change_fee,cancellation_fee,fare_rules,base_fare,taxes_fees,price_checked_at,flight_number,aircraft_type,operating_airline_code,arrival_date,layover_minutes,cabin_baggage_kg,checked_bags_count,extra_baggage_price" as const;

/** Anonymous/guest-facing feeds only show free-tier deals until membership auth exists. */
export const PUBLIC_MEMBERSHIP_TIER = "free" as const;

export type TripType = "round_trip" | "one_way";

export type DealSearchParams = {
  from?: string;
  to?: string;
  /** Destination-region entry point (e.g. all Saudi airports) — matches any
   *  code in the list. Takes precedence over `to` when both are set, so
   *  picking a region and a specific airport never silently conflict. */
  toAirports?: string[];
  departureDate?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "price_asc" | "price_desc";
  dealType?: DealType | "any";
  availableOnly?: boolean;
  /** one_way → only deals with no return_date; round_trip → only deals WITH a
   *  return_date. */
  tripType?: TripType;
  /** Zero-based page index. Combined with pageSize to page results server-side
   *  via Supabase's .range(), so large result sets don't rely on (and get
   *  silently truncated by) PostgREST's default 1000-row cap. Omit both to
   *  get the old "fetch everything matching" behaviour. */
  page?: number;
  pageSize?: number;
};

export type DealSearchResult = {
  deals: DealRow[];
  /** Total rows matching the filters server-side (via Supabase's exact
   *  count), independent of how many were actually returned for this page. */
  total: number;
};

export type CreateBookingInput = {
  dealId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  adultsCount: number;
  childrenCount: number;
  infantsCount: number;
  paymentMethod: PaymentMethod;
  travelers: BookingTravelerInput[];
  services: BookingServiceInput[];
  /** Basic/Smart/Premium fare tier id from lib/packages.ts (PackageTier), if the
   *  customer picked one. The server looks up the markup% itself from
   *  fare_package_tiers and charges that — this is only which tier was chosen. */
  farePackageTier?: string | null;
};

export type CreateBookingResult = {
  booking_number: string;
  total_price: number;
  currency: string;
  status: string;
};

export type MarketStats = {
  activeDealsCount: number;
  priceDropCount: number;
  endingSoonCount: number;
  mostViewedRoute: { from: string; to: string; views: number } | null;
};

export type PriceTrendPoint = {
  date: string;
  price: number;
};

export async function fetchAirports(): Promise<AirportRow[]> {
  const { data, error } = await supabase
    .from("airports")
    .select("code,city,country,name,city_en")
    .order("city", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAirlines(): Promise<AirlineRow[]> {
  const { data, error } = await supabase
    .from("airlines")
    .select("code,name,logo_url")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAgencies(): Promise<AgencyRow[]> {
  const { data, error } = await supabase
    .from("agencies")
    .select("id,name,phone,email,whatsapp,logo_url,commission_rate");
  if (error) return [];
  return data ?? [];
}

export async function fetchRoutePriceReferences(): Promise<RoutePriceReferenceRow[]> {
  const { data, error } = await supabase
    .from("route_price_reference")
    .select("id,from_airport,to_airport,flight_type,min_price_usd,max_price_usd,notes,updated_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchImageCache(): Promise<ImageCacheRow[]> {
  const { data, error } = await supabase
    .from("image_cache")
    .select("id,keyword,image_url,source,fetched_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

function buildActiveDealsQuery(params: DealSearchParams, withCount: boolean) {
  let query = supabase
    .from("deals")
    .select(DEAL_COLUMNS, withCount ? { count: "exact" } : undefined)
    .eq("status", "active")
    .eq("min_membership_tier", PUBLIC_MEMBERSHIP_TIER)
    .gt("expires_at", new Date().toISOString());

  if (params.from) query = query.eq("from_airport", params.from);
  if (params.toAirports?.length) query = query.in("to_airport", params.toAirports);
  else if (params.to) query = query.eq("to_airport", params.to);
  if (params.departureDate) query = query.eq("departure_date", params.departureDate);
  if (params.minPrice != null) query = query.gte("price", params.minPrice);
  if (params.maxPrice != null) query = query.lte("price", params.maxPrice);
  if (params.dealType && params.dealType !== "any") query = query.eq("deal_type", params.dealType);
  // Filtered server-side (rather than with a post-fetch .filter() in JS) so
  // pagination/.range() and the returned "total" count are both accurate —
  // a client-side filter after a page has already been cut down by
  // .range() would silently drop rows instead of reflecting the true total.
  if (params.availableOnly) query = query.gt("available_seats", 0);
  if (params.tripType === "one_way") query = query.is("return_date", null);
  else if (params.tripType === "round_trip") query = query.not("return_date", "is", null);

  switch (params.sort) {
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "price_asc":
    default:
      query = query.order("price", { ascending: true });
      break;
  }

  if (params.page != null && params.pageSize != null) {
    const from = params.page * params.pageSize;
    const to = from + params.pageSize - 1;
    query = query.range(from, to);
  }

  return query;
}

export async function fetchActiveDeals(params: DealSearchParams = {}): Promise<DealRow[]> {
  const { data, error } = await buildActiveDealsQuery(params, false);
  if (error) throw new Error(error.message);
  return (data ?? []) as DealRow[];
}

/** Paginated variant for listing pages with a "load more" / page control —
 *  returns the true total match count alongside just this page's rows, so
 *  the UI can show "X من Y" and know when it's fetched everything instead
 *  of guessing from PostgREST's default 1000-row response cap. */
export async function fetchActiveDealsPage(
  params: DealSearchParams & { page: number; pageSize: number },
): Promise<DealSearchResult> {
  const { data, error, count } = await buildActiveDealsQuery(params, true);
  if (error) throw new Error(error.message);
  return { deals: (data ?? []) as DealRow[], total: count ?? (data ?? []).length };
}

/** Real min/max active price, used to size the DealsCenterPage price slider — never a hardcoded guess. */
export async function fetchActivePriceBounds(): Promise<{ min: number; max: number }> {
  const base = () =>
    supabase
      .from("deals")
      .select("price")
      .eq("status", "active")
      .eq("min_membership_tier", PUBLIC_MEMBERSHIP_TIER)
      .gt("expires_at", new Date().toISOString())
      .gt("available_seats", 0);

  const [{ data: lowest }, { data: highest }] = await Promise.all([
    base().order("price", { ascending: true }).limit(1),
    base().order("price", { ascending: false }).limit(1),
  ]);
  const lowestRow = (lowest as { price: number }[] | null)?.[0];
  const highestRow = (highest as { price: number }[] | null)?.[0];
  return {
    min: lowestRow ? Math.floor(lowestRow.price) : 0,
    max: highestRow ? Math.ceil(highestRow.price) : 1000,
  };
}

export async function fetchBestOpportunities(limit = 12): Promise<DealRow[]> {
  const deals = await fetchActiveDeals({ sort: "price_asc", availableOnly: true });
  return deals.slice(0, limit);
}

export async function fetchDealById(id: string): Promise<DealRow | null> {
  const { data, error } = await supabase
    .from("deals")
    .select(DEAL_COLUMNS)
    .eq("id", id)
    .eq("status", "active")
    .eq("min_membership_tier", PUBLIC_MEMBERSHIP_TIER)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function fetchDealPriceHistory(dealId: string): Promise<DealPriceHistoryRow[]> {
  const { data, error } = await supabase
    .from("deal_price_history")
    .select("id,deal_id,old_price,new_price,changed_at")
    .eq("deal_id", dealId)
    .order("changed_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Bulk price-drop lookup for a set of deals (one query instead of one per
 * card) — used by DealsCenterPage's grid to show a real "price dropped X%"
 * note only where deal_price_history actually shows a drop. Compares each
 * deal's earliest and latest recorded price within the last 7 days; never
 * invents a percentage for deals with no history.
 */
export async function fetchDealPriceDrops(
  dealIds: string[],
): Promise<Map<string, { percent: number; amount: number }>> {
  const drops = new Map<string, { percent: number; amount: number }>();
  if (!dealIds.length) return drops;

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from("deal_price_history")
    .select("deal_id,old_price,new_price,changed_at")
    .in("deal_id", dealIds)
    .gte("changed_at", since)
    .order("changed_at", { ascending: true });
  if (error || !data) return drops;

  const rows = data as { deal_id: string; old_price: number; new_price: number; changed_at: string }[];
  const byDeal = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byDeal.get(row.deal_id) ?? [];
    list.push(row);
    byDeal.set(row.deal_id, list);
  }

  for (const [dealId, list] of byDeal) {
    const earliest = list[0].old_price;
    const latest = list[list.length - 1].new_price;
    if (earliest > latest) {
      drops.set(dealId, {
        percent: Math.round(((earliest - latest) / earliest) * 100),
        amount: Math.round(earliest - latest),
      });
    }
  }
  return drops;
}

export async function fetchAdditionalServices(): Promise<AdditionalServiceRow[]> {
  const { data, error } = await supabase
    .from("additional_services")
    .select("id,type,name,description,price,category,is_active")
    .eq("is_active", true)
    .order("price", { ascending: true });
  if (error) return [];
  return data ?? [];
}

/**
 * Live fare-bundle tiers (تذكرة فقط / Smart Trip / Premium Trip) from `fare_package_tiers`.
 * This is the source of truth for markup_percent — never hardcode pricing in the frontend.
 */
export async function fetchFarePackageTiers(): Promise<Tables<"fare_package_tiers">[]> {
  const { data, error } = await supabase
    .from("fare_package_tiers")
    .select("tier,label,markup_percent,is_active,sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export interface CreateServiceRequestInput {
  serviceId: string;
  serviceType: string;
  serviceName: string;
  unitPrice: number;
  quantity: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  airline?: string | null;
  flightNumber?: string | null;
  flightDate?: string | null;
  arrivalTime?: string | null;
  airport?: string | null;
  destination?: string | null;
  notes?: string | null;
}

/**
 * Requests a standalone service (transfer/lounge/baggage/destination experience, etc.)
 * independently of any TripRing deal or booking — the customer may have bought their
 * ticket elsewhere and only needs the service itself.
 */
export async function createServiceRequest(
  input: CreateServiceRequestInput,
): Promise<ServiceRequestRow> {
  const totalPrice = Math.round(input.unitPrice * input.quantity * 100) / 100;
  const { data, error } = await supabase
    .from("service_requests")
    .insert([{
      service_id: input.serviceId,
      service_type: input.serviceType,
      service_name: input.serviceName,
      unit_price: input.unitPrice,
      quantity: input.quantity,
      currency: "USD",
      total_price: totalPrice,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.customerEmail ?? null,
      airline: input.airline ?? null,
      flight_number: input.flightNumber ?? null,
      flight_date: input.flightDate ?? null,
      arrival_time: input.arrivalTime ?? null,
      airport: input.airport ?? null,
      destination: input.destination ?? null,
      notes: input.notes ?? null,
    }] as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ServiceRequestRow;
}

export async function fetchMarketStats(): Promise<MarketStats> {
  const deals = await fetchActiveDeals({ sort: "price_asc" });
  const activeDealsCount = deals.length;

  const endingSoonCount = deals.filter((d) => {
    const hours = (new Date(d.expires_at).getTime() - Date.now()) / 3_600_000;
    return hours > 0 && hours <= 48;
  }).length;

  const routeViews = new Map<string, { from: string; to: string; views: number }>();
  for (const d of deals) {
    const key = `${d.from_airport}-${d.to_airport}`;
    const entry = routeViews.get(key) ?? { from: d.from_airport, to: d.to_airport, views: 0 };
    entry.views += d.view_count ?? 0;
    routeViews.set(key, entry);
  }
  const sortedRoutes = [...routeViews.values()].sort((a, b) => b.views - a.views);
  const mostViewedRoute =
    sortedRoutes[0] && sortedRoutes[0].views > 0 ? sortedRoutes[0] : null;

  const dealIds = deals.map((d) => d.id);
  let priceDropCount = 0;
  if (dealIds.length) {
    const { data: history, error } = await supabase
      .from("deal_price_history")
      .select("deal_id,old_price,new_price")
      .in("deal_id", dealIds);
    if (!error && history) {
      const rows = history as { deal_id: string; old_price: number; new_price: number }[];
      const dropped = new Set(rows.filter((h) => h.new_price < h.old_price).map((h) => h.deal_id));
      priceDropCount = dropped.size;
    }
  }

  return { activeDealsCount, priceDropCount, endingSoonCount, mostViewedRoute };
}

export async function fetchRoutePriceTrend(
  fromAirport: string,
  toAirport: string,
): Promise<PriceTrendPoint[]> {
  const deals = await fetchActiveDeals({ from: fromAirport, to: toAirport });
  const dealIds = deals.map((d) => d.id);
  const points: PriceTrendPoint[] = [];

  if (dealIds.length) {
    const { data: history, error } = await supabase
      .from("deal_price_history")
      .select("new_price,changed_at")
      .in("deal_id", dealIds)
      .order("changed_at", { ascending: true });
    if (!error && history) {
      const rows = history as { new_price: number; changed_at: string }[];
      for (const row of rows) {
        points.push({
          date: row.changed_at.slice(0, 10),
          price: row.new_price,
        });
      }
    }
  }

  if (deals.length) {
    const lowest = Math.min(...deals.map((d) => d.price));
    points.push({ date: new Date().toISOString().slice(0, 10), price: lowest });
  }

  const byDate = new Map<string, number>();
  for (const p of points) {
    const existing = byDate.get(p.date);
    if (existing == null || p.price < existing) byDate.set(p.date, p.price);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, price]) => ({ date, price }));
}

export type RouteDatePrice = { date: string; price: number; dealId: string };

/**
 * Flexible Dates data source. Deliberately does NOT invent a full calendar —
 * it only returns dates where a real active deal exists on this route today
 * (deals are entered manually off Amadeus, so there's no live per-day
 * availability to query). Cheapest deal wins when a date has more than one.
 */
export async function fetchRouteDatePrices(fromAirport: string, toAirport: string): Promise<RouteDatePrice[]> {
  const deals = await fetchActiveDeals({ from: fromAirport, to: toAirport, availableOnly: true });
  const byDate = new Map<string, RouteDatePrice>();
  for (const d of deals) {
    const existing = byDate.get(d.departure_date);
    if (!existing || d.price < existing.price) {
      byDate.set(d.departure_date, {
        date: d.departure_date,
        price: d.price,
        dealId: d.id,
      });
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  type RpcArgs = Database["public"]["Functions"]["create_booking"]["Args"];
  // NOTE: the generated types/database.ts still calls this field
  // "passport_number", but the live create_booking() SQL function (and the
  // booking_travelers.passport_no column it inserts into) reads the JSON key
  // "passport_no". Left as-is, every passport number a customer types is
  // silently dropped — remap it here so the RPC actually receives it.
  const travelers = input.travelers.map((t) => ({
    full_name: t.full_name,
    date_of_birth: t.date_of_birth,
    nationality: t.nationality,
    traveler_type: t.traveler_type,
    passport_no: t.passport_number,
  }));
  const args: RpcArgs = {
    p_deal_id: input.dealId,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_customer_email: input.customerEmail ?? null,
    p_adults_count: input.adultsCount,
    p_children_count: input.childrenCount,
    p_infants_count: input.infantsCount,
    p_channel: "web",
    p_payment_method: input.paymentMethod,
    p_travelers: travelers as never,
    p_services: input.services,
    p_fare_package_tier: input.farePackageTier ?? null,
  };
  const { data, error } = await supabase.rpc("create_booking", args as never);
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as CreateBookingResult | undefined;
  if (!row?.booking_number) throw new Error("لم يتم إنشاء الحجز");
  return { ...row, booking_number: String(row.booking_number) };
}

export async function lookupBooking(
  bookingNumber: string,
  contact: string,
): Promise<BookingLookupResult | null> {
  const num = parseInt(bookingNumber.replace(/\D/g, ""), 10);
  if (Number.isNaN(num)) throw new Error("رقم الحجز غير صالح");
  const { data, error } = await supabase.rpc("lookup_booking", {
    p_booking_number: num,
    p_contact: contact.trim(),
  } as never);
  if (error) throw new Error(error.message);
  return (data as BookingLookupResult | null) ?? null;
}

const PAYMENT_PROOF_MAX_BYTES = 5 * 1024 * 1024;
const PAYMENT_PROOF_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/**
 * Uploads a payment proof file (receipt screenshot/PDF) to storage and links
 * it to the booking. The upload alone doesn't touch any booking row — only
 * the RPC does, and it re-validates booking_number + phone/email the same
 * way lookup_booking() does, so this can't be used to tamper with someone
 * else's booking.
 */
export async function uploadPaymentProof(
  bookingNumber: string,
  contact: string,
  file: File,
): Promise<{ status: string }> {
  const num = parseInt(bookingNumber.replace(/\D/g, ""), 10);
  if (Number.isNaN(num)) throw new Error("رقم الحجز غير صالح");
  if (!PAYMENT_PROOF_ALLOWED_TYPES.includes(file.type)) {
    throw new Error("الملف يجب أن يكون صورة (JPG/PNG/WebP) أو PDF");
  }
  if (file.size > PAYMENT_PROOF_MAX_BYTES) {
    throw new Error("حجم الملف أكبر من 5 ميجابايت");
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${num}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("payment-proofs")
    .upload(path, file, { contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { data: publicUrlData } = supabase.storage.from("payment-proofs").getPublicUrl(path);

  const { data, error } = await supabase.rpc("submit_payment_proof", {
    p_booking_number: num,
    p_contact: contact.trim(),
    p_proof_url: publicUrlData.publicUrl,
  } as never);
  if (error) throw new Error(error.message);
  return data as { status: string };
}

export async function lookupPriceAlerts(contact: string): Promise<Tables<"price_alerts">[]> {
  const { data, error } = await supabase.rpc("lookup_price_alerts", {
    p_contact: contact.trim(),
  } as never);
  if (error) throw new Error(error.message);
  return (data ?? []) as Tables<"price_alerts">[];
}

export async function createPriceAlert(input: {
  fromAirport: string;
  toAirport: string;
  maxBudget: number;
  email?: string;
  phone?: string;
  dealId?: string;
}): Promise<void> {
  const { error } = await supabase.from("price_alerts").insert([
    {
      from_airport: input.fromAirport,
      to_airport: input.toAirport,
      max_budget: input.maxBudget,
      email: input.email ?? null,
      phone: input.phone ?? null,
      deal_id: input.dealId ?? null,
    },
  ] as never);
  if (error) throw new Error(error.message);
}

export async function fetchAgencyReviews(agencyId: string): Promise<AgencyReviewRow[]> {
  const { data, error } = await supabase
    .from("agency_reviews")
    .select("id,agency_id,booking_id,customer_id,rating,comment,created_at")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type AgencyRatingSummary = { average: number | null; count: number };

export function summarizeAgencyRating(reviews: AgencyReviewRow[]): AgencyRatingSummary {
  if (reviews.length === 0) return { average: null, count: 0 };
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return { average: Math.round((total / reviews.length) * 10) / 10, count: reviews.length };
}

/** Requires a signed-in user — RLS ties every review to `customer_id = auth.uid()`. */
export async function createAgencyReview(input: {
  agencyId: string;
  rating: number;
  comment?: string;
}): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("سجّل الدخول أولاً لإرسال تقييم");
  const { error } = await supabase.from("agency_reviews").insert([
    {
      agency_id: input.agencyId,
      customer_id: user.id,
      rating: input.rating,
      comment: input.comment?.trim() || null,
    },
  ] as never);
  if (error) throw new Error(error.message);
}

export type TicketResaleSearchParams = {
  from?: string;
  to?: string;
};

// Public columns only — deliberately excludes passenger_name and pnr_reference,
// since either one is enough for a stranger to manage/cancel the seller's
// booking directly on the airline's site. Those stay restricted to the admin
// query in lib/admin.ts.
const TICKET_RESALE_COLUMNS =
  "id,seller_customer_id,airline_code,from_airport,to_airport,departure_date,return_date,reason,original_price,asking_price,currency,status,created_at";

/** Public browsing — only rows verified and published for sale are visible to anonymous users (per RLS). */
export async function fetchActiveTicketResales(
  params: TicketResaleSearchParams = {},
): Promise<PublicTicketResaleRow[]> {
  let query = supabase
    .from("ticket_resales")
    .select(TICKET_RESALE_COLUMNS)
    .eq("status", "listed" satisfies Database["public"]["Enums"]["resale_status"])
    .order("departure_date", { ascending: true });

  if (params.from) query = query.eq("from_airport", params.from);
  if (params.to) query = query.eq("to_airport", params.to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Requires a signed-in user — RLS ties every listing to `seller_customer_id = auth.uid()`. */
export async function createTicketResale(input: {
  airlineCode?: string;
  fromAirport: string;
  toAirport: string;
  departureDate: string;
  returnDate?: string;
  passengerName: string;
  pnrReference: string;
  reason: ResaleReason;
  originalPrice: number;
  askingPrice: number;
  currency?: string;
}): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("سجّل الدخول أولاً لعرض تذكرتك");
  const { error } = await supabase.from("ticket_resales").insert([
    {
      seller_customer_id: user.id,
      airline_code: input.airlineCode || null,
      from_airport: input.fromAirport,
      to_airport: input.toAirport,
      departure_date: input.departureDate,
      return_date: input.returnDate || null,
      passenger_name: input.passengerName,
      pnr_reference: input.pnrReference,
      reason: input.reason,
      original_price: input.originalPrice,
      asking_price: input.askingPrice,
      currency: input.currency || "USD",
      status: "submitted" satisfies Database["public"]["Enums"]["resale_status"],
    },
  ] as never);
  if (error) throw new Error(error.message);
}

function seededPick<T>(items: T[], seed: string): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return items[hash % items.length];
}

export function getDestinationImage(
  airport: AirportRow | undefined,
  imageCache: ImageCacheRow[],
  seed?: string,
): string | null {
  if (!airport?.city_en) return null;
  const keyword = airport.city_en.toLowerCase().trim();
  const matches = imageCache.filter(
    (img) =>
      img.keyword === keyword ||
      img.keyword === keyword.replace(/\s+/g, "-") ||
      keyword.includes(img.keyword) ||
      img.keyword.includes(keyword.split(" ")[0] ?? ""),
  );
  if (matches.length === 0) return null;
  const chosen = seed ? seededPick(matches, seed) : matches[0];
  return chosen.image_url ?? null;
}

export function getAgencyWhatsApp(deal: DealRow, agencies: AgencyRow[]): string {
  const agency = agencies.find((a) => a.id === deal.agency_id);
  return agency?.whatsapp ?? agency?.phone ?? PLATFORM_WHATSAPP;
}
