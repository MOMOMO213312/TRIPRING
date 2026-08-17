import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { BudgetExplorer } from "../components/BudgetExplorer";
import { DealCarousel } from "../components/DealCarousel";
import { TravelToSection } from "../components/TravelToSection";
import { EmptyState } from "../components/EmptyState";
import { HeroSection } from "../components/HeroSection";
import { CardsSkeleton } from "../components/LoadingSkeleton";
import { SmartFilterChips } from "../components/SmartFilterChips";
import { TrustStrip } from "../components/TrustStrip";
import { WhyTripRing } from "../components/WhyTripRing";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { fetchBestOpportunities } from "../lib/api";
import { useCatalog } from "../hooks/useCatalog";
import type { DealRow } from "../types/database";

export function HomePage() {
  const navigate = useNavigate();
  const catalog = useCatalog();
  const [opportunities, setOpportunities] = useState<DealRow[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [dealsError, setDealsError] = useState<string | null>(null);

  useEffect(() => {
    fetchBestOpportunities(12)
      .then(setOpportunities)
      .catch((e) => setDealsError(e instanceof Error ? e.message : "خطأ"))
      .finally(() => setLoadingDeals(false));
  }, []);

  function handleHeroSearch(params: {
    from: string;
    to: string;
    date: string;
    returnDate: string;
    passengers: number;
  }) {
    const q = new URLSearchParams();
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    if (params.date) q.set("date", params.date);
    if (params.returnDate) q.set("returnDate", params.returnDate);
    if (params.passengers > 1) q.set("passengers", String(params.passengers));
    navigate(`/search?${q.toString()}`);
  }

  if (catalog.loading) {
    return <p className="py-20 text-center text-gray-500">جاري التحميل...</p>;
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
        deals={opportunities}
        references={catalog.references}
        onSearch={handleHeroSearch}
      />
      <div className="relative z-10 -mt-2">
        <SmartFilterChips />
      </div>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-12">
        <section id="opportunities">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">أفضل الفرص اليوم</h2>
              <p className="text-sm text-gray-600">
                أعلى 5 عروض مع ترتيب واضح — الباقي مرتب حسب Deal Score
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/deals")}>
              كل العروض
            </Button>
          </div>

          {loadingDeals ? (
            <CardsSkeleton />
          ) : dealsError ? (
            <Card className="text-red-600">{dealsError}</Card>
          ) : opportunities.length === 0 ? (
            <EmptyState
              icon="🧭"
              title="لا توجد فرص نشطة حالياً"
              subtitle="جرّب توسيع نطاق البحث أو راجع الصفحة بعد قليل — الفرص بتتحدث باستمرار"
              suggestions={[
                { label: "كل العروض", onClick: () => navigate("/deals") },
                { label: "أي وجهة", onClick: () => navigate("/search?to=any") },
              ]}
            />
          ) : (
            <DealCarousel deals={opportunities} catalog={catalog} />
          )}
        </section>

        <div id="destinations">
          <TravelToSection airports={catalog.airports} imageCache={catalog.imageCache} />
        </div>

        <div id="budget">
          <BudgetExplorer />
        </div>

        <TrustStrip />

        <WhyTripRing />
      </div>
    </div>
  );
}
