import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getMySupplierId } from "../lib/groundPortal";
import "../styles/ground-portal.css";

export function GroundPortalLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
      setError("هذا الحساب غير مرتبط بأي مورد خدمة أرضية");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    navigate("/ground-portal/queue");
  }

  return (
    <div data-ground-portal className="gp-login-wrap">
      <div className="gp-login-card">
        <div className="gp-login-title">GROUND OPS</div>
        <div className="gp-login-sub">بوابة موردي الخدمة الأرضية — TripRing</div>

        <form onSubmit={handleSubmit}>
          <div className="gp-field">
            <label htmlFor="email">البريد الإلكتروني</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="gp-field">
            <label htmlFor="password">كلمة المرور</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <div className="gp-error">{error}</div>}
          <button className="gp-login-btn" type="submit" disabled={loading}>
            {loading ? "جارِ الدخول..." : "دخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
