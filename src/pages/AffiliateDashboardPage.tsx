import { useEffect, useState } from "react";

import { AuthGate } from "../components/AuthGate";
import { ResellerDealBrowser } from "../components/affiliate/ResellerDealBrowser";
import { ResellerOrdersHistory } from "../components/affiliate/ResellerOrdersHistory";
import { ResellerSubscriptionCard } from "../components/affiliate/ResellerSubscriptionCard";
import { NotificationBell } from "../components/notifications/NotificationBell";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { fetchAirports } from "../lib/api";
import {
  affiliateReferralLink,
  affiliateTierLabel,
  fetchMyAffiliateProfile,
  fetchMyCommissionLedger,
  fetchMyReferredBookings,
  REFERRAL_BOOKING_STATUS_LABELS,
  resellerSubscriptionIsActive,
  type AffiliateLedgerEntry,
} from "../lib/affiliate";
import { signOut } from "../lib/auth";
import { PLATFORM_WHATSAPP } from "../lib/constants";
import { friendlyErrorMessage } from "../lib/errors";
import { whatsAppLink } from "../lib/utils";
import type { AffiliateResellerSubscriptionRow, AffiliateRow, AirportRow, BookingRow } from "../types/database";

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
  const [tab, setTab] = useState<"referral" | "reseller">("referral");

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
      <div className="flex items-center justify-end gap-2">
        <NotificationBell />
        <Button variant="outline" onClick={() => signOut().then(() => window.location.reload())}>
          تسجيل الخروج
        </Button>
      </div>

      <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab("referral")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === "referral" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          برنامج الإحالة
        </button>
        <button
          type="button"
          onClick={() => setTab("reseller")}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
            tab === "reseller" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
          }`}
        >
          برنامج السعر الرسمي
        </button>
      </div>

      {tab === "referral" ? (
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

          <ReferralActivityPanel affiliateId={affiliate.id} />

          <Card>
            <h3 className="font-bold text-slate-900">إزاي تكسب أكتر؟</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>شارك رابطك مع أصحابك — كل حجز بيتم من خلاله بيديك عمولة.</li>
              <li>كل ما رصيدك يزيد، الـ tier بترقّى تلقائيًا وعمولتك تزيد معاها.</li>
            </ul>
          </Card>
        </div>
      ) : (
        <ResellerProgramTab affiliateId={affiliate.id} />
      )}
    </div>
  );
}

/** Real orchestration data for the referral program: the affiliate's actual
 *  referred bookings (live fulfillment status) and their real commission
 *  ledger (commission events + reversals) — sourced from bookings/
 *  financial_transactions directly, not the static counters on `affiliates`. */
function ReferralActivityPanel({ affiliateId }: { affiliateId: string }) {
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [ledger, setLedger] = useState<AffiliateLedgerEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"bookings" | "ledger">("bookings");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMyReferredBookings(affiliateId), fetchMyCommissionLedger(affiliateId)])
      .then(([b, l]) => {
        if (cancelled) return;
        setBookings(b);
        setLedger(l);
      })
      .catch((e) => {
        if (!cancelled) setError(friendlyErrorMessage(e, "تعذر تحميل نشاط الإحالة", "ReferralActivityPanel"));
      });
    return () => {
      cancelled = true;
    };
  }, [affiliateId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900">نشاط الإحالة</h3>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setView("bookings")}
            className={`rounded-md px-2.5 py-1 transition ${view === "bookings" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            الحجوزات
          </button>
          <button
            type="button"
            onClick={() => setView("ledger")}
            className={`rounded-md px-2.5 py-1 transition ${view === "ledger" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            سجل العمولات
          </button>
        </div>
      </div>

      {bookings === null || ledger === null ? (
        <p className="mt-3 text-sm text-slate-500">جاري التحميل...</p>
      ) : view === "bookings" ? (
        bookings.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">لسه مفيش حجوزات من رابطك.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">حجز #{b.booking_number}</p>
                  <p className="text-xs text-slate-500">{b.customer_name}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    b.status === "paid" || b.status === "ticket_issued"
                      ? "bg-emerald-50 text-emerald-700"
                      : b.status === "cancelled"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {REFERRAL_BOOKING_STATUS_LABELS[b.status]}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : ledger.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">لسه مفيش عمولات متسجلة.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {ledger.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <p className="font-semibold text-slate-900">
                  {entry.txn_type === "affiliate_reversal" ? "استرجاع عمولة" : "عمولة إحالة"}
                </p>
                <p className="text-xs text-slate-500">{new Date(entry.occurred_at).toLocaleDateString("ar-EG")}</p>
              </div>
              <span
                className={`font-latin font-bold ${entry.amount < 0 ? "text-red-600" : "text-emerald-700"}`}
              >
                {entry.amount < 0 ? "" : "+"}
                {entry.amount} {entry.currency}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ResellerProgramTab({ affiliateId }: { affiliateId: string }) {
  const [activeSub, setActiveSub] = useState<AffiliateResellerSubscriptionRow | null>(null);
  const [airports, setAirports] = useState<AirportRow[]>([]);
  const [airportsError, setAirportsError] = useState<string | null>(null);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);

  useEffect(() => {
    fetchAirports()
      .then(setAirports)
      .catch((e) => setAirportsError(friendlyErrorMessage(e, "تعذر تحميل بيانات المطارات", "ResellerProgramTab.airports")));
  }, []);

  return (
    <div className="space-y-6">
      <ResellerSubscriptionCard
        affiliateId={affiliateId}
        onSubscriptionActive={(sub) => {
          if (resellerSubscriptionIsActive(sub)) setActiveSub(sub);
        }}
      />

      {activeSub ? (
        airportsError ? (
          <p className="text-sm text-red-600">{airportsError}</p>
        ) : (
          <>
            <ResellerOrdersHistory key={ordersRefreshKey} affiliateId={affiliateId} />
            <ResellerDealBrowser
              airports={airports}
              onOrderCreated={() => setOrdersRefreshKey((k) => k + 1)}
            />
          </>
        )
      ) : null}
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
