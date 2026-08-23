import type { AdditionalServiceRow } from "../types/database";

/**
 * TripGo = Flight Ticket + Airport Transfer sold as one product. The transfer
 * options here are NOT a separate/fake catalog — they're the exact same
 * `additional_services` rows (category "transport") shown on the Explore
 * page's "النقل" tab, so a price change made in one place (agency dashboard,
 * Supabase) is instantly correct in both TripGo and Explore.
 */

export function transportServices(services: AdditionalServiceRow[]): AdditionalServiceRow[] {
  return services.filter((s) => s.category === "transport").sort((a, b) => a.price - b.price);
}

/**
 * The transfer bundled into a TripGo trip by default — "نقل من وإلى المطار"
 * (type `airport_transfer`) if the live catalog has it, otherwise the
 * cheapest real transport-category service, so TripGo never breaks even if
 * that exact row isn't in the catalog yet.
 */
export function defaultTransfer(services: AdditionalServiceRow[]): AdditionalServiceRow | null {
  const transport = transportServices(services);
  if (transport.length === 0) return null;
  return transport.find((s) => s.type === "airport_transfer") ?? transport[0];
}

export function tripGoTotal(flightPrice: number, transferPrice: number): number {
  return Math.round((flightPrice + transferPrice) * 100) / 100;
}
