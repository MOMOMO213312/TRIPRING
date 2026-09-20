import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { getAgencyWhatsApp } from "../lib/api";
import i18n from "../i18n";
import { AGENCY_MESSAGE_LANG } from "../lib/constants";
import { usePaymentMethods } from "../lib/payment-config";
import { airlineName, baggageBadgeLabel, formatRoute, stopsMetaLabel } from "../lib/deal-utils";
import { bookTripGo, fetchTripGoBundleById, transferKindLabel, transportUnitsNeeded, tripGoTotal } from "../lib/tripgo";
import { setLastBooking } from "../lib/session";
import { formatTravelerSummary } from "../lib/travelerSummary";
import { cn, formatDate, formatPrice, formatTime, isValidEmail, isValidPhone, whatsAppLink } from "../lib/utils";
import { friendlyErrorMessage } from "../lib/errors";
import { useCatalog } from "../hooks/useCatalog";
import type { PaymentMethod, TripGoBundleJoined } from "../types/database";

type Traveler = {
  full_name: string;
  date_of_birth: string;
  passport_number: string;
  nationality: string;
  traveler_type: "adult" | "child" | "infant";
};

// Step titles live in the i18n `booking` namespace under tripgo.steps.<key>.
const STEPS = [
  { key: "flight", icon: "✈️" },
  { key: "pickup", icon: "📍" },
  { key: "transfer", icon: "🕒" },
  { key: "passengers", icon: "🧑‍🤝‍🧑" },
  { key: "review", icon: "🧾" },
  { key: "payment", icon: "💳" },
] as const;

export function TripGoDetailsPage() {
  const { t } = useTranslation("booking");
  const paymentMethods = usePaymentMethods();
  const { bundleId } = useParams<{ bundleId: string }>();
  const navigate = useNavigate();
  const catalog = useCatalog();

  const [bundle, setBundle] = useState<TripGoBundleJoined | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Pickup + transfer details
  const [pickupLocation, setPickupLocation] = useState("");
  const [pickupArea, setPickupArea] = useState("");
  const [flightNumber, setFlightNumber] = useState("");

  // Passengers
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [travelers, setTravelers] = useState<Traveler[]>([
    { full_name: "", date_of_birth: "", passport_number: "", nationality: "EG", traveler_type: "adult" },
  ]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");

  useEffect(() => {
    if (!bundleId) return;
    setLoading(true);
    fetchTripGoBundleById(bundleId)
      .then((b) => {
        setBundle(b);
        if (!b) {
          setError(t("tripgo.notAvailable"));
          return;
        }
        setFlightNumber(b.deal.flight_number ?? "");
      })
      .catch((e) => setError(friendlyErrorMessage(e, "booking:tripgo.loadFailed", "TripGoDetailsPage.load")))
      .finally(() => setLoading(false));
  }, [bundleId]);

  useEffect(() => {
    setTravelers((prev) => {
      const blank = (traveler_type: Traveler["traveler_type"]): Traveler => ({
        full_name: "",
        date_of_birth: "",
        passport_number: "",
        nationality: "EG",
        traveler_type,
      });
      const byType = (t: Traveler["traveler_type"]) => prev.filter((p) => p.traveler_type === t);
      const resize = (existing: Traveler[], count: number, type: Traveler["traveler_type"]) => {
        if (existing.length === count) return existing;
        if (existing.length > count) return existing.slice(0, count);
        return [...existing, ...Array.from({ length: count - existing.length }, () => blank(type))];
      };
      const next = [
        ...resize(byType("adult"), adults, "adult"),
        ...resize(byType("child"), children, "child"),
        ...resize(byType("infant"), infants, "infant"),
      ];
      return next.length ? next : prev;
    });
  }, [adults, children, infants]);

  const deal = bundle?.deal ?? null;
  const transport = bundle?.tripgo_deal ?? null;
  const currency = deal?.currency ?? "USD";
  const flightSubtotal = deal
    ? deal.price * adults + (deal.child_price ?? deal.price * 0.75) * children + (deal.infant_price ?? deal.price * 0.1) * infants
    : 0;
  const transferPrice = bundle?.agency_selling_price ?? transport?.price ?? 0;
  const total = tripGoTotal(flightSubtotal, transferPrice);
  const unitsNeeded = transport ? transportUnitsNeeded(transport.transport_type, adults, children) : 0;

  function stepError(): string | null {
    if (STEPS[step].key === "pickup") {
      if (!pickupLocation.trim()) return t("tripgo.validation.pickup");
    }
    if (STEPS[step].key === "passengers") {
      if (!customerName.trim()) return t("tripgo.validation.name");
      if (!isValidPhone(customerPhone)) return t("page.validation.phoneInvalid");
      if (customerEmail.trim() && !isValidEmail(customerEmail)) return t("page.validation.emailInvalid");
      const emptyTraveler = travelers.findIndex((t) => !t.full_name.trim());
      if (emptyTraveler !== -1) return t("tripgo.validation.traveler", { n: emptyTraveler + 1 });
      if (transport && transport.capacity_available < unitsNeeded) {
        return transport.transport_type === "private"
          ? t("tripgo.validation.noCar")
          : t("tripgo.validation.seatsFewer", { available: transport.capacity_available, needed: unitsNeeded });
      }
    }
    return null;
  }

  function goNext() {
    const err = stepError();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault();
    if (!bundle || !deal) return;

    setSubmitting(true);
    setError(null);

    try {
      const fresh = await fetchTripGoBundleById(bundle.id);
      if (!fresh) {
        setError(t("tripgo.confirmGone"));
        setSubmitting(false);
        return;
      }
      setBundle(fresh);
    } catch {
      // Best-effort — DB-level checks inside create_tripgo_booking remain the source of truth.
    }

    try {
      const travelerPayload = travelers.map((t) => ({
        full_name: t.full_name,
        date_of_birth: t.date_of_birth || null,
        passport_number: t.passport_number || null,
        nationality: t.nationality || null,
        traveler_type: t.traveler_type,
      }));

      const result = await bookTripGo({
        dealId: deal.id,
        tripGoBundleId: bundle.id,
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        adultsCount: adults,
        childrenCount: children,
        infantsCount: infants,
        paymentMethod,
        travelers: travelerPayload,
      });
      setLastBooking(String(result.booking_number), customerPhone || customerEmail || "");
      navigate("/confirmation", {
        state: {
          booking: result,
          deal,
          paymentMethod,
          travelers,
          customerName,
          customerPhone,
          customerEmail,
          adults,
          children,
          infants,
          tripGo: {
            pickupLocation,
            pickupArea,
            flightNumber,
            transport,
          },
        },
      });
    } catch (err) {
      setError(friendlyErrorMessage(err, "booking:tripgo.createFailed", "TripGoDetailsPage.createBooking"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || catalog.loading) return <p className="text-slate-500">{t("f.loading")}</p>;
  if (!bundle || !deal || !transport) {
    return (
      <Card className="text-center">
        <p className="text-red-600">{error ?? t("tripgo.notFound")}</p>
        <Link to="/tripgo" className="mt-4 inline-block text-[#0C7BB3]">
          {t("tripgo.backTo")}
        </Link>
      </Card>
    );
  }
  if (deal.available_seats <= 0 || transport.capacity_available <= 0) {
    return <Card className="text-center text-slate-700">{t("tripgo.unavailableNow")}</Card>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="flex items-center gap-1.5 text-xs font-bold text-[#0C7BB3]">🚐 TripGo</p>
        <h1 className="text-2xl font-bold text-slate-900">{formatRoute(deal)}</h1>
        <p className="text-slate-600">{t("tripgo.ticketPlusTransfer")}</p>
      </div>

      {/* Stepper */}
      <div className="-mx-1 flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex shrink-0 items-center gap-1">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-xs font-bold transition",
                i === step
                  ? "bg-[#0C7BB3] text-white"
                  : i < step
                    ? "bg-[#16A34A] text-white"
                    : "bg-slate-100 text-slate-400",
              )}
            >
              {i < step ? "✓" : s.icon}
            </div>
            {i < STEPS.length - 1 ? (
              <span className={cn("h-0.5 w-4", i < step ? "bg-[#16A34A]" : "bg-slate-200")} />
            ) : null}
          </div>
        ))}
      </div>
      <p className="-mt-3 text-sm font-bold text-slate-700">
        {step + 1}. {t(`tripgo.steps.${STEPS[step].key}`)}
      </p>

      <form onSubmit={handleConfirm}>
        {STEPS[step].key === "flight" ? (
          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-latin text-lg font-extrabold text-slate-900">{deal.from_airport}</span>
              <span className="mx-2 h-px flex-1 bg-slate-200" />
              <span className="font-latin text-lg font-extrabold text-slate-900">{deal.to_airport}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-latin font-bold">{formatTime(deal.departure_time)}</span>
              <span className="text-slate-400">→</span>
              <span className="font-latin font-bold">{formatTime(deal.arrival_time)}</span>
            </div>
            <dl className="space-y-2 text-sm">
              <Row label={t("f.date")} value={formatDate(deal.departure_date)} />
              <Row label={t("tripgo.flight.airline")} value={airlineName(deal.airline_code, catalog.airlines)} />
              <Row label={t("tripgo.flight.stops")} value={stopsMetaLabel(deal.stops)} />
              {deal.duration_hours ? <Row label={t("tripgo.flight.duration")} value={t("tripgo.flight.durationValue", { hours: deal.duration_hours })} /> : null}
              {baggageBadgeLabel(deal) ? <Row label={t("deal.f.baggage")} value={baggageBadgeLabel(deal)!} /> : null}
            </dl>
            <div className="flex items-center justify-between rounded-xl border border-[#16A34A]/25 bg-[#F0FDF4] p-3 text-sm font-bold text-[#16A34A]">
              <span>{t("tripgo.flight.transferIncluded")}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs shadow-sm">
                {transferKindLabel(transport.transport_type, transport.vehicle_type)}
              </span>
            </div>
          </Card>
        ) : null}

        {STEPS[step].key === "pickup" ? (
          <Card className="space-y-4">
            <p className="text-sm text-slate-600">{t("tripgo.pickup.intro")}</p>
            <Input
              label={t("tripgo.pickup.addressLabel")}
              required
              placeholder={t("tripgo.pickup.addressPlaceholder")}
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
            />
            <Input
              label={t("tripgo.pickup.areaLabel")}
              placeholder={t("tripgo.pickup.areaPlaceholder")}
              value={pickupArea}
              onChange={(e) => setPickupArea(e.target.value)}
            />
          </Card>
        ) : null}

        {STEPS[step].key === "transfer" ? (
          <Card className="space-y-4">
            <p className="text-sm text-slate-600">{t("tripgo.transfer.intro")}</p>
            <Input
              label={t("tripgo.transfer.flightLabel")}
              placeholder={t("tripgo.transfer.flightPlaceholder")}
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value)}
            />
            <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <p className="flex items-center gap-1.5 font-semibold">
                <span aria-hidden>🚐</span> {t("tripgo.transfer.toAirport", { pickup: pickupLocation || t("tripgo.transfer.yourAddress") })}
              </p>
              <p className="flex items-center gap-1.5 font-semibold">
                <span aria-hidden>🚐</span>{" "}
                {t("tripgo.transfer.fromAirport", { city: catalog.airports.find((a) => a.code === deal.to_airport)?.city ?? deal.to_airport })}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <span aria-hidden>ℹ️</span>{" "}
                {t("tripgo.transfer.kindLine", { kind: transferKindLabel(transport.transport_type, transport.vehicle_type) })}
                {transport.pickup_time ? t("tripgo.transfer.pickupTime", { time: formatTime(transport.pickup_time) }) : ""}
              </p>
            </div>
          </Card>
        ) : null}

        {STEPS[step].key === "passengers" ? (
          <Card className="space-y-4">
            <Input label={t("f.fullName")} required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <Input
              label={t("f.phone")}
              required
              type="tel"
              placeholder={t("f.phonePlaceholder")}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
            <Input label={t("f.email")} type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            <div className="grid grid-cols-3 gap-3">
              <Input label={t("f.adults")} type="number" min={1} value={adults} onChange={(e) => setAdults(Number(e.target.value))} />
              <Input label={t("f.children")} type="number" min={0} value={children} onChange={(e) => setChildren(Number(e.target.value))} />
              <Input label={t("f.infants")} type="number" min={0} value={infants} onChange={(e) => setInfants(Number(e.target.value))} />
            </div>
            {transport.transport_type === "shared" ? (
              <p className="text-xs text-slate-500">
                {t("tripgo.passengers.seatsInTransport", { count: transport.capacity_available })}
              </p>
            ) : null}
            <div className="space-y-3 border-t border-slate-100 pt-4">
              {travelers.map((tr, i) => (
                <div key={i} className="space-y-3 rounded-lg border border-slate-100 p-3">
                  <p className="text-sm font-medium text-slate-600">
                    {t("traveler.heading", { n: i + 1, type: t(`traveler.${tr.traveler_type}`) })}
                  </p>
                  <Input
                    label={t("f.passportName")}
                    required
                    value={tr.full_name}
                    onChange={(e) => {
                      const next = [...travelers];
                      next[i] = { ...next[i], full_name: e.target.value };
                      setTravelers(next);
                    }}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label={t("f.dob")}
                      type="date"
                      value={tr.date_of_birth}
                      onChange={(e) => {
                        const next = [...travelers];
                        next[i] = { ...next[i], date_of_birth: e.target.value };
                        setTravelers(next);
                      }}
                    />
                    <Input
                      label={t("f.passportNumber")}
                      value={tr.passport_number}
                      onChange={(e) => {
                        const next = [...travelers];
                        next[i] = { ...next[i], passport_number: e.target.value };
                        setTravelers(next);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {STEPS[step].key === "review" ? (
          <Card className="space-y-4">
            <h2 className="font-bold text-slate-900">{t("tripgo.review.title")}</h2>
            <dl className="space-y-2 text-sm">
              <Row label={t("f.route")} value={formatRoute(deal)} />
              <Row label={t("f.date")} value={formatDate(deal.departure_date)} />
              <Row label={t("f.travelers")} value={formatTravelerSummary(adults, children, infants)} />
              <Row label={t("f.pickupLocation")} value={pickupLocation || "—"} />
              <Row
                label={t("f.transportKind")}
                value={`${transferKindLabel(transport.transport_type, transport.vehicle_type)} — ${formatPrice(transferPrice, currency)}`}
              />
            </dl>
            <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t("tripgo.review.flightTicket")}</span>
                <span className="font-latin">{formatPrice(flightSubtotal, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t("tripgo.review.transfer")}</span>
                <span className="font-latin">{formatPrice(transferPrice, currency)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-bold">
                <span>{t("tripgo.review.total")}</span>
                <span className="font-latin text-[#0C7BB3]">{formatPrice(total, currency)}</span>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {t("tripgo.review.estimateWarning")}
            </div>
          </Card>
        ) : null}

        {STEPS[step].key === "payment" ? (
          <Card className="space-y-4">
            <p className="text-sm text-slate-600">{t("tripgo.payment.manual")}</p>
            {paymentMethods.map((pm) => (
              <label
                key={pm.value}
                className={cn(
                  "block cursor-pointer rounded-xl border p-4",
                  paymentMethod === pm.value ? "border-accent bg-[#E5F4FB]" : "border-slate-200",
                )}
              >
                <input
                  type="radio"
                  name="payment"
                  value={pm.value}
                  checked={paymentMethod === pm.value}
                  onChange={() => setPaymentMethod(pm.value)}
                  className="me-2"
                />
                <span className="font-semibold">{pm.label}</span>
                <p className="mt-1 text-sm text-slate-600">{pm.details}</p>
              </label>
            ))}
            <div className="flex items-center justify-between rounded-xl bg-[#0C7BB3]/5 px-4 py-3">
              <span className="text-sm font-medium text-slate-700">{t("tripgo.review.total")}</span>
              <span className="text-lg font-extrabold text-[#0C7BB3]">{formatPrice(total, currency)}</span>
            </div>
          </Card>
        ) : null}

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex items-center gap-3">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={goBack}>
              {t("actions.back", { ns: "common" })}
            </Button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <Button type="button" fullWidth onClick={goNext}>
              {t("actions.next", { ns: "common" })}
            </Button>
          ) : (
            <Button type="submit" fullWidth disabled={submitting}>
              {submitting ? t("tripgo.submit.confirming") : t("tripgo.submit.confirm")}
            </Button>
          )}
        </div>
      </form>

      {step === STEPS.length - 1 ? (
        <a
          href={whatsAppLink(
            getAgencyWhatsApp(deal, catalog.agencies),
            i18n.t("booking:whatsapp.tripgoConfirm", {
              lng: AGENCY_MESSAGE_LANG,
              route: formatRoute(deal),
              pickup: pickupLocation || "—",
              transport: transferKindLabel(transport.transport_type, transport.vehicle_type, AGENCY_MESSAGE_LANG),
            }),
          )}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-xs font-semibold text-slate-500 hover:text-[#0C7BB3]"
        >
          {t("tripgo.whatsappHelp")}
        </a>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}
