import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { getMySupplierId } from "../lib/airlinePortal";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";

/** Same visual design as GroundPortalLoginPage (Card/Input/Button, same
 *  blue theme) — checks the account is linked to a supplier row before
 *  letting them into the Airline Control Center. get_my_airline_overview()
 *  itself is the real gate: it only returns rows for suppliers of
 *  type='airline', so a ground/agency login lands with an empty overview
 *  and gets bounced back here. */
export function AirlinePortalLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      setLoading(false);
      return;
    }

    const supplierId = await getMySupplierId();
    if (!supplierId) {
      setError("هذا الحساب غير مرتبط بأي شركة طيران على المنصة");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    const { data: overview, error: overviewError } = await supabase.rpc(
      "get_my_airline_overview" as never,
    );
    if (overviewError || !overview || (overview as unknown[]).length === 0) {
      setError("هذا الحساب غير مرتبط بشركة طيران نشطة على المنصة");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    navigate("/airline-portal/overview");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="mx-auto w-full max-w-sm">
        <Card className="space-y-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">دخول لوحة شركة الطيران</h1>
            <p className="mt-1 text-sm text-slate-600">هذه البوابة مخصصة لشركات الطيران الشريكة فقط.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="البريد الإلكتروني"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
            <Input
              label="كلمة المرور"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {error ? <p className="text-xs text-red-600">{error}</p> : null}
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? "جاري الدخول..." : "دخول"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
