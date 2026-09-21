import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { signInWithEmail, signUpWithEmail, useAuth } from "../lib/auth";
import { friendlyErrorMessage } from "../lib/errors";
import { fetchMySupplierApplications, submitSupplierApplication } from "../lib/supplierApplication";
import type { SupplierApplicationRow, SupplierOrgType } from "../types/database";

// Order of the business-type dropdown. Labels come from the `supplier` namespace (the admin
// dashboard keeps its own Arabic label maps in lib/admin.ts).
const ORG_TYPES: SupplierOrgType[] = [
  "agency",
  "airline",
  "ground_provider",
  "transport_provider",
  "rental_provider",
  "hotel_provider",
  "experience_provider",
];

export function BecomeSupplierPage() {
  const { t } = useTranslation("supplier");
  const { user, loading: authLoading } = useAuth();
  const [myApps, setMyApps] = useState<SupplierApplicationRow[] | null>(null);

  useEffect(() => {
    if (!user) {
      setMyApps(null);
      return;
    }
    fetchMySupplierApplications()
      .then(setMyApps)
      .catch(() => setMyApps([]));
  }, [user]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-extrabold text-slate-900">{t("title")}</h1>
      <p className="mt-3 text-slate-600">
        {t("intro")}
      </p>

      <div className="mt-8">
        {authLoading ? (
          <Card className="text-center text-sm text-slate-400">{t("loading")}</Card>
        ) : !user ? (
          <AuthGate />
        ) : myApps === null ? (
          <Card className="text-center text-sm text-slate-400">{t("loading")}</Card>
        ) : myApps.some((a) => a.status === "pending") ? (
          <ExistingApplicationNotice app={myApps.find((a) => a.status === "pending")!} />
        ) : (
          <ApplicationForm
            previousApp={myApps[0]}
            onSubmitted={() => fetchMySupplierApplications().then(setMyApps)}
          />
        )}
      </div>
    </div>
  );
}

function AuthGate() {
  const { t } = useTranslation("supplier");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUpWithEmail(email, password, fullName || undefined);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (e) {
      setError(friendlyErrorMessage(e, "supplier:auth.failed", "BecomeSupplierPage.auth"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-4">
      <p className="text-sm text-slate-600">
        {t("auth.intro")}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant={mode === "signup" ? "primary" : "outline"} onClick={() => setMode("signup")}>
          {t("auth.signup")}
        </Button>
        <Button type="button" variant={mode === "signin" ? "primary" : "outline"} onClick={() => setMode("signin")}>
          {t("auth.signin")}
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === "signup" ? (
          <Input label={t("auth.fullName")} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        ) : null}
        <Input
          label={t("auth.email")}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label={t("auth.password")}
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? t("auth.working") : mode === "signup" ? t("auth.createAndContinue") : t("auth.login")}
        </Button>
      </form>
    </Card>
  );
}

function ExistingApplicationNotice({ app }: { app: SupplierApplicationRow }) {
  const { t } = useTranslation("supplier");
  return (
    <Card className="space-y-2 text-center">
      <p className="font-semibold text-slate-900">
        {t("existing.title", { type: t(`orgTypes.${app.org_type}`), company: app.company_name })}
      </p>
      <p className="text-sm text-slate-500">{t("existing.sub", { status: t(`status.${app.status}`) })}</p>
    </Card>
  );
}

function ApplicationForm({
  previousApp,
  onSubmitted,
}: {
  previousApp?: SupplierApplicationRow;
  onSubmitted: () => void;
}) {
  const { t } = useTranslation("supplier");
  const orgTypeOptions = ORG_TYPES.map((v) => ({ value: v, label: t(`orgTypes.${v}`) }));
  const [orgType, setOrgType] = useState<SupplierOrgType | "">("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgType) {
      setError(t("form.orgTypeRequired"));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await submitSupplierApplication({
        orgType,
        companyName,
        contactName,
        contactEmail,
        countryCode: countryCode || null,
        contactPhone: contactPhone || null,
        contactWhatsapp: contactWhatsapp || null,
        website: website || null,
        notes: notes || null,
      });
      setSuccess(true);
      onSubmitted();
    } catch (e) {
      setError(friendlyErrorMessage(e, "supplier:form.failed", "BecomeSupplierPage.submit"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Card className="space-y-2 text-center">
        <p className="font-semibold text-slate-900">{t("form.successTitle")}</p>
        <p className="text-sm text-slate-500">{t("form.successBody")}</p>
      </Card>
    );
  }

  return (
    <Card>
      {previousApp?.status === "rejected" ? (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          {previousApp.review_note
            ? t("form.previousRejectedNote", { note: previousApp.review_note })
            : t("form.previousRejected")}
        </p>
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Select
          label={t("form.orgType")}
          placeholder={t("form.orgTypePlaceholder")}
          options={orgTypeOptions}
          value={orgType}
          onChange={(e) => setOrgType(e.target.value as SupplierOrgType)}
        />
        <Input label={t("form.company")} required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        <Input label={t("form.contactName")} required value={contactName} onChange={(e) => setContactName(e.target.value)} />
        <Input
          label={t("form.contactEmail")}
          type="email"
          required
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("form.phone")} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          <Input label={t("form.whatsapp")} value={contactWhatsapp} onChange={(e) => setContactWhatsapp(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("form.country")} value={countryCode} onChange={(e) => setCountryCode(e.target.value)} />
          <Input label={t("form.website")} value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">{t("form.notes")}</span>
          <textarea
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-[#BFE3F6]"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? t("form.submitting") : t("form.submit")}
        </Button>
      </form>
    </Card>
  );
}
