import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import type { User } from "@supabase/supabase-js";

import { authErrorMessage, signInWithEmail, signUpWithEmail, useAuth } from "../lib/auth";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";

/**
 * Gates a single feature (writing a review, listing a ticket for resale) behind login.
 * Everything else in the app stays reachable without an account — mount this only
 * around the specific form/action that needs a signed-in user.
 */
export function AuthGate({
  title = "سجّل الدخول للمتابعة",
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: (user: User) => ReactNode;
}) {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmNotice, setConfirmNotice] = useState(false);

  if (loading) return null;
  if (user) return <>{children(user)}</>;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setConfirmNotice(false);
    try {
      if (mode === "signup") {
        const signedUpUser = await signUpWithEmail(email, password, fullName);
        if (signedUpUser && !signedUpUser.email_confirmed_at) {
          setConfirmNotice(true);
        }
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="font-bold text-slate-900">{title}</h3>
        {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      </div>

      <div className="flex gap-2 text-sm font-medium">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={mode === "signin" ? "text-primary" : "text-slate-400"}
        >
          تسجيل الدخول
        </button>
        <span className="text-slate-300">|</span>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={mode === "signup" ? "text-primary" : "text-slate-400"}
        >
          حساب جديد
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === "signup" ? (
          <Input label="الاسم" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        ) : null}
        <Input
          label="البريد الإلكتروني"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="كلمة المرور"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        {confirmNotice ? (
          <p className="text-xs text-green-700">تم إنشاء الحساب — تحقق من بريدك الإلكتروني لتأكيد الدخول</p>
        ) : null}
        <Button type="submit" fullWidth disabled={submitting}>
          {submitting ? "جاري التحقق..." : mode === "signup" ? "إنشاء حساب" : "دخول"}
        </Button>
      </form>
    </Card>
  );
}
