import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { BudgetExplorer } from "../components/BudgetExplorer";
import { DealCarousel } from "../components/DealCarousel";
import { TravelToSection } from "../components/TravelToSection";
import { EmptyState } from "../components/EmptyState";
import { HeroSection } from "../components/HeroSection";
import { BudgetTeaserCard, PriceAlertTeaserCard } from "../components/HomeSidebarCards";
import { CardsSkeleton } from "../components/LoadingSkeleton";
import { MarketOverview } from "../components/MarketOverview";
import { SmartFilterChips } from "../components/SmartFilterChips";
import { TrustStrip } from "../components/TrustStrip";
import { WhyTripRing } from "../components/WhyTripRing";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { fetchActiveDeals, fetchMarketStats } from "../lib/api";
import type { MarketStats, TripType } from "../lib/api";
import { useCatalog } from "../hooks/useCatalog";
import type { DealRow } from "../types/database";

const OPPORTUNITIES_LIMIT = 12;
const LAST_MINUTE_LIMIT = 10;

export function HomePage() {
  const navigate = useNavigate();
  const catalog = useCatalog();
  // Fetch every active deal once (sorted by deal_score) instead of only the
  // top 12: the "best opportunities" cards still just take the first 12,
  // but FareBoard/LiveDealsMap need the full live set or most routes show
  // no price even though a live deal exists for them.
  const [allActiveDeals, setAllActiveDeals] = useState<DealRow[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [dealsError, setDealsError] = useState<string | null>(null);
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);

  useEffect(() => {
    fetchActiveDeals({ sort: "deal_score", availableOnly: true })
      .then(setAllActiveDeals)
      .catch((e) => setDealsError(e instanceof Error ? e.message : "خطأ"))
      .finally(() => setLoadingDeals(false));
    // Market stats are computed entirely from real live data (deal_score,
    // expires_at, view_count, deal_price_history) — no invented numbers —
    // so they can load independently and fail silently without blocking
    // the rest of the homepage.
    fetchMarketStats()
      .then(setMarketStats)
      .catch(() => setMarketStats(null));
  }, []);

  const opportunities = allActiveDeals.slice(0, OPPORTUNITIES_LIMIT);

  const lastMinuteDeals = useMemo(
    () => allActiveDeals.filter((d) => d.deal_type === "last_minute").slice(0, LAST_MINUTE_LIMIT),
    [allActiveDeals],
  );

  function handleHeroSearch(params: {
    from: string;
    to: string;
    date: string;
    returnDate: string;
    passengers: number;
    tripType: TripType;
  }) {
    const q = new URLSearchParams();
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    if (params.date) q.set("date", params.date);
    // Round-trip is the default lookup, so only stamp tripType on the URL when
    // it actually narrows the search — keeps existing bookmarked/shared links
    // (from before tripType existed) behaving exactly as before.
    if (params.tripType !== "round_trip") q.set("tripType", params.tripType);
    if (params.tripType !== "one_way" && params.returnDate) q.set("returnDate", params.returnDate);
    if (params.passengers > 1) q.set("passengers", String(params.passengers));
    navigate(`/search?${q.toString()}`);
  }

  if (catalog.loading) {
    return <p className="py-20 text-center text-slate-500">جاري التحميل...</p>;
  }

  if (catalog.error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Card className="text-center">
          <p className="text-red-600">{catalog.error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            إعادة المحاولة
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <HeroSection
        airports={catalog.airports}
        deals={allActiveDeals}
        references={catalog.references}
        onSearch={handleHeroSearch}
      />
      <div className="relative z-10 mt-4">
        <SmartFilterChips />
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-5">
        <TrustStrip />
      </div>

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
        {opportunities.length > 0 ? (
          <section id="opportunities">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-slate-900">أفضل العروض اليوم</h2>
                <p className="text-sm text-slate-600">
                  عروض مختارة بعناية لك — الباقي مرتب حسب Deal Score
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate("/deals")}>
                عرض كل العروض
              </Button>
            </div>
            <DealCarousel deals={opportunities} catalog={catalog} />
          </section>
        ) : loadingDeals ? (
          <CardsSkeleton />
        ) : dealsError ? (
          <Card className="text-red-600">{dealsError}</Card>
        ) : (
          <EmptyState
            icon="🧭"
            title="لا توجد فرص نشطة حالياً"
            subtitle="جرّب توسيع نطاق البحث أو راجع الصفحة بعد قليل — الفرص بتتحدث باستمرار"
            suggestions={[
              { label: "كل العروض", onClick: () => navigate("/deals") },
              { label: "أي وجهة", onClick: () => navigate("/search?to=any") },
            ]}
          />
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <PriceAlertTeaserCard />
          <BudgetTeaserCard />
        </div>

        {marketStats ? (
          <div id="market-overview">
            <MarketOverview stats={marketStats} airports={catalog.airports} />
          </div>
        ) : null}

        {lastMinuteDeals.length > 0 ? (
          <section id="last-minute">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-slate-900">🔥 فرص آخر لحظة</h2>
                <p className="text-sm text-slate-600">عروض محدودة، مقاعد قليلة، ووقت مهم</p>
              </div>
              <Button variant="outline" onClick={() => navigate("/deals?dealType=last_minute")}>
                عرض الكل
              </Button>
            </div>
            <DealCarousel deals={lastMinuteDeals} catalog={catalog} />
          </section>
        ) : null}

        <div id="destinations">
          <TravelToSection
            airports={catalog.airports}
            imageCache={catalog.imageCache}
            references={catalog.references}
          />
        </div>

        <div id="budget">
          <BudgetExplorer />
        </div>

        <WhyTripRing />
      </div>
    </div>
  );
}
