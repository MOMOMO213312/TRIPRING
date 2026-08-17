import { BrowserRouter, Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { AffiliateDashboardPage } from "./pages/AffiliateDashboardPage";
import { AgencyDashboardPage } from "./pages/AgencyDashboardPage";
import { BlueFridayPage } from "./pages/BlueFridayPage";
import { AlertsPage } from "./pages/AlertsPage";
import { BookingPage } from "./pages/BookingPage";
import { ConfirmationPage } from "./pages/ConfirmationPage";
import { DealDetailPage } from "./pages/DealDetailPage";
import { DealsCenterPage } from "./pages/DealsCenterPage";
import { FaqPage } from "./pages/FaqPage";
import { HomePage } from "./pages/HomePage";
import { MyTripsPage } from "./pages/MyTripsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { SearchResultsPage } from "./pages/SearchResultsPage";
import { TermsPage } from "./pages/TermsPage";
import { TicketResalePage } from "./pages/TicketResalePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="search" element={<SearchResultsPage />} />
          <Route path="deals" element={<DealsCenterPage />} />
          <Route path="blue-friday" element={<BlueFridayPage />} />
          <Route path="deals/:dealId" element={<DealDetailPage />} />
          <Route path="book/:dealId" element={<BookingPage />} />
          <Route path="confirmation" element={<ConfirmationPage />} />
          <Route path="my-trips" element={<MyTripsPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="resale" element={<TicketResalePage />} />
          <Route path="agency" element={<AgencyDashboardPage />} />
          <Route path="affiliate" element={<AffiliateDashboardPage />} />
          <Route path="faq" element={<FaqPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
