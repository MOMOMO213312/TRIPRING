import { useEffect, useState } from "react";

import { AuthGate } from "../components/AuthGate";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { affiliateReferralLink, affiliateTierLabel, fetchMyAffiliateProfile } from "../lib/affiliate";
import { PLATFORM_WHATSAPP } from "../lib/constants";
import { whatsAppLink } from "../lib/utils";
import type { AffiliateRow } from "../types/database";

export function AffiliateDashboardPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">لوحة الأفلييت</h1>
        <p className="mt-1 text-slate-600">تابع عمولتك ورابط الإحالة الخاص بيك</p>
      </div>

      <AuthGate title="سجّل الدخول عشان تشوف لوحة الأفلييت بتاعتك">
        {() => <AffiliateBody />}
      </AuthGate>
    </div>
  );
}

function AffiliateBody() {
  const [affiliate, setAffiliate] = useState<AffiliateRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMyAffiliateProfile()
      .then((a) => {
        if (!cancelled) setAffiliate(a);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="text-slate-500">جاري التحميل...</p>;

  if (!affiliate) {
    return (
      <Card className="text-center">
        <p className="text-3xl">🤝</p>
        <h3 className="mt-3 font-bold text-slate-900">لسه مش مسجّل كأفلييت</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
          حساب الأفلييت بيتفعّل من فريق TripRing. كلّمنا على واتساب أو الإيميل عشان نفعّله لحسابك.
        </p>
        <a
          href={whatsAppLink(PLATFORM_WHATSAPP, "عايز أنضم كأفلييت في TripRing")}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex"
        >
          <Button variant="whatsapp">تواصل عبر واتساب</Button>
        </a>
      </Card>
    );
  }

  const link = affiliateReferralLink(affiliate.referral_code);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard permission denied — the visible link text is still selectable/copyable manually
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900">رابط الإحالة بتاعك</p>
          <span className="font-latin rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
            {affiliateTierLabel(affiliate.tier)}
          </span>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={link}
            className="font-latin flex-1 truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700"
          />
          <Button onClick={copyLink}>{copied ? "✓ اتنسخ" : "نسخ الرابط"}</Button>
        </div>
        {!affiliate.is_active ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
            حسابك موقوف مؤقتًا — كلّم الدعم لو محتاج تفعيله تاني.
          </p>
        ) : null}
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="نسبة العمولة" value={`${Math.round(affiliate.commission_rate * 100)}%`} />
        <StatCard label="حجوزات محالة" value={String(affiliate.total_referred_bookings)} />
        <StatCard label="إجمالي الأرباح" value={`$${affiliate.total_earned}`} highlight />
      </div>

      <Card>
        <h3 className="font-bold text-slate-900">إزاي تكسب أكتر؟</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>شارك رابطك مع أصحابك — كل حجز بيتم من خلاله بيديك عمولة.</li>
          <li>كل ما رصيدك يزيد، الـ tier بترقّى تلقائيًا وعمولتك تزيد معاها.</li>
        </ul>
      </Card>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-[#0C7BB3] bg-[#E5F4FB] text-center" : "text-center"}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-latin mt-1 text-xl font-extrabold ${highlight ? "text-[#0C7BB3]" : "text-slate-900"}`}>
        {value}
      </p>
    </Card>
  );
}
