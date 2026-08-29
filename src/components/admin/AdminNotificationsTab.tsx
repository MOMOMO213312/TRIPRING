import { useEffect, useState } from "react";

import {
  createNotification,
  fetchAffiliatesForTargeting,
  fetchAgenciesForTargeting,
  fetchAllNotificationsAdmin,
  NOTIFICATION_AUDIENCE_LABELS,
  NOTIFICATION_STATUS_LABELS,
  NOTIFICATION_TYPE_LABELS,
  setNotificationStatus,
} from "../../lib/notifications";
import { friendlyErrorMessage } from "../../lib/errors";
import type { NotificationRow } from "../../types/database";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";

const TYPE_OPTIONS: { value: NotificationRow["type"]; label: string }[] = [
  { value: "flash_deal", label: NOTIFICATION_TYPE_LABELS.flash_deal },
  { value: "site_announcement", label: NOTIFICATION_TYPE_LABELS.site_announcement },
  { value: "airport_info", label: NOTIFICATION_TYPE_LABELS.airport_info },
  { value: "circular", label: NOTIFICATION_TYPE_LABELS.circular },
  { value: "agency_bulletin", label: NOTIFICATION_TYPE_LABELS.agency_bulletin },
  { value: "affiliate_bulletin", label: NOTIFICATION_TYPE_LABELS.affiliate_bulletin },
];

const AUDIENCE_OPTIONS: { value: NotificationRow["audience"]; label: string }[] = [
  { value: "all_public", label: NOTIFICATION_AUDIENCE_LABELS.all_public },
  { value: "agencies", label: NOTIFICATION_AUDIENCE_LABELS.agencies },
  { value: "specific_agency", label: NOTIFICATION_AUDIENCE_LABELS.specific_agency },
  { value: "affiliates", label: NOTIFICATION_AUDIENCE_LABELS.affiliates },
  { value: "specific_affiliate", label: NOTIFICATION_AUDIENCE_LABELS.specific_affiliate },
];

const STATUS_BADGE: Record<NotificationRow["status"], string> = {
  draft: "bg-slate-100 text-slate-600",
  scheduled: "bg-amber-100 text-amber-700",
  sent: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export function AdminNotificationsTab() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetchAllNotificationsAdmin()
      .then(setItems)
      .catch((e) => setError(friendlyErrorMessage(e, "تعذر تحميل الإشعارات", "AdminNotificationsTab.load")))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSend(n: NotificationRow) {
    setBusyId(n.id);
    try {
      await setNotificationStatus(n.id, "sent");
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر إرسال الإشعار", "AdminNotificationsTab.send"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(n: NotificationRow) {
    setBusyId(n.id);
    try {
      await setNotificationStatus(n.id, "cancelled");
      load();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر إلغاء الإشعار", "AdminNotificationsTab.cancel"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          العروض/الشريط الإخباري للعملاء، ومعلومات المطارات، والتعميمات الداخلية للوكلاء والأفلييت.
        </p>
        <Button onClick={() => setShowCreate(true)}>+ إشعار جديد</Button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">جاري التحميل...</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">لا يوجد إشعارات بعد</p>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Card key={n.id} className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-900">{n.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[n.status]}`}>
                    {NOTIFICATION_STATUS_LABELS[n.status]}
                  </span>
                  {n.status === "sent" && n.audience === "all_public" ? (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">شريط</span>
                  ) : null}
                </div>
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{n.body}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {NOTIFICATION_TYPE_LABELS[n.type]} · {NOTIFICATION_AUDIENCE_LABELS[n.audience]}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {n.status !== "sent" && n.status !== "cancelled" ? (
                  <Button variant="primary" disabled={busyId === n.id} onClick={() => handleSend(n)}>
                    إرسال الآن
                  </Button>
                ) : null}
                {n.status !== "cancelled" && n.status !== "sent" ? (
                  <Button variant="outline" disabled={busyId === n.id} onClick={() => handleCancel(n)}>
                    إلغاء
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateNotificationModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          load();
        }}
      />
    </div>
  );
}

function CreateNotificationModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<NotificationRow["type"]>("site_announcement");
  const [audience, setAudience] = useState<NotificationRow["audience"]>("all_public");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const channels = ["in_site"] as NotificationRow["channels"];
  const [targetAgencyId, setTargetAgencyId] = useState("");
  const [targetAffiliateId, setTargetAffiliateId] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [agencies, setAgencies] = useState<{ id: string; name: string }[]>([]);
  const [affiliates, setAffiliates] = useState<{ id: string; referral_code: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendNow, setSendNow] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchAgenciesForTargeting().then(setAgencies).catch(() => {});
    fetchAffiliatesForTargeting().then(setAffiliates).catch(() => {});
  }, [open]);

  async function handleSubmit() {
    if (!title.trim() || !body.trim()) {
      setError("العنوان والمحتوى مطلوبين");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createNotification({
        type,
        title,
        body,
        linkUrl: linkUrl || null,
        audience,
        targetAgencyId: audience === "specific_agency" ? targetAgencyId || null : null,
        targetAffiliateId: audience === "specific_affiliate" ? targetAffiliateId || null : null,
        channels,
        isTicker: audience === "all_public",
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
      });
      if (sendNow) await setNotificationStatus(created.id, "sent");
      // reset form
      setTitle("");
      setBody("");
      setLinkUrl("");
      setEndsAt("");
      onCreated();
    } catch (e) {
      setError(friendlyErrorMessage(e, "تعذر إنشاء الإشعار", "CreateNotificationModal.submit"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="إشعار / تعميم جديد">
      <div className="space-y-3">
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <Select
          label="النوع"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(e) => setType(e.target.value as NotificationRow["type"])}
        />
        <Select
          label="الجمهور المستهدف"
          options={AUDIENCE_OPTIONS}
          value={audience}
          onChange={(e) => setAudience(e.target.value as NotificationRow["audience"])}
        />
        {audience === "specific_agency" ? (
          <Select
            label="الوكالة"
            placeholder="اختر وكالة"
            options={agencies.map((a) => ({ value: a.id, label: a.name }))}
            value={targetAgencyId}
            onChange={(e) => setTargetAgencyId(e.target.value)}
          />
        ) : null}
        {audience === "specific_affiliate" ? (
          <Select
            label="الأفلييت"
            placeholder="اختر أفلييت"
            options={affiliates.map((a) => ({ value: a.id, label: a.referral_code }))}
            value={targetAffiliateId}
            onChange={(e) => setTargetAffiliateId(e.target.value)}
          />
        ) : null}

        <Input label="العنوان" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: عروض بلاك فرايدي" />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">المحتوى</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-[#BFE3F6]"
            placeholder="تفاصيل الإشعار..."
          />
        </label>
        <Input label="رابط (اختياري)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/deals" />
        <Input label="تاريخ الانتهاء (اختياري)" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />

        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} />
          إرسال فورًا (وإلا هيتحفظ كمسودة تقدر تبعتها بعدين)
        </label>

        <Button fullWidth disabled={saving} onClick={handleSubmit}>
          {saving ? "جاري الحفظ..." : sendNow ? "حفظ وإرسال" : "حفظ كمسودة"}
        </Button>
      </div>
    </Modal>
  );
}
