import { Suspense, lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";

const AffiliateDashboardPage = lazy(() =>
  import("./pages/AffiliateDashboardPage").then((m) => ({ default: m.AffiliateDashboardPage })),
);
const AdminDashboardPage = lazy(() =>
  import("./pages/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage })),
);
const AgencyDashboardPage = lazy(() =>
  import("./pages/AgencyDashboardPage").then((m) => ({ default: m.AgencyDashboardPage })),
);
const BlueFridayPage = lazy(() =>
  import("./pages/BlueFridayPage").then((m) => ({ default: m.BlueFridayPage })),
);
const AlertsPage = lazy(() =>
  import("./pages/AlertsPage").then((m) => ({ default: m.AlertsPage })),
);
const BookingPage = lazy(() =>
  import("./pages/BookingPage").then((m) => ({ default: m.BookingPage })),
);
const ConfirmationPage = lazy(() =>
  import("./pages/ConfirmationPage").then((m) => ({ default: m.ConfirmationPage })),
);
const DealDetailPage = lazy(() =>
  import("./pages/DealDetailPage").then((m) => ({ default: m.DealDetailPage })),
);
const DealsCenterPage = lazy(() =>
  import("./pages/DealsCenterPage").then((m) => ({ default: m.DealsCenterPage })),
);
const DestinationsPage = lazy(() =>
  import("./pages/DestinationsPage").then((m) => ({ default: m.DestinationsPage })),
);
const RoutesPage = lazy(() =>
  import("./pages/RoutesPage").then((m) => ({ default: m.RoutesPage })),
);
const ExplorePage = lazy(() =>
  import("./pages/ExplorePage").then((m) => ({ default: m.ExplorePage })),
);
const FaqPage = lazy(() =>
  import("./pages/FaqPage").then((m) => ({ default: m.FaqPage })),
);
const BecomeSupplierPage = lazy(() =>
  import("./pages/BecomeSupplierPage").then((m) => ({ default: m.BecomeSupplierPage })),
);
const HomePage = lazy(() =>
  import("./pages/HomePage").then((m) => ({ default: m.HomePage })),
);
const MyTripsPage = lazy(() =>
  import("./pages/MyTripsPage").then((m) => ({ default: m.MyTripsPage })),
);
const MembershipPage = lazy(() =>
  import("./pages/MembershipPage").then((m) => ({ default: m.MembershipPage })),
);
const PrivacyPage = lazy(() =>
  import("./pages/PrivacyPage").then((m) => ({ default: m.PrivacyPage })),
);
const SearchResultsPage = lazy(() =>
  import("./pages/SearchResultsPage").then((m) => ({ default: m.SearchResultsPage })),
);
const TermsPage = lazy(() =>
  import("./pages/TermsPage").then((m) => ({ default: m.TermsPage })),
);
const TicketResalePage = lazy(() =>
  import("./pages/TicketResalePage").then((m) => ({ default: m.TicketResalePage })),
);
const TripGoPage = lazy(() =>
  import("./pages/TripGoPage").then((m) => ({ default: m.TripGoPage })),
);
const TripGoResultsPage = lazy(() =>
  import("./pages/TripGoResultsPage").then((m) => ({ default: m.TripGoResultsPage })),
);
const TripGoDetailsPage = lazy(() =>
  import("./pages/TripGoDetailsPage").then((m) => ({ default: m.TripGoDetailsPage })),
);
const GroundPortalLoginPage = lazy(() =>
  import("./pages/GroundPortalLoginPage").then((m) => ({ default: m.GroundPortalLoginPage })),
);
const AirlinePortalLoginPage = lazy(() =>
  import("./pages/AirlinePortalLoginPage").then((m) => ({ default: m.AirlinePortalLoginPage })),
);
const AirlinePortalOverviewPage = lazy(() =>
  import("./pages/AirlinePortalOverviewPage").then((m) => ({ default: m.AirlinePortalOverviewPage })),
);
const AirlinePortalFlightsPage = lazy(() =>
  import("./pages/AirlinePortalFlightsPage").then((m) => ({ default: m.AirlinePortalFlightsPage })),
);
const AirlinePortalBookingsPage = lazy(() =>
  import("./pages/AirlinePortalBookingsPage").then((m) => ({ default: m.AirlinePortalBookingsPage })),
);
const AirlinePortalGroundPage = lazy(() =>
  import("./pages/AirlinePortalGroundPage").then((m) => ({ default: m.AirlinePortalGroundPage })),
);
const AirlinePortalAgreementsPage = lazy(() =>
  import("./pages/AirlinePortalAgreementsPage").then((m) => ({ default: m.AirlinePortalAgreementsPage })),
);
const AirlinePortalSettlementsPage = lazy(() =>
  import("./pages/AirlinePortalSettlementsPage").then((m) => ({ default: m.AirlinePortalSettlementsPage })),
);
const AirlinePortalReportsPage = lazy(() =>
  import("./pages/AirlinePortalReportsPage").then((m) => ({ default: m.AirlinePortalReportsPage })),
);
const GroundPortalQueuePage = lazy(() =>
  import("./pages/GroundPortalQueuePage").then((m) => ({ default: m.GroundPortalQueuePage })),
);
const GroundPortalAirlinesPage = lazy(() =>
  import("./pages/GroundPortalAirlinesPage").then((m) => ({ default: m.GroundPortalAirlinesPage })),
);
const GroundPortalAgreementsPage = lazy(() =>
  import("./pages/GroundPortalAgreementsPage").then((m) => ({ default: m.GroundPortalAgreementsPage })),
);
const GroundPortalReportsPage = lazy(() =>
  import("./pages/GroundPortalReportsPage").then((m) => ({ default: m.GroundPortalReportsPage })),
);
const GroundPortalSettlementsPage = lazy(() =>
  import("./pages/GroundPortalSettlementsPage").then((m) => ({
    default: m.GroundPortalSettlementsPage,
  })),
);

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="search" element={<SearchResultsPage />} />
              <Route path="deals" element={<DealsCenterPage />} />
              <Route path="destinations" element={<DestinationsPage />} />
              <Route path="routes" element={<RoutesPage />} />
              <Route path="explore" element={<ExplorePage />} />
              <Route path="tripgo" element={<TripGoPage />} />
              <Route path="tripgo/results" element={<TripGoResultsPage />} />
              <Route path="tripgo/:bundleId" element={<TripGoDetailsPage />} />
              <Route path="blue-friday" element={<BlueFridayPage />} />
              <Route path="deals/:dealId" element={<DealDetailPage />} />
              <Route path="book/:dealId" element={<BookingPage />} />
              <Route path="confirmation" element={<ConfirmationPage />} />
              <Route path="my-trips" element={<MyTripsPage />} />
              <Route path="membership" element={<MembershipPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="resale" element={<TicketResalePage />} />
              <Route path="agency" element={<AgencyDashboardPage />} />
              <Route path="admin" element={<AdminDashboardPage />} />
              <Route path="affiliate" element={<AffiliateDashboardPage />} />
              <Route path="faq" element={<FaqPage />} />
              <Route path="become-a-supplier" element={<BecomeSupplierPage />} />
              <Route path="terms" element={<TermsPage />} />
              <Route path="privacy" element={<PrivacyPage />} />
              <Route path="airline-portal/login" element={<AirlinePortalLoginPage />} />
              <Route path="airline-portal/overview" element={<AirlinePortalOverviewPage />} />
              <Route path="airline-portal/flights" element={<AirlinePortalFlightsPage />} />
              <Route path="airline-portal/bookings" element={<AirlinePortalBookingsPage />} />
              <Route path="airline-portal/ground" element={<AirlinePortalGroundPage />} />
              <Route path="airline-portal/agreements" element={<AirlinePortalAgreementsPage />} />
              <Route path="airline-portal/settlements" element={<AirlinePortalSettlementsPage />} />
              <Route path="airline-portal/reports" element={<AirlinePortalReportsPage />} />
            </Route>

            {/* Ground Provider Portal — its own chrome, outside the customer Layout */}
            <Route path="ground-portal/login" element={<GroundPortalLoginPage />} />
            <Route path="ground-portal/queue" element={<GroundPortalQueuePage />} />
            <Route path="ground-portal/airlines" element={<GroundPortalAirlinesPage />} />
            <Route path="ground-portal/agreements" element={<GroundPortalAgreementsPage />} />
            <Route path="ground-portal/reports" element={<GroundPortalReportsPage />} />
            <Route path="ground-portal/settlements" element={<GroundPortalSettlementsPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
