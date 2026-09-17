import { useEffect, useState } from "react";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { signInWithEmail, signUpWithEmail, useAuth } from "../lib/auth";
import { friendlyErrorMessage } from "../lib/errors";
import { fetchMySupplierApplications, submitSupplierApplication } from "../lib/supplierApplication";
import {
  SUPPLIER_APPLICATION_STATUS_LABELS,
  SUPPLIER_ORG_TYPE_LABELS,
} from "../lib/admin";
import type { SupplierApplicationRow, SupplierOrgType } from "../types/database";

const ORG_TYPE_OPTIONS: { value: SupplierOrgType; label: string }[] = (
  Object.keys(SUPPLIER_ORG_TYPE_LABELS) as SupplierOrgType[]
).map((v) => ({ value: v, label: SUPPLIER_ORG_TYPE_LABELS[v] }));

export function BecomeSupplierPage() {
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
      <h1 className="text-3xl font-extrabold text-slate-900">انضم كمورد في TripRing</h1>
      <p className="mt-3 text-slate-600">
        شركة طيران، وكالة سياحية، مزود خدمات أرضية، نقل، تأجير، فنادق، أو تجارب — قدّم طلب الانضمام وهنراجعه
        ونرجعلك بالرد.
      </p>

      <div className="mt-8">
        {authLoading ? (
          <Card className="text-center text-sm text-slate-400">جاري التحميل...</Card>
        ) : !user ? (
          <AuthGate />
        ) : myApps === null ? (
          <Card className="text-center text-sm text-slate-400">جاري التحميل...</Card>
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
      setError(friendlyErrorMessage(e, "تعذر تسجيل الدخول", "BecomeSupplierPage.auth"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-4">
      <p className="text-sm text-slate-600">
        محتاج تسجّل دخول أو تعمل حساب الأول عشان نقدر نربط طلب الانضمام بيك ونرد عليك.
      </p>
      <div className="flex gap-2">
        <Button type="button" variant={mode === "signup" ? "primary" : "outline"} onClick={() => setMode("signup")}>
          حساب جديد
        </Button>
        <Button type="button" variant={mode === "signin" ? "primary" : "outline"} onClick={() => setMode("signin")}>
          عندي حساب
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === "signup" ? (
          <Input label="الاسم الكامل" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        ) : null}
        <Input
          label="البريد الإلكتروني"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="كلمة المرور"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? "جاري..." : mode === "signup" ? "إنشاء حساب ومتابعة" : "دخول"}
        </Button>
      </form>
    </Card>
  );
}

function ExistingApplicationNotice({ app }: { app: SupplierApplicationRow }) {
  return (
    <Card className="space-y-2 text-center">
      <p className="font-semibold text-slate-900">
        طلبك كـ{SUPPLIER_ORG_TYPE_LABELS[app.org_type]} ({app.company_name}) بانتظار المراجعة.
      </p>
      <p className="text-sm text-slate-500">{SUPPLIER_APPLICATION_STATUS_LABELS[app.status]} — هنتواصل معاك بعد المراجعة.</p>
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
      setError("اختار نوع النشاط");
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
      setError(friendlyErrorMessage(e, "تعذر إرسال الطلب", "BecomeSupplierPage.submit"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <Card className="space-y-2 text-center">
        <p className="font-semibold text-slate-900">تم استلام طلبك ✅</p>
        <p className="text-sm text-slate-500">هنراجعه ونرد عليك على البريد الإلكتروني اللي دخلته بيه.</p>
      </Card>
    );
  }

  return (
    <Card>
      {previousApp?.status === "rejected" ? (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          طلبك السابق اتراجع{previousApp.review_note ? `: ${previousApp.review_note}` : "."} تقدر تقدّم طلب جديد.
        </p>
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-3">
        <Select
          label="نوع النشاط"
          placeholder="اختار نوع النشاط"
          options={ORG_TYPE_OPTIONS}
          value={orgType}
          onChange={(e) => setOrgType(e.target.value as SupplierOrgType)}
        />
        <Input label="اسم الشركة/الجهة" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
        <Input label="اسم المسؤول" required value={contactName} onChange={(e) => setContactName(e.target.value)} />
        <Input
          label="البريد الإلكتروني للتواصل"
          type="email"
          required
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="رقم الهاتف" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          <Input label="واتساب" value={contactWhatsapp} onChange={(e) => setContactWhatsapp(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="الدولة (كود، مثال EG)" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} />
          <Input label="الموقع الإلكتروني" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">ملاحظات (اختياري)</span>
          <textarea
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-[#BFE3F6]"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? "جاري الإرسال..." : "إرسال طلب الانضمام"}
        </Button>
      </form>
    </Card>
  );
}
