import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";

import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/EmptyState";
import { Input } from "../components/ui/Input";
import { JourneyPanel } from "../components/JourneyPanel";
import { AddServicesToTrip } from "../components/AddServicesToTrip";
import { PaymentProofUpload } from "../components/PaymentProofUpload";
import { lookupBooking } from "../lib/api";
import { paymentMethodLabel } from "../lib/payment-config";
import { setSessionContact } from "../lib/session";
import { formatDate, formatPrice } from "../lib/utils";
import { airlineName, airportLabel } from "../lib/deal-utils";
import { friendlyErrorMessage } from "../lib/errors";
import { useCatalog } from "../hooks/useCatalog";
import type { BookingLookupResult, BookingServiceStatus } from "../types/database";

function serviceStatusTone(status: BookingServiceStatus): "default" | "flash" | "empty_seat" | "urgent" {
  if (status === "confirmed_with_supplier") return "empty_seat";
  if (status === "failed") return "urgent";
  if (status === "refunded") return "default";
  return "flash"; // pending_confirmation
}

type PrefillState = { bookingNumber?: string; contact?: string; autoSearch?: boolean };

export function MyTripsPage() {
  const { t } = useTranslation("booking");
  const catalog = useCatalog();
  const location = useLocation();
  const prefill = (location.state as PrefillState | null) ?? null;
  const [bookingNumber, setBookingNumber] = useState(prefill?.bookingNumber ?? "");
  const [contact, setContact] = useState(prefill?.contact ?? "");
  const [booking, setBooking] = useState<BookingLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function runSearch(num: string, contactValue: string) {
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const result = await lookupBooking(num, contactValue);
      setBooking(result);
      if (result) setSessionContact(contactValue);
      if (!result) setError(t("myTrips.notFound"));
    } catch (err) {
      setError(friendlyErrorMessage(err, "booking:myTrips.searchFailed", "MyTripsPage.search"));
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }

  // Coming from ConfirmationPage after a page refresh: run the lookup
  // automatically instead of making the user retype what they just entered.
  useEffect(() => {
    if (prefill?.autoSearch && prefill.bookingNumber && prefill.contact) {
      runSearch(prefill.bookingNumber, prefill.contact);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    await runSearch(bookingNumber, contact);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("myTrips.title")}</h1>
        <p className="text-slate-600">{t("myTrips.subtitle")}</p>
      </div>

      <Card>
        <form onSubmit={handleSearch} className="space-y-4">
          <Input
            label={t("myTrips.bookingNumber")}
            required
            value={bookingNumber}
            onChange={(e) => setBookingNumber(e.target.value)}
            placeholder={t("myTrips.bookingNumberPlaceholder")}
          />
          <Input
            label={t("myTrips.contact")}
            required
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? t("myTrips.searching") : t("myTrips.search")}
          </Button>
        </form>
      </Card>

      {error ? <Card className="text-red-600">{error}</Card> : null}

      {booking ? (
        <Card>
          <h2 className="mb-4 font-bold">{t("myTrips.details")}</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">{t("myTrips.bookingNumber")}</dt>
              <dd className="font-bold">{booking.booking_number}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">{t("myTrips.status")}</dt>
              <dd>{t(`myTrips.bookingStatus.${booking.status}`, { defaultValue: booking.status })}</dd>
            </div>
            {booking.deal ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">{t("myTrips.trip")}</dt>
                <dd>
                  {!catalog.loading
                    ? `${airportLabel(booking.deal.from_airport, catalog.airports)} → ${airportLabel(booking.deal.to_airport, catalog.airports)}`
                    : `${booking.deal.from_airport} → ${booking.deal.to_airport}`}
                </dd>
              </div>
            ) : null}
            {booking.deal ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">{t("myTrips.travelDate")}</dt>
                <dd>{formatDate(booking.deal.departure_date)}</dd>
              </div>
            ) : null}
            {booking.deal?.airline_code ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">{t("myTrips.airline")}</dt>
                <dd>{!catalog.loading ? airlineName(booking.deal.airline_code, catalog.airlines) : booking.deal.airline_code}</dd>
              </div>
            ) : null}
            {booking.total_price ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">{t("myTrips.amount")}</dt>
                <dd>{formatPrice(booking.total_price, booking.currency)}</dd>
              </div>
            ) : null}
            {booking.payment_method ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">{t("myTrips.paymentMethod")}</dt>
                <dd>{paymentMethodLabel(booking.payment_method)}</dd>
              </div>
            ) : null}
          </dl>
          {booking.travelers.length > 0 ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">{t("myTrips.travelers")}</p>
              <ul className="space-y-1 text-sm text-slate-600">
                {booking.travelers.map((trv, i) => (
                  <li key={i}>{trv.full_name}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {booking.journey ? <JourneyPanel journey={booking.journey} currency={booking.currency} /> : null}
          {/* Legacy per-service view. Kept while booking_services remains the
              source of truth for the airline-confirmation status, which the
              orchestration layer does not yet model. */}
          {booking.services.length > 0 ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-medium text-slate-700">{t("myTrips.extraServices")}</p>
              <p className="mb-2 text-xs text-slate-400">
                {t("myTrips.extraServicesNote")}
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                {booking.services.map((s, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-1">
                    <span>{s.name} × {s.quantity}</span>
                    <div className="flex items-center gap-2">
                      <span>{formatPrice(s.unit_price * s.quantity, booking.currency)}</span>
                      <Badge tone={serviceStatusTone(s.status)}>{t(`myTrips.serviceStatus.${s.status}`, { defaultValue: s.status })}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {booking.status !== "cancelled" &&
          (!booking.deal?.departure_date || booking.deal.departure_date >= new Date().toISOString().slice(0, 10)) ? (
            <AddServicesToTrip
              bookingNumber={String(booking.booking_number)}
              contact={contact}
              currency={booking.currency}
              bookingStatus={booking.status}
              existingServiceNames={booking.services.map((s) => s.name)}
              onAdded={() => runSearch(bookingNumber, contact)}
            />
          ) : null}
          {booking.status === "ticket_issued" && booking.ticket_url ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <a
                href={booking.ticket_url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg bg-[#0C7BB3] py-2.5 text-center text-sm font-semibold text-white"
              >
                {t("myTrips.viewTicket")}
              </a>
            </div>
          ) : null}
          {!["paid", "ticket_issued", "cancelled"].includes(booking.status) ? (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <PaymentProofUpload
                bookingNumber={String(booking.booking_number)}
                contact={contact}
                onUploaded={() => runSearch(bookingNumber, contact)}
              />
            </div>
          ) : null}
        </Card>
      ) : searched && !error && !loading ? (
        <EmptyState icon="🎫" title={t("myTrips.emptyTitle")} subtitle={t("myTrips.emptySubtitle")} />
      ) : null}
    </div>
  );
}
