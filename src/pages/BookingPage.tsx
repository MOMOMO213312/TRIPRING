import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import {
  createBooking,
  fetchAdditionalServices,
  fetchDealById,
  fetchPaymentMethods,
} from "../lib/api";
import { roundTo } from "../lib/currency";
import { useCurrency } from "../hooks/useCurrency";
import { usePaymentMethods } from "../lib/payment-config";
import { formatRoute, hasPriceBreakdown } from "../lib/deal-utils";
import { classifyService, dedupeByKey, packagePrice, usePackageOptions } from "../lib/packages";
import type { PackageTier, ServiceKey } from "../lib/packages";
import { RECOMMENDED_SERVICE_KEYS, serviceDisplayLabel } from "../lib/servicePackages";
import { friendlyErrorMessage } from "../lib/errors";
import { fetchZonesForDeal } from "../lib/tripgo";
import { setLastBooking } from "../lib/session";
import { isValidEmail, isValidPhone } from "../lib/utils";
import { authErrorMessage, signInWithEmail, signUpWithEmail, useAuth } from "../lib/auth";
import type { AdditionalServiceRow, DealRow, PaymentMethod, TransportZoneRow } from "../types/database";

type DealSelectionState = {
  selectedPackage?: PackageTier;
  selectedServiceIds?: string[];
};

type Traveler = {
  full_name: string;
  date_of_birth: string;
  passport_number: string;
  nationality: string;
  traveler_type: "adult" | "child" | "infant";
};

export function BookingPage() {
  const { t } = useTranslation("booking");
  const paymentMethods = usePaymentMethods();
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const incomingSelection = (location.state as DealSelectionState | null) ?? null;
  const [deal, setDeal] = useState<DealRow | null>(null);
  const [services, setServices] = useState<AdditionalServiceRow[]>([]);
  const [selectedServices, setSelectedServices] = useState<Record<string, number>>({});
  const [selectedPackage] = useState<PackageTier | null>(incomingSelection?.selectedPackage ?? null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const [transportZones, setTransportZones] = useState<TransportZoneRow[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");

  // Optional account creation at checkout — never blocks the booking itself.
  // See "account existsPrompt" state: if the email the customer typed already
  // has an account, we don't try to guess their password — we stop and ask
  // them to log in instead, since that's the case where they're most likely
  // an existing subscriber checking out as a guest.
  const { user, loading: authLoading } = useAuth();
  const [wantAccount, setWantAccount] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountExistsPrompt, setAccountExistsPrompt] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [accountCreatedNotice, setAccountCreatedNotice] = useState(false);
  const packageOptions = usePackageOptions();

  // ── Currency ────────────────────────────────────────────────────────────────
  // Three different currencies can be in play: the deal's own (all server math), the visitor's display currency
  // (what they browse in) and the currency they PAY in (must be one the payment side can collect — see
  // currencies.is_chargeable). Totals below are computed in the deal's currency exactly like the server does
  // (create_booking converts every service/zone into the deal's currency), then only *displayed* converted.
  const { fmt, fmtIn, currencies, currency: displayCurrency, convertTo, estimate, rates } = useCurrency();
  const dealCur = deal?.currency ?? "USD";
  const chargeableCurrencies = currencies.filter((c) => c.is_chargeable);
  const autoChargeCurrency =
    chargeableCurrencies.find((c) => c.code === displayCurrency)?.code ??
    chargeableCurrencies.find((c) => c.code === dealCur)?.code ??
    "USD";
  const [chargeChoice, setChargeChoice] = useState<string | null>(null);
  const chargeCurrency =
    chargeChoice && chargeableCurrencies.some((c) => c.code === chargeChoice) ? chargeChoice : autoChargeCurrency;
  const [methodCodes, setMethodCodes] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPaymentMethods(chargeCurrency)
      .then((rows) => {
        if (!cancelled) setMethodCodes(rows.map((r) => r.code));
      })
      // Catalog unreachable: show every method rather than none — the server still validates the choice at submit.
      .catch(() => {
        if (!cancelled) setMethodCodes(null);
      });
    return () => {
      cancelled = true;
    };
  }, [chargeCurrency]);

  const availableMethods = paymentMethods.filter((pm) => !methodCodes || methodCodes.includes(pm.value));
  useEffect(() => {
    if (availableMethods.length > 0 && !availableMethods.some((pm) => pm.value === paymentMethod)) {
      setPaymentMethod(availableMethods[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodCodes]);

  /** Amount priced in `from` → the deal's currency, rounded like the server's convert_currency(). */
  function inDealCurrency(amount: number, from: string): number {
    const converted = convertTo(amount, from, dealCur);
    return converted == null ? amount : roundTo(converted, rates[dealCur]?.decimals ?? 2);
  }

  useEffect(() => {
    if (!dealId) return;
    Promise.all([fetchDealById(dealId), fetchAdditionalServices()])
      .then(([d, s]) => {
        setDeal(d);
        setServices(s);
        if (!d) {
          setError(t("booking.error.dealUnavailable"));
          return;
        }
        // Instant TripGo (private-car pickup priced by zone) — only offered
        // when the deal's own agency has configured zones for its departure
        // airport. Silently empty otherwise; this is a bonus add-on, not a
        // blocker on the booking flow.
        if (d.agency_id && d.from_airport) {
          fetchZonesForDeal(d.agency_id, d.from_airport)
            .then(setTransportZones)
            .catch(() => setTransportZones([]));
        }
        // Pre-check the extra add-on services the customer picked on the deal-detail
        // page. Services already bundled for free inside the chosen package are
        // priced once via packageMarkup() below, not repeated here.
        const carriedIds = incomingSelection?.selectedServiceIds ?? [];
        // Also default-check recommended add-ons (currently: insurance) for
        // customers who land here directly without going through the
        // deal-detail selector, so the opt-in default is consistent everywhere.
        const dedupedForDefaults = dedupeByKey(s);
        const recommendedIds = dedupedForDefaults
          .filter((row) => {
            const key = classifyService(row) as ServiceKey | null;
            return key && (RECOMMENDED_SERVICE_KEYS as string[]).includes(key);
          })
          .map((row) => row.id);
        const idsToCheck = new Set([...carriedIds, ...recommendedIds]);
        if (idsToCheck.size > 0) {
          setSelectedServices((prev) => {
            const next = { ...prev };
            for (const id of idsToCheck) next[id] = next[id] ?? 1;
            return next;
          });
        }
      })
      .catch((e) => {
        console.error("[BookingPage] failed to load deal:", e);
        setError(t("booking.error.loadFailed"));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  // Resize the travelers array to match adults/children/infants counts
  // WITHOUT wiping names already typed for travelers that still exist —
  // only append blank rows for newly added travelers, and trim from the
  // end when a count goes down. Uses functional setState so this effect
  // doesn't need `travelers` in its deps (avoids re-running on every
  // keystroke) while still reading the latest travelers array.
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

  function validate(): string | null {
    if (!customerName.trim()) return t("booking.validation.name");
    if (!customerPhone.trim()) return t("booking.validation.phone");
    if (!isValidPhone(customerPhone)) return t("booking.validation.phoneInvalid");
    if (customerEmail.trim() && !isValidEmail(customerEmail)) return t("booking.validation.emailInvalid");
    const emptyTraveler = travelers.findIndex((trv) => !trv.full_name.trim());
    if (emptyTraveler !== -1) return t("booking.validation.travelerName", { n: emptyTraveler + 1 });
    return null;
  }

  function servicesTotal(): number {
    return services.reduce((sum, s) => {
      const qty = selectedServices[s.id] ?? 0;
      // Service prices carry their own currency (USD by default) — never add them to a deal-currency total raw.
      return sum + inDealCurrency(s.price, s.currency ?? "USD") * qty;
    }, 0);
  }

  function packageMarkup(): number {
    if (!deal || !selectedPackage) return 0;
    const pkg = packageOptions.find((p) => p.id === selectedPackage);
    if (!pkg) return 0;
    return packagePrice(deal.price, pkg) - deal.price;
  }

  function zonePrice(): number {
    if (!selectedZoneId) return 0;
    const zone = transportZones.find((z) => z.id === selectedZoneId);
    return zone ? inDealCurrency(zone.price_addon, zone.currency ?? "EGP") : 0;
  }

  function estimatedTotal(): number {
    if (!deal) return 0;
    // Must mirror the server's handle_new_booking trigger exactly: when a
    // deal has no explicit child/infant price, the server charges the full
    // adult price for a child and nothing for an infant. Using different
    // fallback percentages here (as this used to) shows the customer a
    // lower estimate than what they're actually charged at booking time.
    const base =
      deal.price * adults +
      (deal.child_price ?? deal.price) * children +
      (deal.infant_price ?? 0) * infants;
    return base + packageMarkup() + servicesTotal() + zonePrice();
  }

  async function handleExistingAccountLogin(e: FormEvent) {
    e.preventDefault();
    setAccountError(null);
    setLoginBusy(true);
    try {
      await signInWithEmail(customerEmail, loginPassword);
      setAccountExistsPrompt(false);
      setLoginPassword("");
    } catch (err) {
      setAccountError(authErrorMessage(err));
    } finally {
      setLoginBusy(false);
    }
  }

  // Estimate only — the real amount is total × the rate the server locks when the booking is created.
  const chargeEstimate = deal ? estimate(estimatedTotal(), dealCur, chargeCurrency) : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!deal || !dealId) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    setAccountError(null);
    setAccountExistsPrompt(false);

    // Optional account creation. This never blocks a guest booking — it only
    // runs if the customer ticked the box. If the email already has an
    // account, we don't guess a password: we stop here and ask them to log
    // in (the most likely case is an existing subscriber who forgot they're
    // logged out), then let them press "تأكيد الحجز" again once signed in.
    if (!user && wantAccount) {
      if (!customerEmail.trim() || !isValidEmail(customerEmail)) {
        setError(t("booking.validation.emailInvalid"));
        setSubmitting(false);
        return;
      }
      if (accountPassword.length < 6) {
        setAccountError(t("booking.account.passwordTooShort"));
        setSubmitting(false);
        return;
      }
      try {
        await signUpWithEmail(customerEmail, accountPassword, customerName);
        setAccountCreatedNotice(true);
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        if (raw.includes("User already registered")) {
          setAccountExistsPrompt(true);
          setSubmitting(false);
          return;
        }
        setAccountError(authErrorMessage(err));
        setSubmitting(false);
        return;
      }
    }

    // Traveler details (name, DOB, passport) are the most effortful part of
    // this form, and price/seat data here is only as fresh as whatever the
    // agency last typed in manually off Amadeus — it can go stale between
    // page load and submit. Re-check right before creating the booking so a
    // seat that's gone, or a price the agency changed in the meantime, is
    // caught here with a clear message instead of silently charging a
    // different total than what was shown (the server always charges the
    // live deal price regardless — this is purely so the customer isn't
    // surprised by it).
    try {
      const fresh = await fetchDealById(dealId);
      if (!fresh) {
        setError(t("booking.error.dealGone"));
        setSubmitting(false);
        return;
      }
      const seatsNeeded = adults + children;
      if (fresh.available_seats < seatsNeeded) {
        setError(
          fresh.available_seats <= 0
            ? t("booking.error.soldOutNow")
            : t("booking.error.seatsFewer", { available: fresh.available_seats, needed: seatsNeeded }),
        );
        setDeal(fresh);
        setSubmitting(false);
        return;
      }
      const priceChanged =
        fresh.price !== deal.price ||
        (fresh.child_price ?? null) !== (deal.child_price ?? null) ||
        (fresh.infant_price ?? null) !== (deal.infant_price ?? null);
      if (priceChanged) {
        setDeal(fresh);
        setError(
          t("booking.error.priceChanged", {
            oldPrice: fmt(deal.price, dealCur),
            newPrice: fmt(fresh.price, fresh.currency ?? "USD"),
          }),
        );
        setSubmitting(false);
        return;
      }
      setDeal(fresh);
    } catch {
      // Network/availability check failure shouldn't trap the user — let
      // the booking attempt continue; the DB-level check on submit below is
      // still the source of truth and will block an actually-unavailable
      // booking.
    }

    try {
      const servicePayload = services
        .filter((s) => (selectedServices[s.id] ?? 0) > 0)
        .map((s) => ({
          service_id: s.id,
          quantity: selectedServices[s.id] ?? 1,
          unit_price: s.price,
        }));

      const travelerPayload = travelers.map((t) => ({
        full_name: t.full_name,
        date_of_birth: t.date_of_birth || null,
        passport_number: t.passport_number || null,
        nationality: t.nationality || null,
        traveler_type: t.traveler_type,
      }));

      const result = await createBooking({
        dealId: deal.id,
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        adultsCount: adults,
        childrenCount: children,
        infantsCount: infants,
        paymentMethod,
        travelers: travelerPayload,
        services: servicePayload,
        farePackageTier: selectedPackage,
        transportZoneId: selectedZoneId || undefined,
        dealCurrency: dealCur,
        chargeCurrency,
      });
      setLastBooking(result.booking_number, customerPhone || customerEmail || "");
      navigate("/confirmation", {
        state: {
          booking: result,
          deal,
          paymentMethod,
          travelers,
          services: selectedServices,
          customerName,
          customerPhone,
          customerEmail,
          adults,
          children,
          infants,
        },
      });
    } catch (err) {
      setError(friendlyErrorMessage(err, "booking:booking.error.createFailed", "BookingPage.createBooking"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-slate-500">{t("booking.loading")}</p>;
  if (!deal) {
    return (
      <Card className="text-center text-red-600">{error ?? t("booking.error.notFound")}</Card>
    );
  }
  if (deal.available_seats <= 0) {
    return (
      <Card className="text-center text-slate-700">
        {t("booking.soldOut")}
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("booking.title")}</h1>
        <p className="text-slate-600">{formatRoute(deal)} · {fmt(deal.price, dealCur)}</p>
      </div>

      {/* Single scrollable page instead of a multi-step wizard — every
         section is visible and editable at once so related info (contact,
         travelers, services, payment, totals) stays close together instead
         of being hidden behind "next" clicks. */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="space-y-4">
          <h2 className="font-bold">{t("booking.contact.heading")}</h2>
          <Input label={t("booking.contact.fullName")} required value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <Input
            label={t("booking.contact.phone")}
            required
            type="tel"
            placeholder="+20xxxxxxxxxx"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
          />
          <Input label={t("booking.contact.email")} type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />

          {!authLoading && !user ? (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-3">
              {accountExistsPrompt ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-700">{t("booking.account.existsPrompt")}</p>
                  <Input
                    label={t("booking.account.password")}
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  {accountError ? <p className="text-xs text-red-600">{accountError}</p> : null}
                  <Button type="button" onClick={handleExistingAccountLogin} disabled={loginBusy}>
                    {loginBusy ? t("booking.account.loggingIn") : t("booking.account.login")}
                  </Button>
                </div>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={wantAccount}
                      onChange={(e) => setWantAccount(e.target.checked)}
                    />
                    {t("booking.account.createToggle")}
                  </label>
                  {wantAccount ? (
                    <>
                      <Input
                        label={t("booking.account.password")}
                        type="password"
                        minLength={6}
                        value={accountPassword}
                        onChange={(e) => setAccountPassword(e.target.value)}
                      />
                      {accountError ? <p className="text-xs text-red-600">{accountError}</p> : null}
                      {accountCreatedNotice ? (
                        <p className="text-xs text-green-700">{t("booking.account.createdNotice")}</p>
                      ) : null}
                    </>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-3">
            <Input label={t("booking.contact.adults")} type="number" min={1} value={adults} onChange={(e) => setAdults(Number(e.target.value))} />
            <Input label={t("booking.contact.children")} type="number" min={0} value={children} onChange={(e) => setChildren(Number(e.target.value))} />
            <Input label={t("booking.contact.infants")} type="number" min={0} value={infants} onChange={(e) => setInfants(Number(e.target.value))} />
          </div>
          <div className="space-y-3 border-t border-slate-100 pt-4">
            {travelers.map((trv, i) => (
              <div key={i} className="space-y-3 rounded-lg border border-slate-100 p-3">
                <p className="text-sm font-medium text-slate-600">
                  {t("booking.traveler.title", { n: i + 1, type: t(`booking.traveler.type.${trv.traveler_type}`) })}
                </p>
                <Input
                  label={t("booking.traveler.name")}
                  required
                  value={trv.full_name}
                  onChange={(e) => {
                    const next = [...travelers];
                    next[i] = { ...next[i], full_name: e.target.value };
                    setTravelers(next);
                  }}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label={t("booking.traveler.dob")}
                    type="date"
                    value={trv.date_of_birth}
                    onChange={(e) => {
                      const next = [...travelers];
                      next[i] = { ...next[i], date_of_birth: e.target.value };
                      setTravelers(next);
                    }}
                  />
                  <Input
                    label={t("booking.traveler.passport")}
                    value={trv.passport_number}
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

        {services.length > 0 ? (
          <Card className="space-y-3">
            <h2 className="font-bold">{t("booking.services.heading")}</h2>
            {dedupeByKey(services).map((s) => {
              const key = classifyService(s) as ServiceKey | null;
              const recommended = !!key && (RECOMMENDED_SERVICE_KEYS as string[]).includes(key);
              return (
                <label
                  key={s.id}
                  className={`flex items-center justify-between rounded-lg border p-3 ${recommended ? "border-[#16A34A]/40 bg-[#F0FBF4]" : "border-slate-100"}`}
                >
                  <span className="flex items-center gap-2">
                    {serviceDisplayLabel(s)} — {fmt(s.price, s.currency ?? "USD")}
                    {recommended ? <span className="text-xs font-semibold text-[#16A34A]">{t("booking.services.recommended")}</span> : null}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={selectedServices[s.id] ?? 0}
                    onChange={(e) =>
                      setSelectedServices({ ...selectedServices, [s.id]: Number(e.target.value) })
                    }
                    className="w-16 rounded border border-slate-200 px-2 py-1 text-center"
                  />
                </label>
              );
            })}
          </Card>
        ) : null}

        {transportZones.length > 0 ? (
          <Card className="space-y-3">
            <h2 className="font-bold">{t("booking.tripgo.heading")}</h2>
            <p className="text-sm text-slate-600">{t("booking.tripgo.hint")}</p>
            <div className="space-y-2">
              <label
                className={`block cursor-pointer rounded-xl border p-3 ${
                  selectedZoneId === "" ? "border-accent bg-[#E5F4FB]" : "border-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name="transport_zone"
                  checked={selectedZoneId === ""}
                  onChange={() => setSelectedZoneId("")}
                  className="me-2"
                />
                <span className="font-semibold">{t("booking.tripgo.none")}</span>
              </label>
              {transportZones.map((z) => (
                <label
                  key={z.id}
                  className={`block cursor-pointer rounded-xl border p-3 ${
                    selectedZoneId === z.id ? "border-accent bg-[#E5F4FB]" : "border-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="transport_zone"
                    checked={selectedZoneId === z.id}
                    onChange={() => setSelectedZoneId(z.id)}
                    className="me-2"
                  />
                  <span className="font-semibold">{z.zone_name}</span>
                  <span className="text-slate-600"> — +{fmt(z.price_addon, z.currency)}</span>
                </label>
              ))}
            </div>
          </Card>
        ) : null}

        <Card className="space-y-4">
          <h2 className="font-bold">{t("booking.summary.heading")}</h2>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Trans i18nKey="booking.summary.warning" ns="booking" components={{ b: <strong /> }} />
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">{t("booking.summary.route")}</dt><dd>{formatRoute(deal)}</dd></div>
            {hasPriceBreakdown(deal) ? (
              <>
                <div className="flex justify-between text-xs text-slate-500">
                  <dt>{t("booking.summary.baseFare")}</dt>
                  <dd className="font-latin">{fmt(deal.base_fare!, dealCur)}</dd>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <dt>{t("booking.summary.taxes")}</dt>
                  <dd className="font-latin">{fmt(deal.taxes_fees!, dealCur)}</dd>
                </div>
              </>
            ) : null}
            {selectedPackage ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">{t("booking.summary.package")}</dt>
                <dd className="font-semibold">
                  {packageOptions.find((p) => p.id === selectedPackage)?.label}
                  {" · "}
                  {fmt(packagePrice(deal.price, packageOptions.find((p) => p.id === selectedPackage)!), dealCur)}
                </dd>
              </div>
            ) : null}
            {selectedZoneId ? (
              <div className="flex justify-between">
                <dt className="text-slate-500">{t("booking.summary.transfer")}</dt>
                <dd className="font-semibold">
                  {transportZones.find((z) => z.id === selectedZoneId)?.zone_name} ·{" "}
                  {fmt(zonePrice(), dealCur)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between"><dt className="text-slate-500">{t("booking.summary.travelers")}</dt><dd>{t("booking.summary.travelersValue", { adults, children, infants })}</dd></div>
            <div className="flex justify-between border-t border-slate-100 pt-2 font-bold">
              <dt>{t("page.summary.estimatedTotalBeforeDiscount")}</dt>
              <dd className="font-latin">{fmt(estimatedTotal(), dealCur)}</dd>
            </div>
          </dl>
          {chargeableCurrencies.length > 1 ? (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-700">{t("page.payIn")}</p>
              <div className="flex flex-wrap gap-2">
                {chargeableCurrencies.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setChargeChoice(c.code)}
                    className={`rounded-full border px-4 py-1.5 text-sm ${
                      chargeCurrency === c.code
                        ? "border-accent bg-[#E5F4FB] font-semibold text-[#0C7BB3]"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {c.name_ar} <span className="font-latin text-xs">({c.code})</span>
                  </button>
                ))}
              </div>
              {chargeCurrency !== dealCur && chargeEstimate != null ? (
                <p className="text-sm text-slate-600">
                  <Trans
                    t={t}
                    i18nKey="page.chargeEstimate"
                    values={{ amount: fmtIn(chargeEstimate, chargeCurrency, true) }}
                    components={{ amount: <span className="font-latin font-bold" /> }}
                  />
                </p>
              ) : null}
              {displayCurrency !== chargeCurrency && !chargeableCurrencies.some((c) => c.code === displayCurrency) ? (
                <p className="text-xs text-slate-400">
                  {t("page.chargeUnavailable", { currency: displayCurrency })}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">{t("booking.payment.note")}</p>
            {availableMethods.map((pm) => (
              <label
                key={pm.value}
                className={`block cursor-pointer rounded-xl border p-4 ${
                  paymentMethod === pm.value ? "border-accent bg-[#E5F4FB]" : "border-slate-200"
                }`}
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
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? t("booking.submitting") : t("booking.submit")}
          </Button>
        </Card>
      </form>
    </div>
  );
}
