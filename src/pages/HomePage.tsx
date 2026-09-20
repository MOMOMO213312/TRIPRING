import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { BetaNotice } from "../components/BetaNotice";
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
import { fetchActiveDeals } from "../lib/api";
import type { TripType } from "../lib/api";
import { friendlyErrorMessage } from "../lib/errors";
import { useCatalog } from "../hooks/useCatalog";
import type { DealRow } from "../types/database";

const OPPORTUNITIES_LIMIT = 12;
const LAST_MINUTE_LIMIT = 10;

export function HomePage() {
  const { t } = useTranslation("home");
  const navigate = useNavigate();
  const catalog = useCatalog();
  // Fetch every active deal once (sorted by price) instead of only the
  // top 12: the "best opportunities" cards still just take the first 12,
  // but FareBoard/LiveDealsMap need the full live set or most routes show
  // no price even though a live deal exists for them.
  const [allActiveDeals, setAllActiveDeals] = useState<DealRow[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(true);
  const [dealsError, setDealsError] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveDeals({ sort: "price_asc", availableOnly: true })
      .then(setAllActiveDeals)
      .catch((e) => setDealsError(friendlyErrorMessage(e, "home:home.loadError", "HomePage.loadDeals")))
      .finally(() => setLoadingDeals(false));
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
    budget: string;
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
    if (params.budget) q.set("budget", params.budget);
    navigate(`/search?${q.toString()}`);
  }

  if (catalog.loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="skeleton-pulse h-14 w-full sm:h-16" />
        <div className="skeleton-pulse mt-4 h-10 w-2/3 sm:mx-auto" />
        <div className="skeleton-pulse mt-3 h-6 w-1/3 sm:mx-auto" />
        <div className="skeleton-pulse mt-8 h-28 w-full rounded-[24px]" />
        <div className="mt-10">
          <CardsSkeleton />
        </div>
      </div>
    );
  }

  if (catalog.error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Card className="text-center">
          <p className="text-red-600">{catalog.error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            {t("home.retry")}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <BetaNotice />
      <HeroSection
        airports={catalog.airports}
        deals={allActiveDeals}
        references={catalog.references}
        imageCache={catalog.imageCache}
        onSearch={handleHeroSearch}
      />
      <div className="relative z-10 mt-8">
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
                <h2 className="font-display text-2xl text-slate-900">{t("home.bestToday")}</h2>
                <p className="text-sm text-slate-600">
                  {t("home.bestTodaySub")}
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate("/deals")}>
                {t("home.viewAllDeals")}
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
            title={t("home.emptyTitle")}
            subtitle={t("home.emptySub")}
            suggestions={[
              { label: t("home.allDeals"), onClick: () => navigate("/deals") },
              { label: t("home.anyDestination"), onClick: () => navigate("/search?to=any") },
            ]}
          />
        )}

        {lastMinuteDeals.length > 0 ? (
          <section id="last-minute">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl text-slate-900">{t("home.lastMinute")}</h2>
                <p className="text-sm text-slate-600">{t("home.lastMinuteSub")}</p>
              </div>
              <Button variant="outline" onClick={() => navigate("/deals?dealType=last_minute")}>
                {t("home.viewAll")}
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
