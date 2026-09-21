import type { FormEvent } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { createPriceAlert, lookupPriceAlerts } from "../lib/api";
import { setSessionContact } from "../lib/session";
import { airportLabel } from "../lib/deal-utils";
import { friendlyErrorMessage } from "../lib/errors";
import { useCatalog } from "../hooks/useCatalog";
import { isValidEmail, isValidPhone } from "../lib/utils";
import { useCurrency } from "../hooks/useCurrency";

export function AlertsPage() {
  const { t } = useTranslation("alerts");
  const { fmt, currency: displayCurrency, usdToDisplay } = useCurrency();
  // Budget is typed in the display currency (stored with the alert); if there is no rate for it, fall back to USD.
  const alertCurrency = usdToDisplay(1) != null ? displayCurrency : "USD";
  const catalog = useCatalog();
  const [from, setFrom] = useState("CAI");
  const [to, setTo] = useState("");
  const [maxBudget, setMaxBudget] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lookupContact, setLookupContact] = useState("");
  const [alerts, setAlerts] = useState<Awaited<ReturnType<typeof lookupPriceAlerts>>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const airportOptions = catalog.airports.map((a) => ({
    value: a.code,
    label: airportLabel(a.code, catalog.airports),
  }));

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!to) {
      setError(t("errors.pickDestination"));
      return;
    }
    if (!maxBudget || maxBudget <= 0) {
      setError("أدخل الحد الأقصى للسعر");
      return;
    }
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    if (!trimmedPhone && !trimmedEmail) {
      setError(t("errors.contactRequired"));
      return;
    }
    if (trimmedPhone && !isValidPhone(trimmedPhone)) {
      setError(t("errors.phoneInvalid"));
      return;
    }
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      setError(t("errors.emailInvalid"));
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await createPriceAlert({
        fromAirport: from,
        toAirport: to,
        maxBudget,
        currency: alertCurrency,
        phone: trimmedPhone || undefined,
        email: trimmedEmail || undefined,
      });
      const contact = trimmedPhone || trimmedEmail;
      if (contact) setSessionContact(contact);
      setMessage(t("messages.created"));
    } catch (err) {
      setError(friendlyErrorMessage(err, "alerts:errors.createFailed", "AlertsPage.createAlert"));
    } finally {
      setLoading(false);
    }
  }

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await lookupPriceAlerts(lookupContact);
      setAlerts(data);
      setSessionContact(lookupContact);
      if (!data.length) setMessage(t("messages.noActive"));
    } catch (err) {
      setError(friendlyErrorMessage(err, "alerts:errors.searchFailed", "AlertsPage.search"));
    } finally {
      setLoading(false);
    }
  }

  if (catalog.loading) return <p className="text-slate-500">{t("common:actions.loading")}</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-slate-600">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-bold">{t("create.title")}</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <Select label={t("create.from")} value={from} onChange={(e) => setFrom(e.target.value)} options={airportOptions} />
            <Select
              label={t("create.to")}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              options={airportOptions}
              placeholder={t("create.toPlaceholder")}
            />
            <Input
              label={t("create.maxBudget", { currency: alertCurrency })}
              type="number"
              min={1}
              value={maxBudget ?? ""}
              onChange={(e) => setMaxBudget(e.target.value === "" ? null : Number(e.target.value))}
            />
            <Input label={t("create.phone")} type="tel" placeholder="+20xxxxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label={t("create.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="text-xs text-slate-500">{t("create.hint")}</p>
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? t("create.submitting") : t("create.submit")}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 font-bold">{t("lookup.title")}</h2>
          <form onSubmit={handleLookup} className="space-y-4">
            <Input
              label={t("lookup.contact")}
              required
              value={lookupContact}
              onChange={(e) => setLookupContact(e.target.value)}
            />
            <Button type="submit" variant="secondary" fullWidth disabled={loading}>
              {t("lookup.submit")}
            </Button>
          </form>
          {alerts.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {alerts.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-100 p-3 text-sm">
                  <p className="font-semibold">
                    {airportLabel(a.from_airport ?? "", catalog.airports)} →{" "}
                    {airportLabel(a.to_airport ?? "", catalog.airports)}
                  </p>
                  <p className="text-slate-600">{t("lookup.maxLine", { price: fmt(a.max_budget ?? 0, a.currency) })}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>

      {message ? <Card className="text-green-700">{message}</Card> : null}
      {error ? <Card className="text-red-600">{error}</Card> : null}
    </div>
  );
}
