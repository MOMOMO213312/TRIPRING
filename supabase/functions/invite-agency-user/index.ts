// invite-agency-user
//
// Admin-only Edge Function. Creates (or invites) an auth user and links
// their profile to a specific agency. This MUST run server-side because it
// needs the service_role key (auth.admin.*) which can never be exposed to
// the browser.
//
// Auth flow:
//   1. verify_jwt=true (set at deploy time) ensures the request carries a
//      valid Supabase session JWT.
//   2. We still explicitly re-check the caller's profile.role === 'admin'
//      here — verify_jwt only proves "some logged-in user", not "an admin".
//
// Request body:
//   {
//     agencyId: string;        // uuid of the target agency
//     email: string;
//     fullName?: string;
//     agencyRole?: string;     // free text, e.g. "manager" | "staff"
//   }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  // Client scoped to the caller's own JWT — used only to find out who is
  // calling and whether they're an admin. Never used for privileged writes.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();

  if (callerError || !caller) {
    return json({ error: "Invalid session" }, 401);
  }

  const { data: callerProfile, error: profileError } = await callerClient
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileError) {
    return json({ error: profileError.message }, 500);
  }
  if (!callerProfile || callerProfile.role !== "admin") {
    return json({ error: "Admins only" }, 403);
  }

  let body: { agencyId?: string; email?: string; fullName?: string; agencyRole?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const agencyId = body.agencyId?.trim();
  const email = body.email?.trim().toLowerCase();
  const fullName = body.fullName?.trim() || null;
  const agencyRole = body.agencyRole?.trim() || null;

  if (!agencyId || !email) {
    return json({ error: "agencyId and email are required" }, 400);
  }

  // Privileged client — service_role key, only used for the two writes
  // below (auth admin + profile update), never returned to the client.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: agency, error: agencyError } = await adminClient
    .from("agencies")
    .select("id,name")
    .eq("id", agencyId)
    .maybeSingle();

  if (agencyError) return json({ error: agencyError.message }, 500);
  if (!agency) return json({ error: "Agency not found" }, 404);

  // inviteUserByEmail creates the auth user (if not already existing) and
  // sends a Supabase-hosted invite email with a magic link to set a
  // password. This also fires trg_handle_new_user, which inserts a bare
  // profiles row (id, full_name, phone) — we patch it below with the
  // agency link and role.
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  });

  let userId: string;

  if (inviteError) {
    // Most common real-world case: the email already belongs to an
    // existing auth user (e.g. re-inviting, or they signed up already).
    // Look them up instead of failing outright.
    const alreadyExists = /already registered|already exists/i.test(inviteError.message);
    if (!alreadyExists) {
      return json({ error: inviteError.message }, 500);
    }
    const { data: list, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) return json({ error: listError.message }, 500);
    const existing = list.users.find((u) => u.email?.toLowerCase() === email);
    if (!existing) return json({ error: "User exists but could not be looked up" }, 500);
    userId = existing.id;
  } else {
    userId = invited.user.id;
  }

  const { error: updateError } = await adminClient
    .from("profiles")
    .update({
      role: "agency",
      agency_id: agency.id,
      agency_role: agencyRole,
      ...(fullName ? { full_name: fullName } : {}),
    })
    .eq("id", userId);

  if (updateError) return json({ error: updateError.message }, 500);

  return json({ userId, agencyId: agency.id, email });
});
