import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "./supabase";

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName?: string,
): Promise<User | null> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: fullName ? { data: { full_name: fullName.trim() } } : undefined,
  });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User | null> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getCurrentUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

/** Convenience hook for gating UI on auth state without prop-drilling a session. */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user: session?.user ?? null, session, loading };
}

/** Human-readable Arabic messages for the auth errors we expect users to actually hit. */
export function authErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("Invalid login credentials")) return "بيانات الدخول غير صحيحة";
  if (raw.includes("User already registered")) return "هذا البريد الإلكتروني مسجل بالفعل";
  if (raw.includes("Password should be at least")) return "كلمة المرور يجب أن تكون 6 أحرف على الأقل";
  if (raw.includes("Unable to validate email")) return "صيغة البريد الإلكتروني غير صحيحة";
  return raw || "حدث خطأ، حاول مرة أخرى";
}
