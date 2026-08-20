/**
 * Generated from live Supabase schema (hhvsrerxkpqkkydaztvw) via client introspection.
 * Re-run introspection if backend columns change — do not hand-edit column names.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type DealType = "flash" | "last_minute" | "empty_seat" | "special_fare";
export type DealStatus = "draft" | "active" | "expired" | "sold_out" | "cancelled";
export type StopType = "direct" | "one_stop" | "multi_stop";
export type PaymentMethod = "bank_transfer" | "instapay" | "vodafone_cash";
export type BookingChannel = "web" | "whatsapp";
export type BookingStatus =
  | "new"
  | "contacted"
  | "awaiting_payment"
  | "payment_uploaded"
  | "paid"
  | "ticket_issued"
  | "cancelled";
export type MembershipTier = "free" | "premium";
export type ResaleStatus =
  | "submitted"
  | "under_review"
  | "verified"
  | "rejected"
  | "listed"
  | "reserved"
  | "sold"
  | "expired"
  | "cancelled"
  | "converted_to_deal";
export type ResaleReason =
  | "non_refundable"
  | "trip_cancelled"
  | "date_change"
  | "duplicate_booking"
  | "other";
export type AppRole = "customer" | "agency" | "admin";

export interface Database {
  public: {
    Tables: {
      deals: {
        Row: {
          id: string;
          agency_id: string | null;
          deal_type: DealType;
          airline_code: string | null;
          from_airport: string;
          to_airport: string;
          departure_date: string;
          departure_time: string | null;
          return_date: string | null;
          arrival_time: string | null;
          flight_duration_minutes: number | null;
          stops: StopType;
          stopover_airport: string | null;
          baggage_kg: number | null;
          travel_class: string | null;
          price: number;
          original_price: number | null;
          child_price: number | null;
          infant_price: number | null;
          available_seats: number;
          is_featured: boolean | null;
          status: DealStatus;
          duration_hours: number | null;
          expires_at: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          trip_types: string[] | null;
          currency: string | null;
          deal_score: number | null;
          view_count: number | null;
          click_count: number | null;
          favorite_count: number | null;
          booking_count: number | null;
          search_vector: string | null;
          sale_event_id: string | null;
          min_membership_tier: MembershipTier;
        };
        Insert: Partial<Database["public"]["Tables"]["deals"]["Row"]> & {
          from_airport: string;
          to_airport: string;
          departure_date: string;
          price: number;
          available_seats: number;
          status: DealStatus;
          expires_at: string;
          deal_type: DealType;
        };
        Update: Partial<Database["public"]["Tables"]["deals"]["Row"]>;
      };
      airports: {
        Row: {
          code: string;
          city: string;
          country: string;
          name: string;
          city_en: string | null;
        };
        Insert: Database["public"]["Tables"]["airports"]["Row"];
        Update: Partial<Database["public"]["Tables"]["airports"]["Row"]>;
      };
      airlines: {
        Row: {
          code: string;
          name: string;
          logo_url: string | null;
          allows_name_change: boolean | null;
          name_change_fee_usd: number | null;
          name_change_max_hours_before_departure: number | null;
          name_change_notes: string | null;
          name_change_verified_at: string | null;
        };
        Insert: Pick<Database["public"]["Tables"]["airlines"]["Row"], "code" | "name"> &
          Partial<Database["public"]["Tables"]["airlines"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["airlines"]["Row"]>;
      };
      route_price_reference: {
        Row: {
          id: string;
          from_airport: string;
          to_airport: string;
          flight_type: string | null;
          min_price_usd: number;
          max_price_usd: number;
          notes: string | null;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["route_price_reference"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["route_price_reference"]["Row"]>;
      };
      route_price_calendar: {
        Row: {
          id: string;
          from_airport: string;
          to_airport: string;
          travel_date: string;
          lowest_price: number;
          deal_id: string | null;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["route_price_calendar"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["route_price_calendar"]["Row"]>;
      };
      deal_price_history: {
        Row: {
          id: string;
          deal_id: string;
          old_price: number;
          new_price: number;
          changed_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["deal_price_history"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["deal_price_history"]["Row"]>;
      };
      image_cache: {
        Row: {
          id: string;
          keyword: string;
          image_url: string;
          source: string | null;
          fetched_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["image_cache"]["Row"], "id"> & { id?: string };
        Update: Partial<Database["public"]["Tables"]["image_cache"]["Row"]>;
      };
      agencies: {
        Row: {
          id: string;
          name: string;
          phone: string | null;
          email: string | null;
          whatsapp: string | null;
          logo_url: string | null;
          is_active: boolean | null;
          created_at: string;
          commission_rate: number | null;
        };
        Insert: Omit<Database["public"]["Tables"]["agencies"]["Row"], "created_at"> & {
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["agencies"]["Row"]>;
      };
      affiliates: {
        Row: {
          id: string;
          profile_id: string;
          referral_code: string;
          tier: "bronze" | "silver" | "gold";
          commission_rate: number;
          is_active: boolean;
          total_referred_bookings: number;
          total_earned: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["affiliates"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["affiliates"]["Row"]>;
      };
      additional_services: {
        Row: {
          id: string;
          type: string;
          price: number;
        };
        Insert: Omit<Database["public"]["Tables"]["additional_services"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["additional_services"]["Row"]>;
      };
      bookings: {
        Row: {
          id: string;
          booking_number: number;
          deal_id: string;
          agency_id: string;
          customer_id: string | null;
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
          notes: string | null;
          channel: BookingChannel;
          payment_method: PaymentMethod | null;
          status: BookingStatus;
          payment_proof_url: string | null;
          payment_ref: string | null;
          payment_at: string | null;
          ticket_url: string | null;
          handled_by: string | null;
          created_at: string;
          updated_at: string;
          unit_price: number | null;
          total_price: number | null;
          currency: string | null;
          adults_count: number;
          children_count: number;
          infants_count: number;
          travelers_count: number | null;
          referred_by_affiliate_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["bookings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["bookings"]["Row"]>;
      };
      booking_travelers: {
        Row: {
          id: string;
          booking_id: string;
          full_name: string;
          date_of_birth: string | null;
          passport_number: string | null;
          nationality: string | null;
          traveler_type: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["booking_travelers"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["booking_travelers"]["Row"]>;
      };
      booking_services: {
        Row: {
          id: string;
          booking_id: string;
          service_id: string;
          quantity: number | null;
          unit_price: number | null;
        };
        Insert: Omit<Database["public"]["Tables"]["booking_services"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["booking_services"]["Row"]>;
      };
      price_alerts: {
        Row: {
          id: string;
          from_airport: string;
          to_airport: string;
          max_budget: number;
          customer_email: string | null;
          customer_phone: string | null;
          deal_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["price_alerts"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["price_alerts"]["Row"]>;
      };
      saved_searches: {
        Row: {
          id: string;
          from_airport: string | null;
          to_airport: string | null;
          departure_date: string | null;
          customer_phone: string | null;
          customer_email: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["saved_searches"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["saved_searches"]["Row"]>;
      };
      ticket_resales: {
        Row: {
          id: string;
          seller_customer_id: string;
          airline_code: string | null;
          from_airport: string;
          to_airport: string;
          departure_date: string;
          return_date: string | null;
          passenger_name: string;
          pnr_reference: string;
          ticket_document_url: string | null;
          reason: ResaleReason;
          original_price: number;
          asking_price: number;
          currency: string;
          status: ResaleStatus;
          verified_by: string | null;
          verification_notes: string | null;
          buyer_customer_id: string | null;
          sold_at: string | null;
          created_at: string;
          updated_at: string;
          buyer_name: string | null;
          buyer_phone: string | null;
          converted_deal_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["ticket_resales"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["ticket_resales"]["Row"]>;
      };
      agency_reviews: {
        Row: {
          id: string;
          agency_id: string;
          booking_id: string | null;
          customer_id: string | null;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["agency_reviews"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["agency_reviews"]["Row"]>;
      };
      profiles: {
        Row: {
          id: string;
          role: AppRole;
          full_name: string | null;
          phone: string | null;
          agency_id: string | null;
          agency_role: string | null;
          membership: MembershipTier;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      deal_views: {
        Row: {
          id: string;
          deal_id: string;
          viewed_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["deal_views"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["deal_views"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_booking: {
        Args: {
          p_deal_id: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_customer_email?: string | null;
          p_adults_count: number;
          p_children_count: number;
          p_infants_count: number;
          p_channel?: BookingChannel;
          p_payment_method: PaymentMethod;
          p_travelers: Json;
          p_services: Json;
        };
        Returns: {
          booking_number: number | string;
          total_price: number;
          currency: string;
          status: BookingStatus;
        }[];
      };
      lookup_booking: {
        Args: {
          p_booking_number: number;
          p_contact: string;
        };
        Returns: Json;
      };
      lookup_price_alerts: {
        Args: {
          p_contact: string;
        };
        Returns: Tables<"price_alerts">[];
      };
      submit_payment_proof: {
        Args: {
          p_booking_number: number;
          p_contact: string;
          p_proof_url: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      deal_type: DealType;
      deal_status: DealStatus;
      stop_type: StopType;
      payment_method: PaymentMethod;
      booking_channel: BookingChannel;
      booking_status: BookingStatus;
      membership_tier: MembershipTier;
      resale_status: ResaleStatus;
      resale_reason: ResaleReason;
      app_role: AppRole;
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type DealRow = Tables<"deals">;
export type AirportRow = Tables<"airports">;
export type AirlineRow = Tables<"airlines">;
export type ImageCacheRow = Tables<"image_cache">;
export type AgencyRow = Tables<"agencies">;
export type AffiliateRow = Tables<"affiliates">;
export type BookingRow = Tables<"bookings">;
export type AdditionalServiceRow = Tables<"additional_services">;
export type DealPriceHistoryRow = Tables<"deal_price_history">;
export type RoutePriceReferenceRow = Tables<"route_price_reference">;
export type BookingTravelerRow = Tables<"booking_travelers">;
export type ProfileRow = Tables<"profiles">;

/** Shape returned by the `lookup_booking` RPC (a hand-built jsonb object, not a table row). */
export type BookingLookupResult = {
  booking_number: number;
  status: BookingStatus;
  total_price: number;
  currency: string;
  payment_method: PaymentMethod | null;
  created_at: string;
  deal: {
    from_airport: string;
    to_airport: string;
    departure_date: string;
    airline_code: string | null;
  } | null;
  travelers: { full_name: string; traveler_type: string }[];
};

export type BookingTravelerInput = Pick<
  BookingTravelerRow,
  "full_name" | "date_of_birth" | "passport_number" | "nationality" | "traveler_type"
>;

export type BookingServiceInput = {
  service_id: string;
  quantity: number;
  unit_price: number;
};
