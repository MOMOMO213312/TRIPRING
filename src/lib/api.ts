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
  Tables,
} from "../types/database";

export type AgencyReviewRow = Tables<"agency_reviews">;
export type TicketResaleRow = Tables<"ticket_resales">;

export const DEAL_COLUMNS =
  "id,agency_id,deal_type,airline_code,from_airport,to_airport,departure_date,departure_time,return_date,arrival_time,flight_duration_minutes,duration_hours,stops,stopover_airport,baggage_kg,travel_class,price,original_price,child_price,infant_price,available_seats,is_featured,status,expires_at,currency,notes,deal_score,view_count,min_membership_tier" as const;

/** Anonymous/guest-facing feeds only show free-tier deals until membership auth exists. */
export const PUBLIC_MEMBERSHIP_TIER = "free" as const;

export type DealSearchParams = {
  from?: string;
  to?: string;
  departureDate?: string;
  maxPrice?: number;
  sort?: "price_asc" | "price_desc" | "deal_score";
  dealType?: DealType | "any";
  availableOnly?: boolean;
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
};

export type CreateBookingResult = {
  booking_number: string;
  total_price: number;
  currency: string;
  status: string;
};

export type MarketStats = {
  topDealScore: number | null;
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

export async function fetchActiveDeals(params: DealSearchParams = {}): Promise<DealRow[]> {
  let query = supabase
    .from("deals")
    .select(DEAL_COLUMNS)
    .eq("status", "active")
    .eq("min_membership_tier", PUBLIC_MEMBERSHIP_TIER)
    .gt("expires_at", new Date().toISOString());

  if (params.from) query = query.eq("from_airport", params.from);
  if (params.to) query = query.eq("to_airport", params.to);
  if (params.departureDate) query = query.eq("departure_date", params.departureDate);
  if (params.maxPrice != null) query = query.lte("price", params.maxPrice);
  if (params.dealType && params.dealType !== "any") query = query.eq("deal_type", params.dealType);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let deals = (data ?? []) as DealRow[];

  if (params.availableOnly) {
    deals = deals.filter((d) => d.available_seats > 0);
  }

  switch (params.sort) {
    case "price_desc":
      deals = [...deals].sort((a, b) => b.price - a.price);
      break;
    case "deal_score":
      deals = [...deals].sort((a, b) => (b.deal_score ?? 0) - (a.deal_score ?? 0));
      break;
    case "price_asc":
    default:
      deals = [...deals].sort((a, b) => a.price - b.price);
      break;
  }

  return deals;
}

export async function fetchBestOpportunities(limit = 12): Promise<DealRow[]> {
  const deals = await fetchActiveDeals({ sort: "deal_score", availableOnly: true });
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

export async function fetchAdditionalServices(): Promise<AdditionalServiceRow[]> {
  const { data, error } = await supabase
    .from("additional_services")
    .select("id,type,price")
    .order("price", { ascending: true });
  if (error) return [];
  return data ?? [];
}

export async function fetchMarketStats(): Promise<MarketStats> {
  const deals = await fetchActiveDeals({ sort: "deal_score" });
  const topDealScore = deals.reduce<number | null>(
    (max, d) => (d.deal_score != null && (max == null || d.deal_score > max) ? d.deal_score : max),
    null,
  );

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

  return { topDealScore, priceDropCount, endingSoonCount, mostViewedRoute };
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

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  type RpcArgs = Database["public"]["Functions"]["create_booking"]["Args"];
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
    p_travelers: input.travelers,
    p_services: input.services,
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
      customer_email: input.email ?? null,
      customer_phone: input.phone ?? null,
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

const TICKET_RESALE_COLUMNS =
  "id,seller_customer_id,airline_code,from_airport,to_airport,departure_date,return_date,passenger_name,pnr_reference,reason,original_price,asking_price,currency,status,created_at";

/** Public browsing — only rows verified and published for sale are visible to anonymous users (per RLS). */
export async function fetchActiveTicketResales(
  params: TicketResaleSearchParams = {},
): Promise<TicketResaleRow[]> {
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

export function getTypicalPrice(
  deal: DealRow,
  references: RoutePriceReferenceRow[],
): number | null {
  const ref = references.find(
    (r) => r.from_airport === deal.from_airport && r.to_airport === deal.to_airport,
  );
  if (ref) return Math.round((ref.min_price_usd + ref.max_price_usd) / 2);
  return deal.original_price;
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
