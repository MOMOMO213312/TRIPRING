import type { FormEvent } from "react";
import { useState } from "react";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { createPriceAlert, lookupPriceAlerts } from "../lib/api";
import { setSessionContact } from "../lib/session";
import { airportLabel } from "../lib/deal-utils";
import { useCatalog } from "../hooks/useCatalog";
import { formatPrice } from "../lib/utils";

export function AlertsPage() {
  const catalog = useCatalog();
  const [from, setFrom] = useState("CAI");
  const [to, setTo] = useState("");
  const [maxBudget, setMaxBudget] = useState(300);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [lookupContact, setLookupContact] = useState("");
  const [alerts, setAlerts] = useState<Awaited<ReturnType<typeof lookupPriceAlerts>>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const airportOptions = catalog.airports.map((a) => ({
    value: a.code,
    label: `${a.city} (${a.code})`,
  }));

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!to) {
      setError("اختر وجهة");
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
        phone: phone || undefined,
        email: email || undefined,
      });
      const contact = phone || email;
      if (contact) setSessionContact(contact);
      setMessage("تم إنشاء التنبيه بنجاح");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء التنبيه");
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
      if (!data.length) setMessage("لا توجد تنبيهات نشطة");
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل البحث");
    } finally {
      setLoading(false);
    }
  }

  if (catalog.loading) return <p className="text-gray-500">جاري التحميل...</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">تنبيهات الأسعار</h1>
        <p className="text-gray-600">احصل على إشعار عندما ينخفض السعر لمسار معيّن</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-bold">إنشاء تنبيه جديد</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <Select label="من" value={from} onChange={(e) => setFrom(e.target.value)} options={airportOptions} />
            <Select
              label="إلى"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              options={airportOptions}
              placeholder="اختر الوجهة"
            />
            <Input
              label="الحد الأقصى للسعر (USD)"
              type="number"
              min={50}
              value={maxBudget}
              onChange={(e) => setMaxBudget(Number(e.target.value))}
            />
            <Input label="رقم الهاتف" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="البريد الإلكتروني" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <p className="text-xs text-gray-500">أدخل هاتفاً أو بريداً على الأقل للمتابعة</p>
            <Button type="submit" fullWidth disabled={loading}>
              {loading ? "جاري الحفظ..." : "إنشاء التنبيه"}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 font-bold">تنبيهاتي</h2>
          <form onSubmit={handleLookup} className="space-y-4">
            <Input
              label="رقم الهاتف أو البريد"
              required
              value={lookupContact}
              onChange={(e) => setLookupContact(e.target.value)}
            />
            <Button type="submit" variant="secondary" fullWidth disabled={loading}>
              عرض التنبيهات
            </Button>
          </form>
          {alerts.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {alerts.map((a) => (
                <li key={a.id} className="rounded-lg border border-gray-100 p-3 text-sm">
                  <p className="font-semibold">
                    {airportLabel(a.from_airport, catalog.airports)} →{" "}
                    {airportLabel(a.to_airport, catalog.airports)}
                  </p>
                  <p className="text-gray-600">حد أقصى: {formatPrice(a.max_budget)}</p>
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
