import type { FormEvent } from "react";
import { useState } from "react";

import { authErrorMessage, signInWithEmail } from "../../lib/auth";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";

/** Agency dashboard is staff-only — sign-in only, no public sign-up here. */
export function AgencyLoginGate() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <Card className="space-y-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900">دخول لوحة الوكالة</h1>
          <p className="mt-1 text-sm text-slate-600">هذه اللوحة مخصصة لموظفي الوكالات الشريكة فقط.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? "جاري الدخول..." : "دخول"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
