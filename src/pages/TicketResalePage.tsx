import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { AuthGate } from "../components/AuthGate";
import { EmptyState } from "../components/EmptyState";
import { CardsSkeleton } from "../components/LoadingSkeleton";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { createTicketResale, fetchActiveTicketResales, type PublicTicketResaleRow } from "../lib/api";
import { PLATFORM_WHATSAPP } from "../lib/constants";
import { airlineName, airportLabel } from "../lib/deal-utils";
import { friendlyErrorMessage } from "../lib/errors";
import { useCatalog } from "../hooks/useCatalog";
import { formatDate, whatsAppLink, WhatsAppIcon } from "../lib/utils";
import type { ResaleReason } from "../types/database";
import { useCurrency } from "../hooks/useCurrency";

const RESALE_REASONS: ResaleReason[] = ["non_refundable", "trip_cancelled", "date_change", "duplicate_booking", "other"];

function ResaleCard({ resale, catalog }: { resale: PublicTicketResaleRow; catalog: ReturnType<typeof useCatalog> }) {
  const { fmt } = useCurrency();
  const { t } = useTranslation("resale");
  // The message goes to the TripRing team's WhatsApp, so it is always written in Arabic
  // (same convention as the booking confirmation message).
  const waMessage = t("card.waMessage", {
    lng: "ar",
    from: resale.from_airport,
    to: resale.to_airport,
    date: resale.departure_date,
    price: fmt(resale.asking_price, resale.currency),
  });
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900">
            {airportLabel(resale.from_airport, catalog.airports)} → {airportLabel(resale.to_airport, catalog.airports)}
          </p>
          <p className="text-sm text-slate-600">{formatDate(resale.departure_date)}</p>
        </div>
        <Badge tone="savings">{t("card.verified")}</Badge>
      </div>

      {resale.airline_code ? (
        <p className="text-sm text-slate-600">{airlineName(resale.airline_code, catalog.airlines)}</p>
      ) : null}

      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-extrabold text-slate-900">{fmt(resale.asking_price, resale.currency)}</p>
      </div>

      <a
        href={whatsAppLink(PLATFORM_WHATSAPP, waMessage)}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1da851]"
      >
        <WhatsAppIcon className="size-4" />
        {t("card.interested")}
      </a>
    </Card>
  );
}

function ListTicketForm({ onPosted }: { onPosted: () => void }) {
  const { t } = useTranslation("resale");
  const catalog = useCatalog();
  const [formFrom, setFormFrom] = useState("");
  const [formTo, setFormTo] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [airlineCode, setAirlineCode] = useState("");
  const [passengerName, setPassengerName] = useState("");
  const [pnrReference, setPnrReference] = useState("");
  const [reason, setReason] = useState<ResaleReason>("other");
  const [originalPrice, setOriginalPrice] = useState(0);
  const [askingPrice, setAskingPrice] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const airportOptions = [
    { value: "", label: t("form.choose") },
    ...catalog.airports.map((a) => ({ value: a.code, label: airportLabel(a.code, catalog.airports) })),
  ];
  const reasonOptions = RESALE_REASONS.map((value) => ({ value, label: t(`reason.${value}`) }));
  const airlineOptions = [
    { value: "", label: t("form.unspecified") },
    ...catalog.airlines.map((a) => ({ value: a.code, label: a.name })),
  ];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formFrom || !formTo || !departureDate || !passengerName || !pnrReference || !originalPrice || !askingPrice) {
      setSubmitError(t("form.required"));
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createTicketResale({
        airlineCode,
        fromAirport: formFrom,
        toAirport: formTo,
        departureDate,
        returnDate,
        passengerName,
        pnrReference,
        reason,
        originalPrice,
        askingPrice,
      });
      onPosted();
    } catch (err) {
      setSubmitError(friendlyErrorMessage(err, "resale:form.submitFailed", "TicketResalePage.submit"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-4 font-bold">{t("form.title")}</h2>
      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t("form.from")}
          required
          value={formFrom}
          onChange={(e) => setFormFrom(e.target.value)}
          options={airportOptions}
          placeholder={t("form.fromPlaceholder")}
        />
        <Select
          label={t("form.to")}
          required
          value={formTo}
          onChange={(e) => setFormTo(e.target.value)}
          options={airportOptions}
          placeholder={t("form.toPlaceholder")}
        />
        <Input
          label={t("form.departureDate")}
          type="date"
          required
          value={departureDate}
          onChange={(e) => setDepartureDate(e.target.value)}
        />
        <Input
          label={t("form.returnDate")}
          type="date"
          value={returnDate}
          onChange={(e) => setReturnDate(e.target.value)}
        />
        <Select
          label={t("form.airline")}
          value={airlineCode}
          onChange={(e) => setAirlineCode(e.target.value)}
          options={airlineOptions}
        />
        <Select
          label={t("form.reason")}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value as ResaleReason)}
          options={reasonOptions}
        />
        <Input
          label={t("form.passengerName")}
          required
          value={passengerName}
          onChange={(e) => setPassengerName(e.target.value)}
        />
        <Input
          label={t("form.pnr")}
          required
          value={pnrReference}
          onChange={(e) => setPnrReference(e.target.value)}
        />
        <Input
          label={t("form.originalPrice")}
          type="number"
          min={1}
          required
          value={originalPrice || ""}
          onChange={(e) => setOriginalPrice(Number(e.target.value))}
        />
        <Input
          label={t("form.askingPrice")}
          type="number"
          min={1}
          required
          value={askingPrice || ""}
          onChange={(e) => setAskingPrice(Number(e.target.value))}
        />
        <p className="sm:col-span-2 text-xs text-slate-500">
          {t("form.reviewNote")}
        </p>
        {submitError ? <p className="sm:col-span-2 text-sm text-red-600">{submitError}</p> : null}
        <div className="sm:col-span-2">
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? t("form.submitting") : t("form.submit")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function TicketResalePage() {
  const { t } = useTranslation("resale");
  const catalog = useCatalog();
  const [resales, setResales] = useState<PublicTicketResaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function loadResales() {
    setLoading(true);
    fetchActiveTicketResales({ from: from || undefined, to: to || undefined })
      .then(setResales)
      .catch((e) => setError(friendlyErrorMessage(e, "resale:page.loadFailed", "TicketResalePage.load")))
      .finally(() => setLoading(false));
  }

  useEffect(loadResales, [from, to]);

  const airportOptions = [
    { value: "", label: t("page.all") },
    ...catalog.airports.map((a) => ({ value: a.code, label: airportLabel(a.code, catalog.airports) })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("page.title")}</h1>
          <p className="text-slate-600">{t("page.subtitle")}</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? t("common:actions.close") : t("page.listCta")}</Button>
      </div>

      {showForm ? (
        <AuthGate
          title={t("page.authTitle")}
          description={t("page.authDescription")}
        >
          {() =>
            submitted ? (
              <Card className="text-green-700">{t("page.received")}</Card>
            ) : (
              <ListTicketForm
                onPosted={() => {
                  setSubmitted(true);
                  setShowForm(false);
                  loadResales();
                }}
              />
            )
          }
        </AuthGate>
      ) : null}

      <div className="flex flex-wrap gap-4">
        <Select label={t("page.filterFrom")} value={from} onChange={(e) => setFrom(e.target.value)} options={airportOptions} className="max-w-xs" />
        <Select label={t("page.filterTo")} value={to} onChange={(e) => setTo(e.target.value)} options={airportOptions} className="max-w-xs" />
      </div>

      {loading ? (
        <CardsSkeleton count={3} />
      ) : error ? (
        <Card className="text-red-600">{error}</Card>
      ) : resales.length === 0 ? (
        <EmptyState
          icon="🎟️"
          title={t("page.emptyTitle")}
          subtitle={t("page.emptySubtitle")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resales.map((r) => (
            <ResaleCard key={r.id} resale={r} catalog={catalog} />
          ))}
        </div>
      )}
    </div>
  );
}
