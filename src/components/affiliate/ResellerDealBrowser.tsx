import { useEffect, useState } from "react";

import { fetchActiveDeals } from "../../lib/api";
import { createAffiliateResaleOrder, fetchResellerNetPrice } from "../../lib/affiliate";
import { formatRouteCities } from "../../lib/deal-utils";
import { friendlyErrorMessage } from "../../lib/errors";
import { formatPrice } from "../../lib/utils";
import type { AirportRow, DealRow } from "../../types/database";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";

/** The max markup rate affiliates can add on top of the net/system price.
 *  Mirrors private.reseller_max_markup_rate() in the database — the server
 *  is the real source of truth and rejects anything past this, but showing
 *  the same number here lets the affiliate see their ceiling while typing
 *  instead of finding out only after submitting. */
const RESELLER_MAX_MARKUP_RATE = 0.15;

/** Lets a subscribed affiliate browse active deals, see the real system
 *  price and their max allowed sell price, and register a resale order for
 *  their own customer. Only rendered once the affiliate has a valid active
 *  reseller subscription (gated by the parent). */
export function ResellerDealBrowser({ airports }: { airports: AirportRow[] }) {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<DealRow | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchActiveDeals({ availableOnly: true, sort: "price_asc" })
      .then(setDeals)
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل الصفقات", "ResellerDealBrowser.load")))
      .finally(() => setLoading(false));
  }, []);

  if (selectedDeal) {
    return <ResellerSellForm deal={selectedDeal} airports={airports} onBack={() => setSelectedDeal(null)} />;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="font-bold text-slate-900">صفقات متاحة للبيع</p>
        <p className="mt-1 text-sm text-slate-500">اختار صفقة عشان تشوف السعر الرسمي وأقصى سعر تقدر تبيعها بيه.</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">جاري التحميل...</p> : null}

      {!loading && !deals.length ? (
        <Card className="text-center text-sm text-slate-400">مفيش صفقات متاحة دلوقتي.</Card>
      ) : null}

      <div className="space-y-2">
        {deals.map((deal) => {
          const maxSell = Math.round(deal.price * (1 + RESELLER_MAX_MARKUP_RATE) * 100) / 100;
          return (
            <Card key={deal.id} className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{formatRouteCities(deal, airports)}</p>
                  <p className="text-xs text-slate-500">
                    {deal.departure_date}
                    {deal.return_date ? ` → ${deal.return_date}` : " · ذهاب فقط"}
                  </p>
                </div>
                <p className="font-latin text-lg font-extrabold text-slate-900">
                  {formatPrice(deal.price, deal.currency ?? "USD")}
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <span className="text-slate-500">
                  أقصى سعر بيع (+{Math.round(RESELLER_MAX_MARKUP_RATE * 100)}%)
                </span>
                <span className="font-latin font-bold text-[#0C7BB3]">
                  {formatPrice(maxSell, deal.currency ?? "USD")}
                </span>
              </div>
              <Button type="button" fullWidth onClick={() => setSelectedDeal(deal)}>
                اختار الصفقة دي
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ResellerSellForm({
  deal,
  airports,
  onBack,
}: {
  deal: DealRow;
  airports: AirportRow[];
  onBack: () => void;
}) {
  const [netPrice, setNetPrice] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);

  const [sellPrice, setSellPrice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [adultsCount, setAdultsCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [infantsCount, setInfantsCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setLoadingPrice(true);
    setPriceError(null);
    fetchResellerNetPrice(deal.id)
      .then(setNetPrice)
      .catch((e) => setPriceError(friendlyErrorMessage(e, "تعذر تحميل السعر الرسمي", "ResellerSellForm.load")))
      .finally(() => setLoadingPrice(false));
  }, [deal.id]);

  const maxSell = netPrice != null ? Math.round(netPrice * (1 + RESELLER_MAX_MARKUP_RATE) * 100) / 100 : null;
  const sellPriceNum = Number(sellPrice);
  const sellPriceValid =
    sellPrice.trim() !== "" &&
    !Number.isNaN(sellPriceNum) &&
    netPrice != null &&
    maxSell != null &&
    sellPriceNum >= netPrice &&
    sellPriceNum <= maxSell;

  const yourProfit = sellPriceValid && netPrice != null ? Math.round((sellPriceNum - netPrice) * 100) / 100 : null;

  async function submit() {
    if (!sellPriceValid) {
      setSubmitError(`سعر البيع لازم يكون بين ${netPrice} و ${maxSell}`);
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      setSubmitError("اسم ورقم هاتف العميل مطلوبين");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const orderId = await createAffiliateResaleOrder({
        dealId: deal.id,
        sellPrice: sellPriceNum,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || null,
        adultsCount,
        childrenCount,
        infantsCount,
      });
      setDone(orderId);
    } catch (e) {
      setSubmitError(friendlyErrorMessage(e, "تعذر تسجيل الطلب", "ResellerSellForm.submit"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="space-y-3 text-center">
        <p className="text-3xl">✅</p>
        <p className="font-bold text-slate-900">اتسجل الطلب بنجاح</p>
        <p className="text-sm text-slate-500">فريق TripRing هيتابع معاك خطوات إتمام الحجز.</p>
        <Button type="button" variant="outline" fullWidth onClick={onBack}>
          العودة لقائمة الصفقات
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" onClick={onBack}>
        ← رجوع للصفقات
      </Button>

      <Card className="space-y-2">
        <p className="font-semibold text-slate-900">{formatRouteCities(deal, airports)}</p>
        <p className="text-xs text-slate-500">
          {deal.departure_date}
          {deal.return_date ? ` → ${deal.return_date}` : " · ذهاب فقط"}
        </p>
      </Card>

      {loadingPrice ? <p className="text-sm text-slate-500">جاري تحميل السعر الرسمي...</p> : null}
      {priceError ? <p className="text-sm text-red-600">{priceError}</p> : null}

      {netPrice != null && maxSell != null ? (
        <Card className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">السعر الرسمي (اللي بتدفعه إنت)</span>
            <span className="font-latin font-bold text-slate-900">{formatPrice(netPrice, deal.currency ?? "USD")}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">أقصى سعر بيع مسموح (+{Math.round(RESELLER_MAX_MARKUP_RATE * 100)}%)</span>
            <span className="font-latin font-bold text-[#0C7BB3]">{formatPrice(maxSell, deal.currency ?? "USD")}</span>
          </div>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <Input
          label={`سعر البيع لعميلك${netPrice != null && maxSell != null ? ` (بين ${netPrice} و ${maxSell})` : ""}`}
          type="number"
          value={sellPrice}
          onChange={(e) => setSellPrice(e.target.value)}
          placeholder={netPrice != null ? String(netPrice) : ""}
        />
        {yourProfit != null ? (
          <p className="text-xs font-semibold text-green-700">ربحك من الصفقة دي: {formatPrice(yourProfit, deal.currency ?? "USD")}</p>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <Input
            label="بالغين"
            type="number"
            min={1}
            value={adultsCount}
            onChange={(e) => setAdultsCount(Math.max(1, Number(e.target.value) || 1))}
          />
          <Input
            label="أطفال"
            type="number"
            min={0}
            value={childrenCount}
            onChange={(e) => setChildrenCount(Math.max(0, Number(e.target.value) || 0))}
          />
          <Input
            label="رضّع"
            type="number"
            min={0}
            value={infantsCount}
            onChange={(e) => setInfantsCount(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>

        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">بيانات عميلك</p>
          <div className="space-y-2">
            <Input label="اسم العميل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <Input label="رقم هاتف العميل" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            <Input
              label="إيميل العميل (اختياري)"
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
            />
          </div>
        </div>

        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

        <Button type="button" fullWidth disabled={submitting || loadingPrice} onClick={submit}>
          {submitting ? "جاري التسجيل..." : "تسجيل طلب البيع"}
        </Button>
      </Card>
    </div>
  );
}
