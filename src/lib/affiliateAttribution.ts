import { supabase } from "./supabase";

const STORAGE_KEY = "tr_click_id";
const COOKIE_NAME = "tr_click_id";
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days, matches affiliate_clicks.expires_at default

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)};max-age=${COOKIE_MAX_AGE_SECONDS};path=/;samesite=lax`;
}

function getStoredClickId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? readCookie(COOKIE_NAME);
  } catch {
    // localStorage can throw in private/locked-down browsing contexts
    return readCookie(COOKIE_NAME);
  }
}

function storeClickId(clickId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, clickId);
  } catch {
    // ignore — cookie below still covers it
  }
  writeCookie(COOKIE_NAME, clickId);
}

/**
 * Call once per page load when a `?ref=CODE` link lands. No-ops if there's
 * already a stored click (first-touch — an existing referral isn't overwritten
 * by a second link clicked later) or if the code is unknown/inactive.
 */
export async function captureAffiliateClickFromUrl(search: string, pathname: string) {
  const ref = new URLSearchParams(search).get("ref");
  if (!ref || getStoredClickId()) return;

  const { data, error } = await supabase.rpc("record_affiliate_click" as never, {
    p_referral_code: ref,
    p_landing_path: pathname,
    p_user_agent: navigator.userAgent,
  } as never);
  if (error || !data) return; // unknown code, inactive affiliate, or network hiccup — silent no-op
  storeClickId(data as unknown as string);
}

/**
 * Call right after a booking is created. Silent no-op if there's no stored
 * click, the click expired, or it was already used — never throws, since a
 * booking that already succeeded must not fail here.
 */
export async function attributeBookingToStoredClick(bookingNumber: string | number) {
  const clickId = getStoredClickId();
  if (!clickId) return;

  try {
    await supabase.rpc("attribute_booking_to_affiliate" as never, {
      p_booking_number: Number(bookingNumber),
      p_click_id: clickId,
    } as never);
  } catch {
    // never let attribution failure surface — the booking already succeeded
  }
}
